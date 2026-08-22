"""Audio playlist CRUD and publish helpers."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.access import get_org_screen_or_404
from app.auth.permissions import (
    AUDIO_CREATE,
    AUDIO_DELETE,
    AUDIO_PUBLISH,
    AUDIO_READ,
    AUDIO_UPDATE,
    require_permission,
)
from app.schemas.audio_playlist import (
    AudioPlaylistCreate,
    AudioPlaylistUpdate,
    AudioTrackIn,
)
from app.utils.ids import new_id
from db.models import MediaAsset, Screen, User
from db.models.audio_playlist import (
    AUDIO_PLAYLIST_STATUSES,
    AudioPlaylist,
    AudioPlaylistTrack,
)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


async def get_org_audio_playlist_or_404(
    db: AsyncSession, user: User, playlist_id: str, *, load_tracks: bool = True
) -> AudioPlaylist:
    require_permission(user, AUDIO_READ)
    stmt = select(AudioPlaylist).where(
        AudioPlaylist.id == playlist_id,
        AudioPlaylist.organization_id == user.organization_id,
    )
    if load_tracks:
        stmt = stmt.options(selectinload(AudioPlaylist.tracks))
    result = await db.execute(stmt)
    playlist = result.scalar_one_or_none()
    if playlist is None:
        raise HTTPException(status_code=404, detail="Audio playlist not found")
    return playlist


async def list_audio_playlists(
    db: AsyncSession,
    user: User,
    *,
    status_filter: str | None = None,
    q: str | None = None,
) -> list[AudioPlaylist]:
    require_permission(user, AUDIO_READ)
    stmt = (
        select(AudioPlaylist)
        .where(AudioPlaylist.organization_id == user.organization_id)
        .options(selectinload(AudioPlaylist.tracks))
        .order_by(AudioPlaylist.updated_at.desc())
    )
    if status_filter:
        if status_filter not in AUDIO_PLAYLIST_STATUSES:
            raise HTTPException(status_code=400, detail="Invalid status filter")
        stmt = stmt.where(AudioPlaylist.status == status_filter)
    if q and q.strip():
        like = f"%{q.strip()}%"
        stmt = stmt.where(AudioPlaylist.name.ilike(like))
    result = await db.execute(stmt)
    return list(result.scalars().unique().all())


async def _validate_tracks(
    db: AsyncSession, user: User, tracks: list[AudioTrackIn]
) -> None:
    for t in tracks:
        asset = await db.get(MediaAsset, t.media_asset_id)
        if asset is None or asset.organization_id != user.organization_id:
            raise HTTPException(status_code=400, detail="Audio asset not found")
        if asset.kind != "audio" and not (asset.mime_type or "").startswith("audio/"):
            raise HTTPException(
                status_code=400,
                detail=f"Asset {asset.name} is not audio",
            )


async def _replace_tracks(
    db: AsyncSession,
    playlist: AudioPlaylist,
    tracks: list[AudioTrackIn],
) -> None:
    # Explicit query — avoid lazy-loading playlist.tracks (MissingGreenlet under async).
    existing = await db.execute(
        select(AudioPlaylistTrack).where(
            AudioPlaylistTrack.audio_playlist_id == playlist.id
        )
    )
    for row in existing.scalars().all():
        await db.delete(row)
    await db.flush()
    for idx, t in enumerate(tracks):
        db.add(
            AudioPlaylistTrack(
                id=new_id("atr"),
                audio_playlist_id=playlist.id,
                organization_id=playlist.organization_id,
                sort_order=t.sort_order if t.sort_order is not None else idx,
                media_asset_id=t.media_asset_id,
                label=(t.label.strip() if t.label else None) or None,
                created_at=_utcnow(),
            )
        )


async def create_audio_playlist(
    db: AsyncSession, user: User, body: AudioPlaylistCreate
) -> AudioPlaylist:
    require_permission(user, AUDIO_CREATE)
    await _validate_tracks(db, user, body.tracks)
    now = _utcnow()
    playlist = AudioPlaylist(
        id=new_id("apl"),
        organization_id=user.organization_id,
        name=body.name.strip(),
        description=body.description or "",
        status="draft",
        version=1,
        loop=body.loop,
        volume=max(0.0, min(1.0, body.volume)),
        created_by_user_id=user.id,
        created_at=now,
        updated_at=now,
    )
    db.add(playlist)
    await db.flush()
    if body.tracks:
        await _replace_tracks(db, playlist, body.tracks)
    await db.commit()
    return await get_org_audio_playlist_or_404(db, user, playlist.id)


async def update_audio_playlist(
    db: AsyncSession, user: User, playlist_id: str, body: AudioPlaylistUpdate
) -> AudioPlaylist:
    require_permission(user, AUDIO_UPDATE)
    playlist = await get_org_audio_playlist_or_404(db, user, playlist_id)
    if body.name is not None:
        playlist.name = body.name.strip()
    if body.description is not None:
        playlist.description = body.description
    if body.loop is not None:
        playlist.loop = body.loop
    if body.volume is not None:
        playlist.volume = max(0.0, min(1.0, body.volume))
    if body.status is not None:
        if body.status not in AUDIO_PLAYLIST_STATUSES:
            raise HTTPException(status_code=400, detail="Invalid status")
        playlist.status = body.status
    if body.tracks is not None:
        await _validate_tracks(db, user, body.tracks)
        await _replace_tracks(db, playlist, body.tracks)
    playlist.updated_at = _utcnow()
    await db.commit()
    return await get_org_audio_playlist_or_404(db, user, playlist.id)


async def delete_audio_playlist(
    db: AsyncSession, user: User, playlist_id: str
) -> None:
    require_permission(user, AUDIO_DELETE)
    playlist = await get_org_audio_playlist_or_404(
        db, user, playlist_id, load_tracks=False
    )
    await db.delete(playlist)
    await db.commit()


async def _build_snapshot(
    db: AsyncSession, playlist: AudioPlaylist
) -> dict:
    tracks_out = []
    for t in sorted(playlist.tracks, key=lambda x: x.sort_order):
        asset = await db.get(MediaAsset, t.media_asset_id)
        if asset is None:
            continue
        tracks_out.append(
            {
                "id": t.id,
                "mediaAssetId": asset.id,
                "url": asset.url,
                "mimeType": asset.mime_type,
                "name": t.label or asset.name,
                "durationSeconds": asset.duration_seconds,
                "sortOrder": t.sort_order,
            }
        )
    return {
        "id": playlist.id,
        "name": playlist.name,
        "version": playlist.version,
        "loop": playlist.loop,
        "volume": playlist.volume,
        "tracks": tracks_out,
    }


async def publish_audio_playlist(
    db: AsyncSession,
    user: User,
    playlist_id: str,
    screen_ids: list[str],
    *,
    bump_version: bool = True,
) -> tuple[AudioPlaylist, list[Screen]]:
    require_permission(user, AUDIO_PUBLISH)
    playlist = await get_org_audio_playlist_or_404(db, user, playlist_id)
    if not playlist.tracks:
        raise HTTPException(status_code=400, detail="Add at least one audio track")

    if bump_version:
        playlist.version = int(playlist.version or 1) + 1
    playlist.status = "published"
    playlist.published_at = _utcnow()
    playlist.published_by_user_id = user.id
    playlist.published_snapshot = await _build_snapshot(db, playlist)
    playlist.updated_at = _utcnow()

    screens: list[Screen] = []
    for sid in screen_ids:
        screen = await get_org_screen_or_404(db, user, sid)
        if screen.location_id is None or screen.status == "pairing":
            raise HTTPException(
                status_code=400, detail=f"Screen {screen.name} is not paired"
            )
        screen.active_audio_playlist_id = playlist.id
        screens.append(screen)

    await db.commit()
    playlist = await get_org_audio_playlist_or_404(db, user, playlist.id)
    return playlist, screens


def playlist_to_out_base(playlist: AudioPlaylist) -> dict:
    return {
        "id": playlist.id,
        "organization_id": playlist.organization_id,
        "name": playlist.name,
        "description": playlist.description or "",
        "status": playlist.status,
        "version": playlist.version,
        "loop": playlist.loop,
        "volume": float(playlist.volume or 0.5),
        "published_at": playlist.published_at,
        "created_by_user_id": playlist.created_by_user_id,
        "published_by_user_id": playlist.published_by_user_id,
        "created_at": playlist.created_at,
        "updated_at": playlist.updated_at,
        "track_count": len(playlist.tracks or []),
    }
