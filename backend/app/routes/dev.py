"""Development-only seed endpoint matching frontend mock-data.ts."""

from copy import deepcopy
from datetime import date, datetime, time, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from db.models import (
    Location,
    Menu,
    MenuItem,
    Organization,
    Screen,
    Template,
    Theme,
    User,
)
from db.session import get_db

router = APIRouter(prefix="/api/v1/dev", tags=["dev"])

CLASSIC_CANVAS = {
    "version": "6.0.0",
    "background": "#111827",
    "objects": [
        {
            "type": "textbox",
            "left": 48,
            "top": 28,
            "width": 700,
            "fill": "#f8fafc",
            "fontSize": 40,
            "fontFamily": "Georgia, serif",
            "fontWeight": "600",
            "text": "Harbor & Hearth",
            "editable": True,
        }
    ],
    "width": 1920,
    "height": 1080,
}

PORTRAIT_CANVAS = {
    "version": "6.0.0",
    "background": "#18181b",
    "objects": [
        {
            "type": "textbox",
            "left": 40,
            "top": 60,
            "width": 1000,
            "fill": "#fafafa",
            "fontSize": 48,
            "fontFamily": "Georgia, serif",
            "fontWeight": "700",
            "text": "Today's Special",
            "editable": True,
        }
    ],
    "width": 1920,
    "height": 1080,
}


