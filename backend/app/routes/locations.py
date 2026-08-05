from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.access import (
    assert_same_org,
    get_org_location_or_404,
    require_roles,
    scope_locations_query,
)
from app.auth.clerk import get_current_user
from app.schemas.location import LocationCreate, LocationOut, LocationUpdate
from app.utils.ids import new_id
from db.models import Location, Screen, User
from db.session import get_db

router = APIRouter(prefix="/api/v1/locations", tags=["locations"])


@router.get("", response_model=list[LocationOut])
async def list_locations(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[Location]:
    result = await db.execute(scope_locations_query(user).order_by(Location.name))
    return list(result.scalars().all())


@router.post("", response_model=LocationOut, status_code=status.HTTP_201_CREATED)
async def create_location(
    body: LocationCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Location:
    require_roles(user, "super_admin", "admin")
    assert_same_org(user, body.organization_id)

    location = Location(
        id=new_id("loc"),
        organization_id=body.organization_id,
        name=body.name.strip(),
        address=body.address.strip(),
        timezone=(body.timezone.strip() or "UTC"),
    )
    db.add(location)
    await db.commit()
    await db.refresh(location)
    return location


@router.patch("/{location_id}", response_model=LocationOut)
async def update_location(
    location_id: str,
    body: LocationUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Location:
    require_roles(user, "super_admin", "admin")
    location = await get_org_location_or_404(db, user, location_id)

    if body.name is not None:
        location.name = body.name.strip()
    if body.address is not None:
        location.address = body.address.strip()
    if body.timezone is not None:
        location.timezone = body.timezone.strip() or "UTC"

    await db.commit()
    await db.refresh(location)
    return location


@router.delete("/{location_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_location(
    location_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    require_roles(user, "super_admin")
    location = await get_org_location_or_404(db, user, location_id)

    screen_count = await db.scalar(
        select(func.count())
        .select_from(Screen)
        .where(Screen.location_id == location.id)
    )
    if screen_count and screen_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Move or remove screens before deleting this location.",
        )

    await db.delete(location)
    await db.commit()
