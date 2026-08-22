from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.schemas.display import DisplayPayloadOut, WallInfoOut
from app.schemas.menu import MenuItemOut
from app.schemas.playlist import PlaylistPlaybackOut, PlaylistSlideOut
from db.models import MediaAsset, Menu, MenuItem, Playlist, Screen, Template


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _item_out(item: MenuItem) -> MenuItemOut:
    return MenuItemOut(
        id=item.id,
        menu_id=item.menu_id,
        organization_id=item.organization_id,
        name=item.name,
        price=float(item.price if isinstance(item.price, Decimal) else item.price),
        description=item.description or "",
        image_url=item.image_url,
        available=item.available,
        sort_order=item.sort_order,
        category=item.category,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _item_from_snap(raw: dict[str, Any]) -> MenuItemOut:
    created = raw.get("createdAt") or raw.get("created_at")
    updated = raw.get("updatedAt") or raw.get("updated_at")
    return MenuItemOut(
        id=str(raw.get("id") or ""),
        menu_id=str(raw.get("menuId") or raw.get("menu_id") or ""),
        organization_id=str(
            raw.get("organizationId") or raw.get("organization_id") or ""
        ),
        name=str(raw.get("name") or ""),
        price=float(raw.get("price") or 0),
        description=str(raw.get("description") or ""),
        image_url=raw.get("imageUrl") if "imageUrl" in raw else raw.get("image_url"),
        available=bool(raw.get("available", True)),
        sort_order=int(raw.get("sortOrder") or raw.get("sort_order") or 0),
        category=str(raw.get("category") or "General"),
        created_at=created if isinstance(created, datetime) else _utcnow(),
        updated_at=updated if isinstance(updated, datetime) else _utcnow(),
    )


async def _menu_items(db: AsyncSession, menu_id: str) -> list[MenuItemOut]:
    result = await db.execute(
        select(MenuItem)
        .where(MenuItem.menu_id == menu_id)
        .order_by(MenuItem.sort_order, MenuItem.name)
    )
    return [_item_out(i) for i in result.scalars().all()]


def _playlist_from_snapshot(snap: dict[str, Any]) -> PlaylistPlaybackOut | None:
    slides_raw = snap.get("slides") or []
    if not slides_raw:
        return None
    slides: list[PlaylistSlideOut] = []
    for s in slides_raw:
        items = [
            _item_from_snap(i) if isinstance(i, dict) else i
            for i in (s.get("items") or [])
        ]
        # Re-validate MenuItemOut if already dumped
        parsed_items: list[MenuItemOut] = []
        for i in items:
            if isinstance(i, MenuItemOut):
                parsed_items.append(i)
            elif isinstance(i, dict):
                parsed_items.append(_item_from_snap(i))
        slides.append(
            PlaylistSlideOut(
                id=str(s.get("id") or ""),
                sort_order=int(s.get("sortOrder") or s.get("sort_order") or 0),
                content_type=str(s.get("contentType") or s.get("content_type") or ""),
                duration_seconds=max(
                    1, int(s.get("durationSeconds") or s.get("duration_seconds") or 10)
                ),
                label=s.get("label"),
                transition=s.get("transition"),
                menu_id=s.get("menuId") or s.get("menu_id"),
                menu_name=s.get("menuName") or s.get("menu_name"),
                menu_version=s.get("menuVersion") or s.get("menu_version"),
                items=parsed_items,
                template_id=s.get("templateId") or s.get("template_id"),
                template_name=s.get("templateName") or s.get("template_name"),
                canvas_json=s.get("canvasJson") or s.get("canvas_json"),
                display_config=s.get("displayConfig") or s.get("display_config"),
                media_url=s.get("mediaUrl") or s.get("media_url"),
                media_mime_type=s.get("mediaMimeType") or s.get("media_mime_type"),
                media_kind=s.get("mediaKind") or s.get("media_kind"),
                media_name=s.get("mediaName") or s.get("media_name"),
            )
        )
    return PlaylistPlaybackOut(
        id=str(snap.get("id") or ""),
        name=str(snap.get("name") or "Playlist"),
        version=int(snap.get("version") or 1),
        loop=bool(snap.get("loop", True)),
        priority=int(snap.get("priority") or 0),
        slides=slides,
    )


async def _resolve_playlist_playback(
    db: AsyncSession, playlist: Playlist
) -> PlaylistPlaybackOut | None:
    if playlist.status == "archived":
        return None
    # Prefer immutable published snapshot for kiosk stability
    if (
        playlist.status == "published"
        and isinstance(playlist.published_snapshot, dict)
        and playlist.published_snapshot.get("slides")
    ):
        return _playlist_from_snapshot(playlist.published_snapshot)

    slides: list[PlaylistSlideOut] = []
    for row in sorted(playlist.items or [], key=lambda i: i.sort_order):
        slide = PlaylistSlideOut(
            id=row.id,
            sort_order=row.sort_order,
            content_type=row.content_type,
            duration_seconds=max(1, int(row.duration_seconds or 10)),
            label=row.label,
            transition=row.transition,
        )
        if row.content_type == "menu" and row.menu_id:
            menu = await db.get(Menu, row.menu_id)
            if menu is None:
                continue
            slide.menu_id = menu.id
            slide.menu_name = menu.name
            slide.menu_version = menu.version
            if (
                menu.status == "published"
                and isinstance(menu.published_snapshot, dict)
                and menu.published_snapshot.get("items") is not None
            ):
                slide.items = [
                    _item_from_snap(i)
                    for i in (menu.published_snapshot.get("items") or [])
                    if isinstance(i, dict)
                ]
                snap = menu.published_snapshot
                if row.template_id or snap.get("templateId"):
                    slide.template_id = row.template_id or snap.get("templateId")
                    slide.template_name = snap.get("templateName")
                    slide.canvas_json = snap.get("canvasJson")
                    slide.display_config = snap.get("displayConfig")
            else:
                slide.items = await _menu_items(db, menu.id)
                if row.template_id:
                    tpl = await db.get(Template, row.template_id)
                    if tpl is not None:
                        slide.template_id = tpl.id
                        slide.template_name = tpl.name
                        if isinstance(tpl.canvas_json, dict):
                            slide.canvas_json = tpl.canvas_json
                        if isinstance(tpl.display_config, dict):
                            slide.display_config = tpl.display_config or None
        elif row.content_type == "template" and row.template_id:
            tpl = await db.get(Template, row.template_id)
            if tpl is None:
                continue
            if (
                tpl.status == "published"
                and isinstance(tpl.published_snapshot, dict)
                and isinstance((tpl.published_snapshot.get("template") or {}), dict)
            ):
                t = tpl.published_snapshot["template"]
                slide.template_id = t.get("id") or tpl.id
                slide.template_name = t.get("name") or tpl.name
                slide.canvas_json = t.get("canvasJson")
                slide.display_config = t.get("displayConfig")
            else:
                slide.template_id = tpl.id
                slide.template_name = tpl.name
                if isinstance(tpl.canvas_json, dict):
                    slide.canvas_json = tpl.canvas_json
                if isinstance(tpl.display_config, dict):
                    slide.display_config = tpl.display_config or None
        elif row.content_type in ("image", "video") and row.media_asset_id:
            asset = await db.get(MediaAsset, row.media_asset_id)
            if asset is None:
                continue
            slide.media_url = asset.url
            slide.media_mime_type = asset.mime_type
            slide.media_kind = asset.kind
            slide.media_name = asset.name
            if (
                row.content_type == "video"
                and asset.duration_seconds
                and row.duration_seconds <= 10
            ):
                slide.duration_seconds = max(1, int(asset.duration_seconds))
        else:
            continue
        slides.append(slide)

    if not slides:
        return None
    return PlaylistPlaybackOut(
        id=playlist.id,
        name=playlist.name,
        version=playlist.version,
        loop=bool(playlist.loop),
        priority=int(playlist.priority or 0),
        slides=slides,
    )


def _apply_menu_snapshot(
    snap: dict[str, Any],
) -> tuple[list[MenuItemOut], Any, Any, str | None, str | None]:
    items = [
        _item_from_snap(i)
        for i in (snap.get("items") or [])
        if isinstance(i, dict)
    ]
    canvas = snap.get("canvasJson") or snap.get("canvas_json")
    display_config = snap.get("displayConfig") or snap.get("display_config")
    template_id = snap.get("templateId") or snap.get("template_id")
    template_name = snap.get("templateName") or snap.get("template_name")
    return items, canvas, display_config, template_id, template_name


async def build_display_payload(
    db: AsyncSession, screen: Screen
) -> DisplayPayloadOut | None:
    """Build kiosk content for a paired screen. Prefers published snapshots."""
    if screen.location_id is None or screen.status == "pairing":
        return None

    playlist_playback: PlaylistPlaybackOut | None = None
    if screen.active_playlist_id:
        result = await db.execute(
            select(Playlist)
            .where(Playlist.id == screen.active_playlist_id)
            .options(selectinload(Playlist.items))
        )
        playlist = result.scalar_one_or_none()
        if playlist is not None and playlist.organization_id == screen.organization_id:
            playlist_playback = await _resolve_playlist_playback(db, playlist)

    menu: Menu | None = None
    if screen.active_menu_id:
        menu = await db.get(Menu, screen.active_menu_id)
        if menu is not None and menu.status == "archived":
            menu = None

    template: Template | None = None
    if screen.active_template_id:
        template = await db.get(Template, screen.active_template_id)

    items: list[MenuItemOut] = []
    canvas = None
    display_config = None
    menu_id = menu.id if menu else None
    menu_name = menu.name if menu else None
    menu_version = menu.version if menu else None
    template_id = template.id if template else None
    template_name = template.name if template else None

    if playlist_playback and playlist_playback.slides:
        first_menu = next(
            (s for s in playlist_playback.slides if s.content_type == "menu"),
            None,
        )
        if first_menu:
            menu_id = first_menu.menu_id
            menu_name = first_menu.menu_name
            menu_version = first_menu.menu_version
            items = list(first_menu.items)
            canvas = first_menu.canvas_json
            display_config = first_menu.display_config
            template_id = first_menu.template_id
            template_name = first_menu.template_name
        elif playlist_playback.slides[0].content_type == "template":
            first = playlist_playback.slides[0]
            canvas = first.canvas_json
            display_config = first.display_config
            template_id = first.template_id
            template_name = first.template_name
    elif menu is not None and menu.status == "published" and isinstance(
        menu.published_snapshot, dict
    ):
        items, canvas, display_config, tid, tname = _apply_menu_snapshot(
            menu.published_snapshot
        )
        menu_id = menu.published_snapshot.get("menuId") or menu.id
        menu_name = menu.published_snapshot.get("menuName") or menu.name
        menu_version = menu.published_snapshot.get("menuVersion") or menu.version
        template_id = tid or template_id
        template_name = tname or template_name
    else:
        # Draft / never-published: live working copy (preview / first assign)
        if menu is not None:
            items = await _menu_items(db, menu.id)
            menu_version = menu.version
        if template is not None:
            if (
                template.status == "published"
                and isinstance(template.published_snapshot, dict)
                and isinstance(template.published_snapshot.get("template"), dict)
            ):
                t = template.published_snapshot["template"]
                canvas = t.get("canvasJson")
                display_config = t.get("displayConfig")
                template_name = t.get("name") or template.name
            else:
                if isinstance(template.canvas_json, dict):
                    canvas = template.canvas_json
                if isinstance(template.display_config, dict):
                    display_config = template.display_config or None

    return DisplayPayloadOut(
        screen_id=screen.id,
        screen_name=screen.name,
        organization_id=screen.organization_id,
        orientation=screen.orientation,
        resolution=screen.resolution,
        menu_id=menu_id,
        menu_name=menu_name,
        menu_version=menu_version,
        template_id=template_id,
        template_name=template_name,
        canvas_json=canvas,
        display_config=display_config,
        items=items,
        updated_at=_utcnow(),
        playlist=playlist_playback,
        wall=await _wall_for_screen(db, screen),
    )


async def _wall_for_screen(db: AsyncSession, screen: Screen) -> WallInfoOut | None:
    from app.services.screen_groups import wall_info_for_screen

    info = await wall_info_for_screen(db, screen)
    if not info:
        return None
    return WallInfoOut(
        group_id=info["group_id"],
        group_name=info["group_name"],
        layout=info["layout"],
        rows=info["rows"],
        cols=info["cols"],
        row=info["row"],
        col=info["col"],
        content_mode=info["content_mode"],
        sync_epoch_ms=info.get("sync_epoch_ms"),
        bezel_compensation_pct=float(info.get("bezel_compensation_pct") or 0),
    )
