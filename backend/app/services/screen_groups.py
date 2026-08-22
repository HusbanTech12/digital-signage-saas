"""Multi-screen / video wall screen group helpers."""

from __future__ import annotations

import time
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.access import assert_location_access, get_org_location_or_404
from app.auth.permissions import (
    SCREENS_CREATE,
    SCREENS_DELETE,
    SCREENS_PUBLISH,
    SCREENS_READ,
    SCREENS_UPDATE,
    require_permission,
)
from app.schemas.screen_group import (
    ScreenGroupCreate,
    ScreenGroupMemberIn,
    ScreenGroupPublishIn,
    ScreenGroupUpdate,
)
from app.utils.ids import new_id
from db.models import Menu, Playlist, Screen, Template, User
from db.models.screen_group import (
    SCREEN_GROUP_CONTENT_MODES,
    SCREEN_GROUP_LAYOUTS,
    ScreenGroup,
    ScreenGroupMember,
)

LAYOUT_DIMS: dict[str, tuple[int, int]] = {
    "2x2": (2, 2),
    "3x3": (3, 3),
    "4x4": (4, 4),
}


def layout_dims(layout: str, rows: int | None = None, cols: int | None = None) -> tuple[int, int]:
    if layout in LAYOUT_DIMS:
        return LAYOUT_DIMS[layout]
    if layout == "custom":
        r = rows or 1
        c = cols or 1
        if r < 1 or c < 1 or r > 8 or c > 8:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Custom layout rows/cols must be between 1 and 8.",
            )
        return r, c
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"Unsupported layout '{layout}'.",
    )


def seat_count(layout: str, rows: int | None = None, cols: int | None = None) -> int:
    r, c = layout_dims(layout, rows, cols)
    return r * c


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _now_ms() -> int:
    return int(time.time() * 1000)


async def get_org_screen_group_or_404(
    db: AsyncSession, user: User, group_id: str
) -> ScreenGroup:
    result = await db.execute(
        select(ScreenGroup)
        .where(
            ScreenGroup.id == group_id,
            ScreenGroup.organization_id == user.organization_id,
        )
        .options(
            selectinload(ScreenGroup.members),
        )
    )
    group = result.scalar_one_or_none()
    if group is None:
        raise HTTPException(status_code=404, detail="Screen group not found")
    assert_location_access(user, group.location_id)
    return group


async def list_screen_groups(db: AsyncSession, user: User) -> list[ScreenGroup]:
    require_permission(user, SCREENS_READ)
    stmt = (
        select(ScreenGroup)
        .where(ScreenGroup.organization_id == user.organization_id)
        .options(selectinload(ScreenGroup.members))
        .order_by(ScreenGroup.name)
    )
    if user.role == "location_manager" and user.location_ids:
        stmt = stmt.where(ScreenGroup.location_id.in_(list(user.location_ids)))
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def create_screen_group(
    db: AsyncSession, user: User, body: ScreenGroupCreate
) -> ScreenGroup:
    require_permission(user, SCREENS_CREATE)
    location = await get_org_location_or_404(db, user, body.location_id)
    if body.layout not in SCREEN_GROUP_LAYOUTS:
        raise HTTPException(status_code=400, detail="Invalid layout")
    if body.content_mode not in SCREEN_GROUP_CONTENT_MODES:
        raise HTTPException(status_code=400, detail="Invalid content mode")
    rows, cols = layout_dims(body.layout, body.rows, body.cols)
    group = ScreenGroup(
        id=new_id("sg"),
        organization_id=user.organization_id,
        location_id=location.id,
        name=body.name.strip() or "Video wall",
        layout=body.layout,
        rows=rows,
        cols=cols,
        content_mode=body.content_mode,
        bezel_compensation_pct=max(0.0, min(20.0, body.bezel_compensation_pct)),
        sync_epoch_ms=_now_ms(),
        created_at=_utcnow(),
        updated_at=_utcnow(),
    )
    db.add(group)
    await db.commit()
    await db.refresh(group)
    return await get_org_screen_group_or_404(db, user, group.id)


