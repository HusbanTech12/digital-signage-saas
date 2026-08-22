from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.clerk import get_current_user
from app.schemas.display import RealtimeEvent
from app.schemas.playlist import (
    PlaylistCreate,
    PlaylistListOut,
    PlaylistOut,
    PlaylistUpdate,
    PublishPlaylistIn,
)
from app.services import playlist as playlist_service
from app.services.display_content import build_display_payload
from app.services.realtime import get_realtime_hub
from db.models import User
from db.session import get_db

router = APIRouter(prefix="/api/v1/playlists", tags=["playlists"])


def _to_out(playlist) -> PlaylistOut:
    data = playlist_service.playlist_to_out(playlist)
    return PlaylistOut.model_validate(data)


@router.get("", response_model=PlaylistListOut)
async def list_playlists(
    status: str | None = Query(default=None),
    q: str | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PlaylistListOut:
    rows = await playlist_service.list_playlists(
        db, user, status_filter=status, q=q
    )
    playlists = [_to_out(p) for p in rows]
    return PlaylistListOut(playlists=playlists, total=len(playlists))


@router.post("", response_model=PlaylistOut, status_code=status.HTTP_201_CREATED)
async def create_playlist(
    body: PlaylistCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PlaylistOut:
    playlist = await playlist_service.create_playlist(db, user, body)
    return _to_out(playlist)


@router.get("/{playlist_id}", response_model=PlaylistOut)
async def get_playlist(
    playlist_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PlaylistOut:
    playlist = await playlist_service.get_org_playlist_or_404(db, user, playlist_id)
    return _to_out(playlist)


@router.patch("/{playlist_id}", response_model=PlaylistOut)
async def update_playlist(
    playlist_id: str,
    body: PlaylistUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PlaylistOut:
    playlist = await playlist_service.update_playlist(db, user, playlist_id, body)
    return _to_out(playlist)


@router.delete("/{playlist_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_playlist(
    playlist_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    await playlist_service.delete_playlist(db, user, playlist_id)


@router.post("/{playlist_id}/publish", response_model=PlaylistOut)
async def publish_playlist(
    playlist_id: str,
    body: PublishPlaylistIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PlaylistOut:
    playlist, screens = await playlist_service.publish_playlist(
        db,
        user,
        playlist_id,
        body.screen_ids,
        bump_version=body.bump_version,
        change_summary=body.change_summary,
    )
    hub = get_realtime_hub()
    now = playlist.published_at
    for screen in screens:
        await db.refresh(screen)
        payload = await build_display_payload(db, screen)
        if payload is None or now is None:
            continue
        await hub.publish_event(
            RealtimeEvent(
                type="playlist.published",
                screen_id=screen.id,
                payload=payload.model_dump(by_alias=True, mode="json"),
                ts=now,
            )
        )
    return _to_out(playlist)