@router.post("/seed")
async def seed_demo_data(
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Upsert Harbor & Hearth demo data from mock-data.ts.
    Safe to call repeatedly.
    """
    settings = get_settings()
    if settings.app_env not in ("development", "dev", "local"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Not found",
        )

    now = datetime(2026, 1, 10, 10, 0, 0, tzinfo=timezone.utc)

    org = await db.get(Organization, "org_demo_001")
    if org is None:
        db.add(
            Organization(
                id="org_demo_001",
                name="Harbor & Hearth",
                slug="harbor-and-hearth",
                created_at=now,
            )
        )
    else:
        org.name = "Harbor & Hearth"
        org.slug = "harbor-and-hearth"

    for loc in (
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
    ):
        existing = await db.get(Location, loc.id)
        if existing is None:
            db.add(loc)
        else:
            existing.name = loc.name
            existing.address = loc.address
            existing.timezone = loc.timezone

    for menu in (
        Menu(
            id="menu_all_day",
            organization_id="org_demo_001",
            name="All-Day Menu",
            version=4,
            published_at=datetime(2026, 7, 20, 12, 0, tzinfo=timezone.utc),
            created_at=datetime(2026, 1, 18, 10, 0, tzinfo=timezone.utc),
            updated_at=datetime(2026, 7, 20, 12, 0, tzinfo=timezone.utc),
        ),
        Menu(
            id="menu_breakfast",
            organization_id="org_demo_001",
            name="Breakfast Specials",
            version=2,
            published_at=datetime(2026, 6, 1, 8, 0, tzinfo=timezone.utc),
            created_at=datetime(2026, 3, 1, 9, 0, tzinfo=timezone.utc),
            updated_at=datetime(2026, 6, 1, 8, 0, tzinfo=timezone.utc),
        ),
    ):
        existing = await db.get(Menu, menu.id)
        if existing is None:
            db.add(menu)
        else:
            existing.name = menu.name
            existing.version = menu.version
            existing.published_at = menu.published_at
            existing.updated_at = menu.updated_at

    for item in (
        MenuItem(
            id="item_latte",
            menu_id="menu_all_day",
            organization_id="org_demo_001",
            name="Harbor Latte",
            price=Decimal("4.75"),
            description="Double espresso with steamed milk and sea-salt caramel.",
            image_url=None,
            available=True,
            sort_order=1,
            category="Drinks",
            created_at=datetime(2026, 1, 18, 10, 5, tzinfo=timezone.utc),
            updated_at=datetime(2026, 7, 20, 12, 0, tzinfo=timezone.utc),
        ),
        MenuItem(
            id="item_avocado",
            menu_id="menu_all_day",
            organization_id="org_demo_001",
            name="Avocado Toast",
            price=Decimal("11.50"),
            description="Sourdough, smashed avocado, chili flake, soft egg.",
            image_url=None,
            available=True,
            sort_order=2,
            category="Mains",
            created_at=datetime(2026, 1, 18, 10, 6, tzinfo=timezone.utc),
            updated_at=datetime(2026, 7, 20, 12, 0, tzinfo=timezone.utc),
        ),
        MenuItem(
            id="item_soup",
            menu_id="menu_all_day",
            organization_id="org_demo_001",
            name="Seasonal Soup",
            price=Decimal("8.00"),
            description="Chef's daily pot — ask your server.",
            image_url=None,
            available=False,
            sort_order=3,
            category="Mains",
            created_at=datetime(2026, 1, 18, 10, 7, tzinfo=timezone.utc),
            updated_at=datetime(2026, 7, 15, 9, 0, tzinfo=timezone.utc),
        ),
        MenuItem(
            id="item_burrito",
            menu_id="menu_breakfast",
            organization_id="org_demo_001",
            name="Sunrise Burrito",
            price=Decimal("9.25"),
            description="Eggs, black beans, cheddar, salsa verde.",
            image_url=None,
            available=True,
            sort_order=1,
            category="Breakfast",
            created_at=datetime(2026, 3, 1, 9, 10, tzinfo=timezone.utc),
            updated_at=datetime(2026, 6, 1, 8, 0, tzinfo=timezone.utc),
        ),
    ):
        existing = await db.get(MenuItem, item.id)
        if existing is None:
            db.add(item)
        else:
            existing.name = item.name
            existing.price = item.price
            existing.description = item.description
            existing.available = item.available
            existing.sort_order = item.sort_order
            existing.category = item.category

    for tpl in (
        Template(
            id="tpl_classic_board",
            organization_id=None,
            name="Classic Board",
            description="Two-column menu with prices aligned right.",
            thumbnail_url=None,
            is_global=True,
            canvas_json=deepcopy(CLASSIC_CANVAS),
            created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
            updated_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
        ),
        Template(
            id="tpl_portrait_promo",
            organization_id="org_demo_001",
            name="Portrait Promo",
            description="Tall layout for counter tablets and portrait TVs.",
            thumbnail_url=None,
            is_global=False,
            canvas_json=deepcopy(PORTRAIT_CANVAS),
            created_at=datetime(2026, 2, 10, tzinfo=timezone.utc),
            updated_at=datetime(2026, 4, 1, tzinfo=timezone.utc),
        ),
    ):
        existing = await db.get(Template, tpl.id)
        if existing is None:
            db.add(tpl)
        else:
            existing.name = tpl.name
            existing.description = tpl.description
            existing.is_global = tpl.is_global
            existing.organization_id = tpl.organization_id
            existing.canvas_json = deepcopy(tpl.canvas_json)

    # Flush so screen FKs to menus/templates resolve.
    await db.flush()

    screens = [
        Screen(
            id="scr_lobby_left",
            location_id="loc_downtown",
            organization_id="org_demo_001",
            name="Lobby Left",
            device_token="devtok_lobby_left_demo",
            pairing_code=None,
            last_heartbeat=datetime.now(timezone.utc),
            resolution="1920x1080",
            orientation="landscape",
            status="online",
            active_menu_id="menu_all_day",
            active_template_id="tpl_classic_board",
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
            active_menu_id="menu_all_day",
            active_template_id="tpl_portrait_promo",
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
            existing.active_menu_id = scr.active_menu_id
            existing.active_template_id = scr.active_template_id

    for u in (
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
    ):
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

    for theme in (
        Theme(
            id="theme_breakfast",
            organization_id="org_demo_001",
            name="Breakfast Window",
            kind="time_of_day",
            start_time=time(6, 0),
            end_time=time(11, 0),
            start_date=None,
            end_date=None,
            menu_id="menu_breakfast",
            template_id="tpl_classic_board",
            location_ids=["loc_downtown"],
            enabled=True,
            created_at=datetime(2026, 3, 5, tzinfo=timezone.utc),
        ),
        Theme(
            id="theme_holiday",
            organization_id="org_demo_001",
            name="Holiday Season",
            kind="date_range",
            start_time=None,
            end_time=None,
            start_date=date(2026, 12, 1),
            end_date=date(2026, 12, 31),
            menu_id="menu_all_day",
            template_id="tpl_portrait_promo",
            location_ids=["loc_downtown", "loc_airport"],
            enabled=False,
            created_at=datetime(2026, 6, 1, tzinfo=timezone.utc),
        ),
    ):
        existing = await db.get(Theme, theme.id)
        if existing is None:
            db.add(theme)
        else:
            existing.name = theme.name
            existing.kind = theme.kind
            existing.start_time = theme.start_time
            existing.end_time = theme.end_time
            existing.start_date = theme.start_date
            existing.end_date = theme.end_date
            existing.menu_id = theme.menu_id
            existing.template_id = theme.template_id
            existing.location_ids = theme.location_ids
            existing.enabled = theme.enabled

    await db.commit()
    return {
        "ok": True,
        "organizationId": "org_demo_001",
        "demoPairingCode": "482917",
        "menus": ["menu_all_day", "menu_breakfast"],
        "templates": ["tpl_classic_board", "tpl_portrait_promo"],
        "themes": ["theme_breakfast", "theme_holiday"],
        "devAuthUsers": [
            "user_clerk_super_demo",
            "user_clerk_admin_demo",
            "user_clerk_mgr_demo",
        ],
    }