async def update_screen_group(
    db: AsyncSession, user: User, group_id: str, body: ScreenGroupUpdate
) -> ScreenGroup:
    require_permission(user, SCREENS_UPDATE)
    group = await get_org_screen_group_or_404(db, user, group_id)
    if body.name is not None:
        group.name = body.name.strip() or group.name
    if body.layout is not None:
        if body.layout not in SCREEN_GROUP_LAYOUTS:
            raise HTTPException(status_code=400, detail="Invalid layout")
        group.layout = body.layout
        rows, cols = layout_dims(body.layout, body.rows or group.rows, body.cols or group.cols)
        group.rows = rows
        group.cols = cols
    elif body.rows is not None or body.cols is not None:
        rows, cols = layout_dims(
            group.layout,
            body.rows if body.rows is not None else group.rows,
            body.cols if body.cols is not None else group.cols,
        )
        group.rows = rows
        group.cols = cols
    if body.content_mode is not None:
        if body.content_mode not in SCREEN_GROUP_CONTENT_MODES:
            raise HTTPException(status_code=400, detail="Invalid content mode")
        group.content_mode = body.content_mode
    if body.bezel_compensation_pct is not None:
        group.bezel_compensation_pct = max(
            0.0, min(20.0, body.bezel_compensation_pct)
        )
    if "active_menu_id" in body.model_fields_set:
        group.active_menu_id = body.active_menu_id
    if "active_template_id" in body.model_fields_set:
        group.active_template_id = body.active_template_id
    if "active_playlist_id" in body.model_fields_set:
        group.active_playlist_id = body.active_playlist_id
    group.updated_at = _utcnow()
    await db.commit()
    return await get_org_screen_group_or_404(db, user, group.id)


async def delete_screen_group(db: AsyncSession, user: User, group_id: str) -> None:
    require_permission(user, SCREENS_DELETE)
    group = await get_org_screen_group_or_404(db, user, group_id)
    await db.delete(group)
    await db.commit()


async def replace_members(
    db: AsyncSession,
    user: User,
    group_id: str,
    members: list[ScreenGroupMemberIn],
) -> ScreenGroup:
    require_permission(user, SCREENS_UPDATE)
    group = await get_org_screen_group_or_404(db, user, group_id)

    seen_cells: set[tuple[int, int]] = set()
    seen_screens: set[str] = set()
    for m in members:
        if m.row_index < 0 or m.row_index >= group.rows:
            raise HTTPException(
                status_code=400,
                detail=f"Row {m.row_index} out of range for {group.rows}x{group.cols}",
            )
        if m.col_index < 0 or m.col_index >= group.cols:
            raise HTTPException(
                status_code=400,
                detail=f"Col {m.col_index} out of range for {group.rows}x{group.cols}",
            )
        cell = (m.row_index, m.col_index)
        if cell in seen_cells:
            raise HTTPException(status_code=400, detail="Duplicate grid cell")
        if m.screen_id in seen_screens:
            raise HTTPException(status_code=400, detail="Duplicate screen assignment")
        seen_cells.add(cell)
        seen_screens.add(m.screen_id)

    screens: dict[str, Screen] = {}
    for m in members:
        screen = await db.get(Screen, m.screen_id)
        if (
            screen is None
            or screen.organization_id != user.organization_id
            or screen.location_id != group.location_id
        ):
            raise HTTPException(
                status_code=400,
                detail=f"Screen {m.screen_id} must belong to this location",
            )
        if screen.status == "pairing" or screen.location_id is None:
            raise HTTPException(
                status_code=400,
                detail=f"Screen {screen.name} is not fully paired",
            )
        # Ensure screen isn't in another group
        other = await db.execute(
            select(ScreenGroupMember).where(
                ScreenGroupMember.screen_id == screen.id,
                ScreenGroupMember.screen_group_id != group.id,
            )
        )
        if other.scalar_one_or_none() is not None:
            raise HTTPException(
                status_code=400,
                detail=f"Screen {screen.name} already belongs to another wall",
            )
        screens[screen.id] = screen

    for existing in list(group.members):
        await db.delete(existing)
    await db.flush()

    for m in members:
        db.add(
            ScreenGroupMember(
                id=new_id("sgm"),
                screen_group_id=group.id,
                screen_id=m.screen_id,
                organization_id=user.organization_id,
                row_index=m.row_index,
                col_index=m.col_index,
                created_at=_utcnow(),
            )
        )

    group.updated_at = _utcnow()
    await db.commit()
    return await get_org_screen_group_or_404(db, user, group.id)


