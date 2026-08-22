"""Pairing helpers shared by public kiosk and authenticated dashboard routes."""

from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.pairing import PendingPairingOut
from app.utils.ids import new_device_token, new_id, random_pairing_code
from db.models import Organization, Screen

PAIRING_TTL = timedelta(minutes=15)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def pairing_expires_at(started_at: datetime) -> datetime:
    if started_at.tzinfo is None:
        started_at = started_at.replace(tzinfo=timezone.utc)
    return started_at + PAIRING_TTL


def _effective_pairing_expires(screen: Screen) -> datetime:
    if screen.pairing_expires_at is not None:
        expires = screen.pairing_expires_at
        if expires.tzinfo is None:
            return expires.replace(tzinfo=timezone.utc)
        return expires
    started = screen.last_heartbeat or screen.created_at
    return pairing_expires_at(started)


def assert_pairing_not_expired(screen: Screen) -> None:
    if screen.status != "pairing" or not screen.pairing_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired pairing code.",
        )
    if _effective_pairing_expires(screen) < utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Pairing code expired. Refresh the screen and try again.",
        )


def to_pending_pairing(screen: Screen) -> PendingPairingOut:
    started = screen.last_heartbeat or screen.created_at
    return PendingPairingOut(
        code=screen.pairing_code or "",
        screen_id=screen.id,
        created_at=started,
        expires_at=_effective_pairing_expires(screen),
    )


async def create_pairing_session(
    db: AsyncSession,
    *,
    organization_id: str,
    resolution: str = "1920x1080",
    orientation: str = "landscape",
) -> Screen:
    org = await db.get(Organization, organization_id)
    if org is None:
        raise HTTPException(status_code=404, detail="Organization not found")

    # Avoid colliding active codes within the org.
    code = random_pairing_code()
    for _ in range(8):
        existing = await db.execute(
            select(Screen).where(
                Screen.organization_id == organization_id,
                Screen.pairing_code == code,
                Screen.status == "pairing",
            )
        )
        if existing.scalar_one_or_none() is None:
            break
        code = random_pairing_code()

    now = utcnow()
    expires = pairing_expires_at(now)
    screen = Screen(
        id=new_id("scr"),
        location_id=None,
        organization_id=organization_id,
        name="Unpaired screen",
        device_token=new_device_token(),
        pairing_code=code,
        last_heartbeat=now,
        resolution=resolution,
        orientation=orientation,
        status="pairing",
        active_menu_id=None,
        active_template_id=None,
        pairing_expires_at=expires,
        created_at=now,
    )
    db.add(screen)
    await db.commit()
    await db.refresh(screen)
    return screen
