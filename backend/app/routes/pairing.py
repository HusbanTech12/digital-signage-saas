from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.access import assert_location_access, assert_same_org, require_roles
from app.auth.clerk import get_current_user
from app.schemas.pairing import (
    PairingCompleteIn,
    PairingSessionCreate,
    PairingSessionOut,
)
from app.schemas.screen import ScreenOut
from app.services.pairing import (
    assert_pairing_not_expired,
    create_pairing_session,
    to_pending_pairing,
    utcnow,
)
from db.models import Location, Screen, User
from db.session import get_db

router = APIRouter(prefix="/api/v1/pairing", tags=["pairing"])


@router.post(
    "/sessions",
    response_model=PairingSessionOut,
    status_code=status.HTTP_201_CREATED,
)
async def start_pairing_session(
    body: PairingSessionCreate,
    db: AsyncSession = Depends(get_db),
) -> PairingSessionOut:
    """Public kiosk endpoint — creates an unpaired screen + 6-digit code."""
    screen = await create_pairing_session(
        db,
        organization_id=body.organization_id,
        resolution=body.resolution,
        orientation=body.orientation,
    )
    return PairingSessionOut(screen=screen, pairing=to_pending_pairing(screen))


@router.get("/sessions/{code}", response_model=PairingSessionOut)
async def get_pairing_session(
    code: str,
    db: AsyncSession = Depends(get_db),
) -> PairingSessionOut:
    """Optional lookup by code (dashboard preview)."""
    normalized = code.strip()
    result = await db.execute(
        select(Screen).where(
            Screen.pairing_code == normalized,
            Screen.status == "pairing",
        )
    )
    screen = result.scalar_one_or_none()
    if screen is None:
        raise HTTPException(
            status_code=404, detail="Invalid or expired pairing code."
        )
    try:
        assert_pairing_not_expired(screen)
    except HTTPException:
        raise
    return PairingSessionOut(screen=screen, pairing=to_pending_pairing(screen))


@router.post("/complete", response_model=ScreenOut)
async def complete_pairing(
    body: PairingCompleteIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Screen:
    require_roles(user, "super_admin", "admin", "location_manager")
    assert_same_org(user, body.organization_id)

    normalized = body.code.strip()
    result = await db.execute(
        select(Screen).where(
            Screen.pairing_code == normalized,
            Screen.status == "pairing",
            Screen.organization_id == body.organization_id,
        )
    )
    screen = result.scalar_one_or_none()
    if screen is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired pairing code.",
        )
    assert_pairing_not_expired(screen)

    location = await db.get(Location, body.location_id)
    if location is None or location.organization_id != body.organization_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Location not found in this organization.",
        )
    assert_location_access(user, location.id)

    screen.location_id = location.id
    screen.name = body.name.strip() or "Paired screen"
    if body.resolution is not None:
        screen.resolution = body.resolution.strip() or screen.resolution
    if body.orientation is not None:
        screen.orientation = body.orientation
    screen.pairing_code = None
    screen.pairing_expires_at = None
    screen.status = "online"
    screen.last_heartbeat = utcnow()

    await db.commit()
    await db.refresh(screen)
    return screen