async def publish_screen_group(
    db: AsyncSession,
    user: User,
    group_id: str,
    body: ScreenGroupPublishIn,
) -> tuple[ScreenGroup, list[Screen]]:
    require_permission(user, SCREENS_PUBLISH)
    group = await get_org_screen_group_or_404(db, user, group_id)
    if not group.members:
        raise HTTPException(
            status_code=400, detail="Assign screens to the wall before publishing"
        )

    if body.content_mode is not None:
        if body.content_mode not in SCREEN_GROUP_CONTENT_MODES:
            raise HTTPException(status_code=400, detail="Invalid content mode")
        group.content_mode = body.content_mode

    if body.playlist_id:
        playlist = await db.get(Playlist, body.playlist_id)
        if playlist is None or playlist.organization_id != user.organization_id:
            raise HTTPException(status_code=404, detail="Playlist not found")
        group.active_playlist_id = playlist.id
        group.active_menu_id = None
    if body.menu_id:
        menu = await db.get(Menu, body.menu_id)
        if menu is None or menu.organization_id != user.organization_id:
            raise HTTPException(status_code=404, detail="Menu not found")
        group.active_menu_id = menu.id
        if not body.playlist_id:
            group.active_playlist_id = None
    if body.template_id:
        template = await db.get(Template, body.template_id)
        if template is None or (
            template.organization_id
            and template.organization_id != user.organization_id
        ):
            raise HTTPException(status_code=404, detail="Template not found")
        group.active_template_id = template.id

    if not group.active_playlist_id and not group.active_menu_id:
        raise HTTPException(
            status_code=400,
            detail="Provide a playlist or menu to publish to the wall",
        )

    group.sync_epoch_ms = _now_ms()
    group.updated_at = _utcnow()

    screens: list[Screen] = []
    for member in group.members:
        screen = await db.get(Screen, member.screen_id)
        if screen is None:
            continue
        screen.active_playlist_id = group.active_playlist_id
        screen.active_menu_id = group.active_menu_id
        screen.active_template_id = group.active_template_id
        screens.append(screen)

    await db.commit()
    group = await get_org_screen_group_or_404(db, user, group.id)
    return group, screens


async def sync_screen_group(
    db: AsyncSession, user: User, group_id: str
) -> tuple[ScreenGroup, list[Screen]]:
    require_permission(user, SCREENS_UPDATE)
    group = await get_org_screen_group_or_404(db, user, group_id)
    if not group.members:
        raise HTTPException(status_code=400, detail="No screens assigned")
    group.sync_epoch_ms = _now_ms()
    group.updated_at = _utcnow()
    await db.commit()
    group = await get_org_screen_group_or_404(db, user, group.id)
    screens: list[Screen] = []
    for member in group.members:
        screen = await db.get(Screen, member.screen_id)
        if screen is not None:
            screens.append(screen)
    return group, screens


async def wall_info_for_screen(
    db: AsyncSession, screen: Screen
) -> dict | None:
    """Return wall tile metadata for a screen, if it belongs to a group."""
    result = await db.execute(
        select(ScreenGroupMember)
        .where(ScreenGroupMember.screen_id == screen.id)
        .options(selectinload(ScreenGroupMember.screen_group))
    )
    member = result.scalar_one_or_none()
    if member is None or member.screen_group is None:
        return None
    group = member.screen_group
    return {
        "group_id": group.id,
        "group_name": group.name,
        "layout": group.layout,
        "rows": group.rows,
        "cols": group.cols,
        "row": member.row_index,
        "col": member.col_index,
        "content_mode": group.content_mode,
        "sync_epoch_ms": group.sync_epoch_ms,
        "bezel_compensation_pct": group.bezel_compensation_pct,
    }
