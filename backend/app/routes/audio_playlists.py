from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.clerk import get_current_user
from app.schemas.audio_playlist import (
    AudioPlaylistCreate,
    AudioPlaylistListOut,
    AudioPlaylistOut,
    AudioPlaylistUpdate,
    AudioTrackOut,
    PublishAudioPlaylistIn,
)
from app.schemas.display import RealtimeEvent
from app.services import audio_playlist as audio_service
from app.services.display_content import build_display_payload
from app.services.realtime import get_realtime_hub
from db.models import MediaAsset, User
from db.session import get_db

router = APIRouter(prefix="/api/v1/audio-playlists", tags=["audio-playlists"])


async def _track_out(db: AsyncSession, track) -> AudioTrackOut:
    asset = await db.get(MediaAsset, track.media_asset_id)
    return AudioTrackOut(
        id=track.id,
        audio_playlist_id=track.audio_playlist_id,
        organization_id=track.organization_id,
        sort_order=track.sort_order,
        media_asset_id=track.media_asset_id,
        label=track.label,
        media_name=asset.name if asset else None,
        media_url=asset.url if asset else None,
        media_mime_type=asset.mime_type if asset else None,
        duration_seconds=float(asset.duration_seconds)
        if asset and asset.duration_seconds is not None
        else None,
        created_at=track.created_at,
    )


async def _to_out(db: AsyncSession, playlist) -> AudioPlaylistOut:
    base = audio_service.playlist_to_out_base(playlist)
    tracks = [await _track_out(db, t) for t in (playlist.tracks or [])]
    return AudioPlaylistOut.model_validate({**base, "tracks": tracks})


@router.get("", response_model=AudioPlaylistListOut)
async def list_audio_playlists(
    status: str | None = Query(default=None),
    q: str | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AudioPlaylistListOut:
    rows = await audio_service.list_audio_playlists(
        db, user, status_filter=status, q=q
    )
    playlists = [await _to_out(db, p) for p in rows]
    return AudioPlaylistListOut(audio_playlists=playlists, total=len(playlists))


@router.post("", response_model=AudioPlaylistOut, status_code=status.HTTP_201_CREATED)
async def create_audio_playlist(
    body: AudioPlaylistCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AudioPlaylistOut:
    playlist = await audio_service.create_audio_playlist(db, user, body)
    return await _to_out(db, playlist)


@router.get("/{playlist_id}", response_model=AudioPlaylistOut)
async def get_audio_playlist(
    playlist_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AudioPlaylistOut:
    playlist = await audio_service.get_org_audio_playlist_or_404(db, user, playlist_id)
    return await _to_out(db, playlist)


@router.patch("/{playlist_id}", response_model=AudioPlaylistOut)
async def update_audio_playlist(
    playlist_id: str,
    body: AudioPlaylistUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AudioPlaylistOut:
    playlist = await audio_service.update_audio_playlist(db, user, playlist_id, body)
    return await _to_out(db, playlist)


@router.delete("/{playlist_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_audio_playlist(
    playlist_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    await audio_service.delete_audio_playlist(db, user, playlist_id)


@router.post("/{playlist_id}/publish", response_model=AudioPlaylistOut)
async def publish_audio_playlist(
    playlist_id: str,
    body: PublishAudioPlaylistIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AudioPlaylistOut:
    playlist, screens = await audio_service.publish_audio_playlist(
        db,
        user,
        playlist_id,
        body.screen_ids,
        bump_version=body.bump_version,
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
                type="audio.published",
                screen_id=screen.id,
                payload=payload.model_dump(by_alias=True, mode="json"),
                ts=now,
            )
        )
    return await _to_out(db, playlist)
