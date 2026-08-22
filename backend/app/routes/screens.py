from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.access import (
    assert_location_access,
    get_org_screen_or_404,
    require_roles,
    scope_screens_query,
)
from app.auth.clerk import get_current_user
from app.auth.permissions import SCREENS_UPDATE, require_permission
from app.schemas.display import DisplayPayloadOut, RealtimeEvent
from app.schemas.screen import (
    ScreenCommandOut,
    ScreenHeartbeatIn,
    ScreenHeartbeatOut,
    ScreenOut,
    ScreenUpdate,
)
from app.services.display_content import build_display_payload
from app.services.pairing import utcnow
from app.services.realtime import get_realtime_hub
from app.utils.ids import new_id
from db.models import Location, Screen, User
from db.session import get_db

router = APIRouter(prefix="/api/v1/screens", tags=["screens"])


def _truncate_error(msg: str | None, limit: int = 1000) -> str | None:
    if not msg:
        return None
    text = msg.strip()
    if not text:
        return None
    return text[:limit]


@router.get("", response_model=list[ScreenOut])
async def list_screens(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[Screen]:
    """List screens in scope. Admins also see unpaired (pairing) screens."""
    if user.role == "location_manager":
        result = await db.execute(scope_screens_query(user).order_by(Screen.name))
        return list(result.scalars().all())

    stmt = (
        select(Screen)
        .where(Screen.organization_id == user.organization_id)
        .order_by(Screen.name)
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get("/{screen_id}", response_model=ScreenOut)
async def get_screen(
    screen_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Screen:
    return await get_org_screen_or_404(db, user, screen_id)


@router.get("/{screen_id}/public", response_model=ScreenOut)
async def get_screen_public(
    screen_id: str,
    device_token: str,
    db: AsyncSession = Depends(get_db),
) -> Screen:
    """Kiosk poll after pairing — requires the screen's device token."""
    result = await db.execute(
        select(Screen).where(
            Screen.id == screen_id,
            Screen.device_token == device_token,
        )
    )
    screen = result.scalar_one_or_none()
    if screen is None:
        raise HTTPException(status_code=404, detail="Screen not found")
    return screen


@router.get("/{screen_id}/content", response_model=DisplayPayloadOut)
async def get_screen_content(
    screen_id: str,
    device_token: str,
    db: AsyncSession = Depends(get_db),
) -> DisplayPayloadOut:
    """Polling fallback for the kiosk — full menu/template snapshot."""
    result = await db.execute(
        select(Screen).where(
            Screen.id == screen_id,
            Screen.device_token == device_token,
        )
    )
    screen = result.scalar_one_or_none()
    if screen is None:
        raise HTTPException(status_code=404, detail="Screen not found")
    if screen.location_id is None or screen.status == "pairing":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Screen is still pairing",
        )
    payload = await build_display_payload(db, screen)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Screen is still pairing",
        )
    return payload


@router.patch("/{screen_id}", response_model=ScreenOut)
async def update_screen(
    screen_id: str,
    body: ScreenUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Screen:
    require_roles(user, "super_admin", "admin", "location_manager")
    screen = await get_org_screen_or_404(db, user, screen_id)

    if "location_id" in body.model_fields_set:
        if body.location_id is None:
            if user.role == "location_manager":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Location managers cannot unassign screens",
                )
            screen.location_id = None
        else:
            loc = await db.get(Location, body.location_id)
            if loc is None or loc.organization_id != user.organization_id:
                raise HTTPException(status_code=404, detail="Location not found")
            assert_location_access(user, loc.id)
            screen.location_id = loc.id

    if body.name is not None:
        screen.name = body.name.strip()
    if body.orientation is not None:
        screen.orientation = body.orientation
    if body.resolution is not None:
        screen.resolution = body.resolution.strip()
    if body.clear_audio_playlist:
        screen.active_audio_playlist_id = None
    elif body.active_audio_playlist_id is not None:
        screen.active_audio_playlist_id = body.active_audio_playlist_id
    if body.audio_volume is not None:
        screen.audio_volume = max(0.0, min(1.0, float(body.audio_volume)))
    if body.audio_muted is not None:
        screen.audio_muted = body.audio_muted
    if body.audio_loop is not None:
        screen.audio_loop = body.audio_loop

    await db.commit()
    await db.refresh(screen)
    return screen


@router.delete("/{screen_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_screen(
    screen_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    require_roles(user, "super_admin", "admin", "location_manager")
    screen = await get_org_screen_or_404(db, user, screen_id)
    await db.delete(screen)
    await db.commit()


@router.post("/{screen_id}/heartbeat", response_model=ScreenHeartbeatOut)
async def touch_heartbeat(
    screen_id: str,
    body: ScreenHeartbeatIn,
    db: AsyncSession = Depends(get_db),
) -> Screen:
    result = await db.execute(
        select(Screen).where(
            Screen.id == screen_id,
            Screen.device_token == body.device_token,
        )
    )
    screen = result.scalar_one_or_none()
    if screen is None:
        raise HTTPException(status_code=404, detail="Screen not found")
    if screen.location_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Screen is not paired yet",
        )

    now = utcnow()
    screen.last_heartbeat = now
    if screen.status == "offline":
        screen.status = "online"

    if body.last_sync_at is not None:
        screen.last_sync_at = body.last_sync_at
    if body.content_version is not None:
        screen.content_version = body.content_version
    if body.content_updated_at is not None:
        screen.content_updated_at = body.content_updated_at
    if body.current_content_summary is not None:
        screen.current_content_summary = body.current_content_summary[:512]
    if body.client_app_version is not None:
        screen.client_app_version = body.client_app_version[:64]

    err = _truncate_error(body.last_sync_error)
    if err:
        screen.last_error = err
        screen.last_error_at = now
    elif body.last_sync_at is not None and not body.last_sync_error:
        screen.last_error = None
        screen.last_error_at = None

    if (
        body.acked_command_id
        and screen.pending_command_id
        and body.acked_command_id == screen.pending_command_id
    ):
        screen.pending_command = None
        screen.pending_command_id = None
        screen.pending_command_at = None

    await db.commit()
    await db.refresh(screen)
    return screen


@router.post(
    "/{screen_id}/commands/refresh",
    response_model=ScreenCommandOut,
    status_code=status.HTTP_201_CREATED,
)
async def request_remote_refresh(
    screen_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ScreenCommandOut:
    """Queue a remote refresh; kiosk picks up via WebSocket or next heartbeat."""
    require_permission(user, SCREENS_UPDATE)
    screen = await get_org_screen_or_404(db, user, screen_id)
    if screen.location_id is None or screen.status == "pairing":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Screen must be paired before remote refresh",
        )

    now = utcnow()
    command_id = new_id("cmd")
    screen.pending_command = "refresh"
    screen.pending_command_id = command_id
    screen.pending_command_at = now
    await db.commit()
    await db.refresh(screen)

    hub = get_realtime_hub()
    await hub.publish_event(
        RealtimeEvent(
            type="device.refresh",
            screen_id=screen.id,
            payload={
                "command": "refresh",
                "commandId": command_id,
            },
            ts=now if isinstance(now, datetime) else datetime.now(timezone.utc),
        )
    )

    return ScreenCommandOut(
        screen_id=screen.id,
        command="refresh",
        command_id=command_id,
        created_at=screen.pending_command_at or now,
    )


@router.post("/{screen_id}/commands/clear-error", response_model=ScreenOut)
async def clear_screen_error(
    screen_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Screen:
    require_permission(user, SCREENS_UPDATE)
    screen = await get_org_screen_or_404(db, user, screen_id)
    screen.last_error = None
    screen.last_error_at = None
    await db.commit()
    await db.refresh(screen)
    return screen
