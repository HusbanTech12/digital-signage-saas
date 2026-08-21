"""Org / location ownership checks — enforce at the query layer."""

from fastapi import HTTPException, status
from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.permissions import (
    ALWAYS_ALL_LOCATIONS_ROLES,
    has_permission,
)
from db.models import Location, Screen, User

Role = str  # super_admin | admin | location_manager | content_manager | viewer


def require_roles(user: User, *roles: Role) -> None:
    if getattr(user, "status", "active") == "suspended":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is suspended",
        )
    if user.role not in roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient role for this action",
        )


def assert_same_org(user: User, organization_id: str) -> None:
    if user.organization_id != organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Organization mismatch",
        )


def can_access_location(user: User, location_id: str) -> bool:
    if user.role in ALWAYS_ALL_LOCATIONS_ROLES:
        return True
    ids = user.location_ids or []
    if user.role == "content_manager" and not ids:
        return True
    return location_id in ids


def assert_location_access(user: User, location_id: str) -> None:
    if not can_access_location(user, location_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No access to this location",
        )


def scope_locations_query(user: User) -> Select[tuple[Location]]:
    """Return a Select already filtered to locations the user may see."""
    stmt = select(Location).where(Location.organization_id == user.organization_id)
    if user.role in ALWAYS_ALL_LOCATIONS_ROLES:
        return stmt
    if user.role == "content_manager" and not (user.location_ids or []):
        return stmt
    ids = user.location_ids or []
    return stmt.where(Location.id.in_(ids))


def scope_screens_query(user: User) -> Select[tuple[Screen]]:
    stmt = select(Screen).where(Screen.organization_id == user.organization_id)
    if user.role in ALWAYS_ALL_LOCATIONS_ROLES:
        return stmt
    if user.role == "content_manager" and not (user.location_ids or []):
        return stmt
    ids = user.location_ids or []
    return stmt.where(Screen.location_id.in_(ids))


async def get_org_location_or_404(
    db: AsyncSession, user: User, location_id: str
) -> Location:
    result = await db.execute(
        select(Location).where(
            Location.id == location_id,
            Location.organization_id == user.organization_id,
        )
    )
    location = result.scalar_one_or_none()
    if location is None:
        raise HTTPException(status_code=404, detail="Location not found")
    assert_location_access(user, location.id)
    return location


async def get_org_screen_or_404(
    db: AsyncSession, user: User, screen_id: str
) -> Screen:
    result = await db.execute(
        select(Screen).where(
            Screen.id == screen_id,
            Screen.organization_id == user.organization_id,
        )
    )
    screen = result.scalar_one_or_none()
    if screen is None:
        raise HTTPException(status_code=404, detail="Screen not found")
    if screen.location_id:
        assert_location_access(user, screen.location_id)
    elif user.role not in ALWAYS_ALL_LOCATIONS_ROLES and user.role != "content_manager":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No access to unpaired screens outside your locations",
        )
    return screen


def require_perm(user: User, permission: str) -> None:
    if not has_permission(user, permission):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Missing permission: {permission}",
        )
