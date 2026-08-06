from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.access import assert_same_org, require_roles
from app.auth.clerk import get_current_user
from app.schemas.display import RealtimeEvent
from app.schemas.menu import (
    MenuCreate,
    MenuItemCreate,
    MenuItemOut,
    MenuItemUpdate,
    MenuOut,
    MenuUpdate,
    PublishMenuIn,
)
from app.services.display_content import build_display_payload
from app.services.realtime import get_realtime_hub
from app.utils.ids import new_id
from db.models import Menu, MenuItem, Screen, Template, User
from db.session import get_db

router = APIRouter(prefix="/api/v1", tags=["menus"])


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


async def _get_org_menu_or_404(
    db: AsyncSession, user: User, menu_id: str
) -> Menu:
    menu = await db.get(Menu, menu_id)
    if menu is None or menu.organization_id != user.organization_id:
        raise HTTPException(status_code=404, detail="Menu not found")
    return menu


async def _get_org_item_or_404(
    db: AsyncSession, user: User, item_id: str
) -> MenuItem:
    item = await db.get(MenuItem, item_id)
    if item is None or item.organization_id != user.organization_id:
        raise HTTPException(status_code=404, detail="Menu item not found")
    return item


# ── Menus ───────────────────────────────────────────────────────────────────


@router.get("/menus", response_model=list[MenuOut])
async def list_menus(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[Menu]:
    require_roles(user, "super_admin", "admin", "location_manager")
    result = await db.execute(
        select(Menu)
        .where(Menu.organization_id == user.organization_id)
        .order_by(Menu.name)
    )
    return list(result.scalars().all())


@router.post("/menus/publish", response_model=MenuOut)
async def publish_menu(
    body: PublishMenuIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Menu:
    require_roles(user, "super_admin", "admin", "location_manager")
    menu = await _get_org_menu_or_404(db, user, body.menu_id)

    template = await db.get(Template, body.template_id)
    if template is None:
        raise HTTPException(status_code=404, detail="Template not found")
    if not template.is_global and template.organization_id != user.organization_id:
        raise HTTPException(status_code=404, detail="Template not found")

    now = _utcnow()
    menu.version += 1
    menu.published_at = now
    menu.updated_at = now

    updated_screens: list[Screen] = []
    if body.screen_ids:
        result = await db.execute(
            select(Screen).where(
                Screen.id.in_(body.screen_ids),
                Screen.organization_id == user.organization_id,
            )
        )
        for screen in result.scalars().all():
            screen.active_menu_id = menu.id
            screen.active_template_id = template.id
            updated_screens.append(screen)

    await db.commit()
    await db.refresh(menu)

    # Fan-out realtime events (Redis pub/sub → WebSocket subscribers)
    hub = get_realtime_hub()
    for screen in updated_screens:
        await db.refresh(screen)
        payload = await build_display_payload(db, screen)
        if payload is None:
            continue
        await hub.publish_event(
            RealtimeEvent(
                type="menu.published",
                screen_id=screen.id,
                payload=payload.model_dump(by_alias=True, mode="json"),
                ts=now,
            )
        )

    return menu


@router.get("/menus/{menu_id}", response_model=MenuOut)
async def get_menu(
    menu_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Menu:
    require_roles(user, "super_admin", "admin", "location_manager")
    return await _get_org_menu_or_404(db, user, menu_id)


@router.post("/menus", response_model=MenuOut, status_code=status.HTTP_201_CREATED)
async def create_menu(
    body: MenuCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Menu:
    require_roles(user, "super_admin", "admin", "location_manager")
    assert_same_org(user, body.organization_id)
    now = _utcnow()
    menu = Menu(
        id=new_id("menu"),
        organization_id=body.organization_id,
        name=body.name.strip(),
        version=1,
        published_at=None,
        created_at=now,
        updated_at=now,
    )
    db.add(menu)
    await db.commit()
    await db.refresh(menu)
    return menu


@router.patch("/menus/{menu_id}", response_model=MenuOut)
async def update_menu(
    menu_id: str,
    body: MenuUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Menu:
    require_roles(user, "super_admin", "admin", "location_manager")
    menu = await _get_org_menu_or_404(db, user, menu_id)
    if body.name is not None:
        menu.name = body.name.strip()
    menu.updated_at = _utcnow()
    await db.commit()
    await db.refresh(menu)
    return menu


@router.delete("/menus/{menu_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_menu(
    menu_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    require_roles(user, "super_admin", "admin", "location_manager")
    menu = await _get_org_menu_or_404(db, user, menu_id)
    await db.delete(menu)
    await db.commit()


# ── Menu items ──────────────────────────────────────────────────────────────


@router.get("/menus/{menu_id}/items", response_model=list[MenuItemOut])
async def list_menu_items(
    menu_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[MenuItem]:
    require_roles(user, "super_admin", "admin", "location_manager")
    await _get_org_menu_or_404(db, user, menu_id)
    result = await db.execute(
        select(MenuItem)
        .where(MenuItem.menu_id == menu_id)
        .order_by(MenuItem.sort_order, MenuItem.name)
    )
    return list(result.scalars().all())


@router.get("/menu-items", response_model=list[MenuItemOut])
async def list_all_menu_items(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[MenuItem]:
    require_roles(user, "super_admin", "admin", "location_manager")
    result = await db.execute(
        select(MenuItem)
        .where(MenuItem.organization_id == user.organization_id)
        .order_by(MenuItem.menu_id, MenuItem.sort_order)
    )
    return list(result.scalars().all())


@router.post(
    "/menu-items",
    response_model=MenuItemOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_menu_item(
    body: MenuItemCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MenuItem:
    require_roles(user, "super_admin", "admin", "location_manager")
    assert_same_org(user, body.organization_id)
    menu = await _get_org_menu_or_404(db, user, body.menu_id)
    if menu.organization_id != body.organization_id:
        raise HTTPException(status_code=400, detail="Menu organization mismatch")

    sibling_count = await db.scalar(
        select(func.count()).select_from(MenuItem).where(MenuItem.menu_id == menu.id)
    )
    now = _utcnow()
    item = MenuItem(
        id=new_id("item"),
        menu_id=menu.id,
        organization_id=body.organization_id,
        name=body.name.strip(),
        price=Decimal(str(body.price)),
        description=(body.description or "").strip(),
        image_url=None,
        available=True if body.available is None else body.available,
        sort_order=int(sibling_count or 0) + 1,
        category=(body.category or "General").strip() or "General",
        created_at=now,
        updated_at=now,
    )
    menu.updated_at = now
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


@router.patch("/menu-items/{item_id}", response_model=MenuItemOut)
async def update_menu_item(
    item_id: str,
    body: MenuItemUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MenuItem:
    require_roles(user, "super_admin", "admin", "location_manager")
    item = await _get_org_item_or_404(db, user, item_id)
    if body.name is not None:
        item.name = body.name.strip()
    if body.price is not None:
        item.price = Decimal(str(body.price))
    if body.description is not None:
        item.description = body.description.strip()
    if body.category is not None:
        item.category = body.category.strip() or "General"
    if body.available is not None:
        item.available = body.available
    if body.sort_order is not None:
        item.sort_order = body.sort_order
    now = _utcnow()
    item.updated_at = now
    menu = await db.get(Menu, item.menu_id)
    if menu:
        menu.updated_at = now
    await db.commit()
    await db.refresh(item)
    return item


@router.delete("/menu-items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_menu_item(
    item_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    require_roles(user, "super_admin", "admin", "location_manager")
    item = await _get_org_item_or_404(db, user, item_id)
    menu = await db.get(Menu, item.menu_id)
    await db.delete(item)
    if menu:
        menu.updated_at = _utcnow()
    await db.commit()

