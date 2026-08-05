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
from app.schemas.screen import ScreenHeartbeatIn, ScreenOut, ScreenUpdate
from app.services.pairing import utcnow
from db.models import Location, Screen, User
from db.session import get_db

router = APIRouter(prefix="/api/v1/screens", tags=["screens"])


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


@router.post("/{screen_id}/heartbeat", response_model=ScreenOut)
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

    screen.last_heartbeat = utcnow()
    if screen.status == "offline":
        screen.status = "online"
    await db.commit()
    await db.refresh(screen)
    return screen
