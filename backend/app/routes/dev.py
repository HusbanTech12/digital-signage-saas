"""Development-only seed endpoint matching frontend mock-data.ts."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from db.models import Location, Organization, Screen, User
from db.session import get_db

router = APIRouter(prefix="/api/v1/dev", tags=["dev"])


@router.post("/seed")
async def seed_demo_data(
    db: AsyncSession = Depends(get_db),
) -> dict:
    settings = get_settings()
    if settings.app_env not in ("development", "dev", "local"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Not found",
        )
    """
    Upsert Harbor & Hearth demo org/locations/screens/users from mock-data.ts.
    Safe to call repeatedly.
    """
    now = datetime(2026, 1, 10, 10, 0, 0, tzinfo=timezone.utc)

    org = await db.get(Organization, "org_demo_001")
    if org is None:
        org = Organization(
            id="org_demo_001",
            name="Harbor & Hearth",
            slug="harbor-and-hearth",
            created_at=now,
        )
        db.add(org)
    else:
        org.name = "Harbor & Hearth"
        org.slug = "harbor-and-hearth"

    locations = [
        Location(
            id="loc_downtown",
            organization_id="org_demo_001",
            name="Downtown Flagship",
            address="120 Market Street, Seattle, WA",
            timezone="America/Los_Angeles",
            created_at=datetime(2026, 1, 12, 9, 0, tzinfo=timezone.utc),
        ),
        Location(
            id="loc_airport",
            organization_id="org_demo_001",
            name="Airport Kiosk",
            address="Sea-Tac Terminal B, Seattle, WA",
            timezone="America/Los_Angeles",
            created_at=datetime(2026, 2, 1, 14, 30, tzinfo=timezone.utc),
        ),
    ]
    for loc in locations:
        existing = await db.get(Location, loc.id)
        if existing is None:
            db.add(loc)
        else:
            existing.name = loc.name
            existing.address = loc.address
            existing.timezone = loc.timezone

    screens = [
        Screen(
            id="scr_lobby_left",
            location_id="loc_downtown",
            organization_id="org_demo_001",
            name="Lobby Left",
            device_token="devtok_lobby_left_demo",
            pairing_code=None,
            last_heartbeat=datetime(2026, 8, 1, 18, 55, tzinfo=timezone.utc),
            resolution="1920x1080",
            orientation="landscape",
            status="online",
            active_menu_id=None,
            active_template_id=None,
            created_at=datetime(2026, 1, 15, 11, 0, tzinfo=timezone.utc),
        ),
        Screen(
            id="scr_counter",
            location_id="loc_downtown",
            organization_id="org_demo_001",
            name="Counter Board",
            device_token="devtok_counter_demo",
            pairing_code=None,
            last_heartbeat=datetime(2026, 8, 1, 17, 10, tzinfo=timezone.utc),
            resolution="1080x1920",
            orientation="portrait",
            status="offline",
            active_menu_id=None,
            active_template_id=None,
            created_at=datetime(2026, 1, 20, 16, 0, tzinfo=timezone.utc),
        ),
        Screen(
            id="scr_pairing",
            location_id=None,
            organization_id="org_demo_001",
            name="Unpaired screen",
            device_token="devtok_gate_b_pending",
            pairing_code="482917",
            last_heartbeat=datetime.now(timezone.utc),
            resolution="1920x1080",
            orientation="landscape",
            status="pairing",
            active_menu_id=None,
            active_template_id=None,
            created_at=datetime(2026, 7, 28, 8, 0, tzinfo=timezone.utc),
        ),
    ]
    for scr in screens:
        existing = await db.get(Screen, scr.id)
        if existing is None:
            db.add(scr)
        else:
            existing.location_id = scr.location_id
            existing.name = scr.name
            existing.device_token = scr.device_token
            existing.pairing_code = scr.pairing_code
            existing.last_heartbeat = scr.last_heartbeat
            existing.resolution = scr.resolution
            existing.orientation = scr.orientation
            existing.status = scr.status

    users = [
        User(
            id="user_super",
            clerk_user_id="user_clerk_super_demo",
            organization_id="org_demo_001",
            email="owner@harborhearth.demo",
            name="Alex Owner",
            role="super_admin",
            location_ids=[],
            created_at=datetime(2026, 1, 10, 10, 5, tzinfo=timezone.utc),
        ),
        User(
            id="user_admin",
            clerk_user_id="user_clerk_admin_demo",
            organization_id="org_demo_001",
            email="admin@harborhearth.demo",
            name="Jordan Admin",
            role="admin",
            location_ids=["loc_downtown", "loc_airport"],
            created_at=datetime(2026, 1, 11, 10, 0, tzinfo=timezone.utc),
        ),
        User(
            id="user_manager",
            clerk_user_id="user_clerk_mgr_demo",
            organization_id="org_demo_001",
            email="manager@harborhearth.demo",
            name="Sam Manager",
            role="location_manager",
            location_ids=["loc_downtown"],
            created_at=datetime(2026, 1, 12, 10, 0, tzinfo=timezone.utc),
        ),
    ]
    for u in users:
        result = await db.execute(
            select(User).where(User.clerk_user_id == u.clerk_user_id)
        )
        existing = result.scalar_one_or_none()
        if existing is None:
            db.add(u)
        else:
            existing.organization_id = u.organization_id
            existing.email = u.email
            existing.name = u.name
            existing.role = u.role
            existing.location_ids = u.location_ids

    await db.commit()
    return {
        "ok": True,
        "organizationId": "org_demo_001",
        "demoPairingCode": "482917",
        "devAuthUsers": [
            "user_clerk_super_demo",
            "user_clerk_admin_demo",
            "user_clerk_mgr_demo",
        ],
    }
