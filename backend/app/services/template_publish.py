"""Atomic template package publish: layout + audio + playlist + screen targets."""

from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.access import get_org_screen_or_404
from app.auth.permissions import SCREENS_PUBLISH, TEMPLATES_UPDATE, require_permission
from app.schemas.template import TemplatePublishIn
from app.services import audio_playlist as audio_service
from app.services import content_versions as cv_service
from app.services import playlist as playlist_service
from app.services import screen_groups as group_service
from app.services.audit import record_audit
from app.utils.ids import new_id
from app.utils.menu_board import as_premium_display_config
from db.models import Menu, PlaylistItem, Screen, Template, User


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


async def _ensure_template_slide(
    db: AsyncSession,
    user: User,
    playlist: Playlist,
    template: Template,
    duration_seconds: int,
    sort_order: int | None,
) -> None:
    """Upsert this template as a rotation slide on an existing playlist."""
    items = sorted(list(playlist.items or []), key=lambda i: i.sort_order)
    existing = next(
        (
            row
            for row in items
            if row.content_type == "template" and row.template_id == template.id
        ),
        None,
    )
    duration = max(1, min(3600, int(duration_seconds)))
    if existing is None:
        existing = PlaylistItem(
            id=new_id("pli"),
            playlist_id=playlist.id,
            organization_id=user.organization_id,
            sort_order=10_000 + len(items),
            content_type="template",
            duration_seconds=duration,
            label=template.name,
            template_id=template.id,
            meta={},
        )
        db.add(existing)
        items.append(existing)
        await db.flush()
    else:
        existing.duration_seconds = duration

    if sort_order is not None:
        others = [row for row in items if row.id != existing.id]
        insert_at = min(max(0, sort_order), len(others))
        others.insert(insert_at, existing)
        items = others

    for index, row in enumerate(items):
        row.sort_order = 10_000 + index
    await db.flush()
    for index, row in enumerate(items):
        row.sort_order = index
    await db.flush()


async def _resolve_target_screens(
    db: AsyncSession,
    user: User,
    body: TemplatePublishIn,
) -> tuple[list[Screen], str | None]:
    screen_ids = list(dict.fromkeys(body.screen_ids or []))
    group_id = body.screen_group_id or None

    if group_id:
        group = await group_service.get_org_screen_group_or_404(db, user, group_id)
        if not group.members:
            raise HTTPException(
                status_code=400,
                detail="Assign screens to the video wall before publishing",
            )
        for member in group.members:
            if member.screen_id not in screen_ids:
                screen_ids.append(member.screen_id)

    if not screen_ids:
        raise HTTPException(
            status_code=400,
            detail="Select at least one screen or a video wall to publish",
        )

    screens: list[Screen] = []
    for sid in screen_ids:
        screen = await get_org_screen_or_404(db, user, sid)
        if screen.location_id is None or screen.status == "pairing":
            raise HTTPException(
                status_code=400,
                detail=f"Screen {screen.name} is not paired",
            )
        screens.append(screen)
    return screens, group_id


