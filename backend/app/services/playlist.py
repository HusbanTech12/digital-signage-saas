"""Playlist CRUD, validation, and publish helpers."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.permissions import (
    PLAYLISTS_CREATE,
    PLAYLISTS_DELETE,
    PLAYLISTS_PUBLISH,
    PLAYLISTS_READ,
    PLAYLISTS_UPDATE,
    require_permission,
)
from app.schemas.playlist import PlaylistCreate, PlaylistItemIn, PlaylistUpdate
from app.utils.ids import new_id
from db.models import MediaAsset, Menu, Playlist, PlaylistItem, Screen, Template, User
from db.models.playlist import PLAYLIST_CONTENT_TYPES, PLAYLIST_STATUSES


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


async def get_org_playlist_or_404(
    db: AsyncSession, user: User, playlist_id: str, *, load_items: bool = True
) -> Playlist:
    require_permission(user, PLAYLISTS_READ)
    stmt = select(Playlist).where(
        Playlist.id == playlist_id,
        Playlist.organization_id == user.organization_id,
    )
    if load_items:
        stmt = stmt.options(selectinload(Playlist.items))
    result = await db.execute(stmt)
    playlist = result.scalar_one_or_none()
    if playlist is None:
        raise HTTPException(status_code=404, detail="Playlist not found")
    return playlist


async def list_playlists(
    db: AsyncSession,
    user: User,
    *,
    status_filter: str | None = None,
    q: str | None = None,
) -> list[Playlist]:
    require_permission(user, PLAYLISTS_READ)
    stmt = (
        select(Playlist)
        .where(Playlist.organization_id == user.organization_id)
        .options(selectinload(Playlist.items))
        .order_by(Playlist.updated_at.desc())
    )
    if status_filter:
        if status_filter not in PLAYLIST_STATUSES:
            raise HTTPException(status_code=400, detail="Invalid status filter")
        stmt = stmt.where(Playlist.status == status_filter)
    if q and q.strip():
        like = f"%{q.strip()}%"
        stmt = stmt.where(Playlist.name.ilike(like))
    result = await db.execute(stmt)
    return list(result.scalars().unique().all())


async def _validate_item_refs(
    db: AsyncSession, user: User, item: PlaylistItemIn
) -> None:
    if item.content_type not in PLAYLIST_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Invalid content type")

    if item.content_type == "menu":
        if not item.menu_id:
            raise HTTPException(
                status_code=400, detail="menuId is required for menu slides"
            )
        menu = await db.get(Menu, item.menu_id)
        if menu is None or menu.organization_id != user.organization_id:
            raise HTTPException(status_code=400, detail="Menu not found")
        if item.template_id:
            tpl = await db.get(Template, item.template_id)
            if tpl is None or (
                not tpl.is_global and tpl.organization_id != user.organization_id
            ):
                raise HTTPException(status_code=400, detail="Template not found")

    elif item.content_type == "template":
        if not item.template_id:
            raise HTTPException(
                status_code=400, detail="templateId is required for template slides"
            )
        tpl = await db.get(Template, item.template_id)
        if tpl is None or (
            not tpl.is_global and tpl.organization_id != user.organization_id
        ):
            raise HTTPException(status_code=400, detail="Template not found")

    elif item.content_type in ("image", "video"):
        if not item.media_asset_id:
            raise HTTPException(
                status_code=400,
                detail="mediaAssetId is required for image/video slides",
            )
        asset = await db.get(MediaAsset, item.media_asset_id)
        if asset is None or asset.organization_id != user.organization_id:
            raise HTTPException(status_code=400, detail="Media asset not found")
        if item.content_type == "image" and asset.kind not in (
            "image",
            "logo",
            "promo",
            "other",
        ):
            raise HTTPException(
                status_code=400, detail="Selected media is not an image"
            )
        if item.content_type == "video" and asset.kind != "video":
            raise HTTPException(
                status_code=400, detail="Selected media is not a video"
            )


async def _replace_items(
    db: AsyncSession,
    user: User,
    playlist: Playlist,
    items_in: list[PlaylistItemIn],
) -> None:
    for draft in items_in:
        await _validate_item_refs(db, user, draft)

    playlist.items.clear()
    await db.flush()

    for index, draft in enumerate(items_in):
        order = draft.sort_order if draft.sort_order is not None else index
        playlist.items.append(
            PlaylistItem(
                id=new_id("pli"),
                playlist_id=playlist.id,
                organization_id=user.organization_id,
                sort_order=order,
                content_type=draft.content_type,
                duration_seconds=draft.duration_seconds,
                label=draft.label,
                menu_id=draft.menu_id,
                template_id=draft.template_id,
                media_asset_id=draft.media_asset_id,
                transition=draft.transition,
                meta={},
            )
        )


async def create_playlist(
    db: AsyncSession, user: User, body: PlaylistCreate
) -> Playlist:
    require_permission(user, PLAYLISTS_CREATE)
    playlist = Playlist(
        id=new_id("pl"),
        organization_id=user.organization_id,
        name=body.name.strip(),
        description=body.description or "",
        status="draft",
        version=1,
        priority=body.priority,
        loop=body.loop,
        published_at=None,
        created_by_user_id=user.id,
    )
    db.add(playlist)
    await db.flush()
    if body.items:
        await _replace_items(db, user, playlist, body.items)
    await db.commit()
    return await get_org_playlist_or_404(db, user, playlist.id)


async def update_playlist(
    db: AsyncSession, user: User, playlist_id: str, body: PlaylistUpdate
) -> Playlist:
    require_permission(user, PLAYLISTS_UPDATE)
    playlist = await get_org_playlist_or_404(db, user, playlist_id)
    if body.name is not None:
        playlist.name = body.name.strip()
    if body.description is not None:
        playlist.description = body.description
    if body.loop is not None:
        playlist.loop = body.loop
    if body.priority is not None:
        playlist.priority = body.priority
    if body.status is not None:
        if body.status not in PLAYLIST_STATUSES:
            raise HTTPException(status_code=400, detail="Invalid status")
        playlist.status = body.status
        if body.status == "archived":
            # Detach from screens when archived
            result = await db.execute(
                select(Screen).where(
                    Screen.active_playlist_id == playlist.id,
                    Screen.organization_id == user.organization_id,
                )
            )
            for screen in result.scalars().all():
                screen.active_playlist_id = None
    if body.items is not None:
        await _replace_items(db, user, playlist, body.items)
    playlist.updated_at = _utcnow()
    await db.commit()
    return await get_org_playlist_or_404(db, user, playlist.id)


async def delete_playlist(db: AsyncSession, user: User, playlist_id: str) -> None:
    require_permission(user, PLAYLISTS_DELETE)
    playlist = await get_org_playlist_or_404(db, user, playlist_id, load_items=False)
    result = await db.execute(
        select(Screen).where(
            Screen.active_playlist_id == playlist.id,
            Screen.organization_id == user.organization_id,
        )
    )
    for screen in result.scalars().all():
        screen.active_playlist_id = None
    await db.delete(playlist)
    await db.commit()


async def stamp_playlist_published(
    db: AsyncSession,
    user: User,
    playlist: Playlist,
    *,
    bump_version: bool = True,
    change_summary: str | None = None,
) -> None:
    """Bump version and snapshot. Does not assign screens or commit."""
    from app.services import content_versions as cv_service
    from app.services.audit import record_audit

    require_permission(user, PLAYLISTS_PUBLISH)
    if playlist.status == "archived":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Archived playlists cannot be published",
        )
    if not playlist.items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Add at least one slide before publishing",
        )

    now = _utcnow()
    if bump_version:
        playlist.version = int(playlist.version or 0) + 1
    playlist.status = "published"
    playlist.published_at = now
    playlist.published_by_user_id = user.id
    playlist.updated_at = now

    snapshot = await cv_service.build_playlist_snapshot(db, playlist)
    playlist.published_snapshot = snapshot
    ver = await cv_service.record_content_version(
        db,
        organization_id=user.organization_id,
        entity_type="playlist",
        entity_id=playlist.id,
        version=playlist.version,
        snapshot=snapshot,
        publisher=user,
        change_summary=change_summary,
    )
    await record_audit(
        db,
        organization_id=user.organization_id,
        action="playlist.published",
        actor=user,
        metadata={
            "playlistId": playlist.id,
            "version": playlist.version,
            "versionId": ver.id,
            "changeSummary": change_summary,
        },
    )


async def publish_playlist(
    db: AsyncSession,
    user: User,
    playlist_id: str,
    screen_ids: list[str],
    *,
    bump_version: bool = True,
    change_summary: str | None = None,
) -> tuple[Playlist, list[Screen]]:
    playlist = await get_org_playlist_or_404(db, user, playlist_id)
    await stamp_playlist_published(
        db,
        user,
        playlist,
        bump_version=bump_version,
        change_summary=change_summary,
    )

    updated: list[Screen] = []
    if screen_ids:
        result = await db.execute(
            select(Screen).where(
                Screen.id.in_(screen_ids),
                Screen.organization_id == user.organization_id,
            )
        )
        for screen in result.scalars().all():
            screen.active_playlist_id = playlist.id
            updated.append(screen)

    await db.commit()
    playlist = await get_org_playlist_or_404(db, user, playlist.id)
    return playlist, updated


def playlist_to_out(playlist: Playlist) -> dict:
    items = sorted(playlist.items or [], key=lambda i: i.sort_order)
    return {
        "id": playlist.id,
        "organization_id": playlist.organization_id,
        "name": playlist.name,
        "description": playlist.description or "",
        "status": playlist.status,
        "version": playlist.version,
        "priority": playlist.priority,
        "loop": playlist.loop,
        "published_at": playlist.published_at,
        "created_by_user_id": playlist.created_by_user_id,
        "published_by_user_id": getattr(playlist, "published_by_user_id", None),
        "created_at": playlist.created_at,
        "updated_at": playlist.updated_at,
        "items": items,
        "item_count": len(items),
    }


async def count_items(db: AsyncSession, playlist_id: str) -> int:
    result = await db.execute(
        select(func.count())
        .select_from(PlaylistItem)
        .where(PlaylistItem.playlist_id == playlist_id)
    )
    return int(result.scalar_one())
