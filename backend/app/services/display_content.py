from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.display import DisplayPayloadOut
from app.schemas.menu import MenuItemOut
from db.models import Menu, MenuItem, Screen, Template


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _item_out(item: MenuItem) -> MenuItemOut:
    return MenuItemOut(
        id=item.id,
        menu_id=item.menu_id,
        organization_id=item.organization_id,
        name=item.name,
        price=float(item.price if isinstance(item.price, Decimal) else item.price),
        description=item.description or "",
        image_url=item.image_url,
        available=item.available,
        sort_order=item.sort_order,
        category=item.category,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


async def build_display_payload(
    db: AsyncSession, screen: Screen
) -> DisplayPayloadOut | None:
    """Build kiosk content for a paired screen. Returns None while still pairing."""
    if screen.location_id is None or screen.status == "pairing":
        return None

    menu: Menu | None = None
    if screen.active_menu_id:
        menu = await db.get(Menu, screen.active_menu_id)

    template: Template | None = None
    if screen.active_template_id:
        template = await db.get(Template, screen.active_template_id)

    items: list[MenuItemOut] = []
    if menu is not None:
        result = await db.execute(
            select(MenuItem)
            .where(MenuItem.menu_id == menu.id)
            .order_by(MenuItem.sort_order, MenuItem.name)
        )
        items = [_item_out(i) for i in result.scalars().all()]

    canvas = None
    if template is not None and isinstance(template.canvas_json, dict):
        canvas = template.canvas_json

    display_config = None
    if template is not None and isinstance(template.display_config, dict):
        display_config = template.display_config or None

    return DisplayPayloadOut(
        screen_id=screen.id,
        screen_name=screen.name,
        organization_id=screen.organization_id,
        orientation=screen.orientation,
        resolution=screen.resolution,
        menu_id=menu.id if menu else None,
        menu_name=menu.name if menu else None,
        menu_version=menu.version if menu else None,
        template_id=template.id if template else None,
        template_name=template.name if template else None,
        canvas_json=canvas,
        display_config=display_config,
        items=items,
        updated_at=_utcnow(),
    )