async def publish_template_package(
    db: AsyncSession,
    user: User,
    template: Template,
    body: TemplatePublishIn,
) -> tuple[Template, list[Screen], str | None]:
    """Apply the full package in the current session. Caller must commit once."""
    require_permission(user, SCREENS_PUBLISH)
    require_permission(user, TEMPLATES_UPDATE)

    if template.is_global:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Global templates cannot be published as org versions.",
        )

    screens, group_id = await _resolve_target_screens(db, user, body)

    if body.canvas_json is not None:
        template.canvas_json = deepcopy(body.canvas_json)
    if body.display_config is not None:
        template.display_config = as_premium_display_config(
            body.display_config if isinstance(body.display_config, dict) else None
        )
    if body.resolution is not None:
        template.resolution = body.resolution.strip() or template.resolution
    if body.orientation is not None:
        template.orientation = body.orientation

    audio_id = (body.audio_playlist_id or "").strip() or None
    playlist_id = (body.playlist_id or "").strip() or None
    menu_id = (body.menu_id or "").strip() or None

    audio = None
    if audio_id:
        audio = await audio_service.get_org_audio_playlist_or_404(db, user, audio_id)
        await audio_service.stamp_audio_playlist_published(db, user, audio)
        template.audio_playlist_id = audio.id
    else:
        template.audio_playlist_id = None

    if body.audio_volume is not None:
        template.audio_volume = max(0.0, min(1.0, float(body.audio_volume)))
    if body.audio_loop is not None:
        template.audio_loop = bool(body.audio_loop)
    if body.audio_muted is not None:
        template.audio_muted = bool(body.audio_muted)

    visual_playlist = None
    if playlist_id:
        visual_playlist = await playlist_service.get_org_playlist_or_404(
            db, user, playlist_id
        )
        duration = body.playlist_item_duration_seconds or (
            template.playlist_item_duration_seconds or 12
        )
        await _ensure_template_slide(
            db,
            user,
            visual_playlist,
            template,
            duration,
            body.playlist_item_sort_order,
        )
        template.playlist_id = visual_playlist.id
        template.playlist_item_duration_seconds = duration
        visual_playlist = await playlist_service.get_org_playlist_or_404(
            db, user, visual_playlist.id
        )
        await playlist_service.stamp_playlist_published(
            db,
            user,
            visual_playlist,
            change_summary=body.change_summary,
        )
    else:
        template.playlist_id = None
        if body.playlist_item_duration_seconds is not None:
            template.playlist_item_duration_seconds = (
                body.playlist_item_duration_seconds
            )

    menu = None
    if menu_id:
        menu = await db.get(Menu, menu_id)
        if menu is None or menu.organization_id != user.organization_id:
            raise HTTPException(status_code=404, detail="Menu not found")

    await cv_service.publish_template(
        db, user, template, change_summary=body.change_summary
    )

    now = _utcnow()
    group = None
    if group_id:
        group = await group_service.get_org_screen_group_or_404(db, user, group_id)
        group.active_template_id = template.id
        group.active_playlist_id = visual_playlist.id if visual_playlist else None
        if menu is not None:
            group.active_menu_id = menu.id
        elif not visual_playlist:
            group.active_menu_id = None
        group.sync_epoch_ms = int(now.timestamp() * 1000)
        group.updated_at = now

    for screen in screens:
        screen.active_template_id = template.id
        screen.active_playlist_id = visual_playlist.id if visual_playlist else None
        screen.active_menu_id = menu.id if menu else None
        screen.active_audio_playlist_id = audio.id if audio else None
        screen.audio_volume = float(template.audio_volume or 0.5)
        screen.audio_loop = bool(template.audio_loop)
        screen.audio_muted = bool(template.audio_muted)
        screen.content_updated_at = now
        screen.current_content_summary = (
            f"{template.name} v{template.version}"
            + (f" + playlist {visual_playlist.name}" if visual_playlist else "")
        )

    await record_audit(
        db,
        organization_id=user.organization_id,
        action="template.package_published",
        actor=user,
        metadata={
            "templateId": template.id,
            "version": template.version,
            "screenIds": [s.id for s in screens],
            "playlistId": visual_playlist.id if visual_playlist else None,
            "audioPlaylistId": audio.id if audio else None,
            "screenGroupId": group_id,
            "menuId": menu.id if menu else None,
            "changeSummary": body.change_summary,
            "orientationMismatchScreenIds": orientation_mismatch_screen_ids(
                template, screens
            ),
        },
    )

    return template, screens, group_id


def orientation_mismatch_screen_ids(
    template: Template, screens: list[Screen]
) -> list[str]:
    """Screens whose orientation differs from the template's.

    Publishing is still allowed — the layout stretches either way — but callers
    surface this so an admin can fix a portrait board on a landscape TV.
    """
    expected = template.orientation or "landscape"
    return [s.id for s in screens if (s.orientation or "landscape") != expected]
