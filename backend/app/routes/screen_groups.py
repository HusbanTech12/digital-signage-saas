from datetime import datetime, timezone

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.clerk import get_current_user
from app.schemas.display import RealtimeEvent
from app.schemas.screen_group import (
    ScreenGroupCreate,
    ScreenGroupListOut,
    ScreenGroupMemberOut,
    ScreenGroupMembersReplace,
    ScreenGroupOut,
    ScreenGroupPublishIn,
    ScreenGroupSyncOut,
    ScreenGroupUpdate,
)
from app.services import screen_groups as sg_service
from app.services.display_content import build_display_payload
from app.services.realtime import get_realtime_hub
from db.models import Screen, User
from db.session import get_db

router = APIRouter(prefix="/api/v1/screen-groups", tags=["screen-groups"])


async def _member_out(
    db: AsyncSession, member
) -> ScreenGroupMemberOut:
    screen = await db.get(Screen, member.screen_id)
    return ScreenGroupMemberOut(
        id=member.id,
        screen_group_id=member.screen_group_id,
        screen_id=member.screen_id,
        organization_id=member.organization_id,
        row_index=member.row_index,
        col_index=member.col_index,
        screen_name=screen.name if screen else None,
        screen_status=screen.status if screen else None,
        last_heartbeat=screen.last_heartbeat if screen else None,
        created_at=member.created_at,
    )


async def _to_out(db: AsyncSession, group) -> ScreenGroupOut:
    members = [await _member_out(db, m) for m in (group.members or [])]
    online = sum(1 for m in members if m.screen_status == "online")
    return ScreenGroupOut(
        id=group.id,
        organization_id=group.organization_id,
        location_id=group.location_id,
        name=group.name,
        layout=group.layout,
        rows=group.rows,
        cols=group.cols,
        content_mode=group.content_mode,
        active_menu_id=group.active_menu_id,
        active_template_id=group.active_template_id,
        active_playlist_id=group.active_playlist_id,
        sync_epoch_ms=group.sync_epoch_ms,
        bezel_compensation_pct=group.bezel_compensation_pct or 0.0,
        members=members,
        online_member_count=online,
        member_count=len(members),
        created_at=group.created_at,
        updated_at=group.updated_at,
    )


@router.get("", response_model=ScreenGroupListOut)
async def list_screen_groups(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ScreenGroupListOut:
    rows = await sg_service.list_screen_groups(db, user)
    groups = [await _to_out(db, g) for g in rows]
    return ScreenGroupListOut(screen_groups=groups, total=len(groups))


@router.post("", response_model=ScreenGroupOut, status_code=status.HTTP_201_CREATED)
async def create_screen_group(
    body: ScreenGroupCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ScreenGroupOut:
    group = await sg_service.create_screen_group(db, user, body)
    return await _to_out(db, group)


@router.get("/{group_id}", response_model=ScreenGroupOut)
async def get_screen_group(
    group_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ScreenGroupOut:
    group = await sg_service.get_org_screen_group_or_404(db, user, group_id)
    return await _to_out(db, group)


@router.patch("/{group_id}", response_model=ScreenGroupOut)
async def update_screen_group(
    group_id: str,
    body: ScreenGroupUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ScreenGroupOut:
    group = await sg_service.update_screen_group(db, user, group_id, body)
    return await _to_out(db, group)


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_screen_group(
    group_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    await sg_service.delete_screen_group(db, user, group_id)


@router.put("/{group_id}/members", response_model=ScreenGroupOut)
async def replace_screen_group_members(
    group_id: str,
    body: ScreenGroupMembersReplace,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ScreenGroupOut:
    group = await sg_service.replace_members(db, user, group_id, body.members)
    return await _to_out(db, group)


@router.post("/{group_id}/publish", response_model=ScreenGroupOut)
async def publish_screen_group(
    group_id: str,
    body: ScreenGroupPublishIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ScreenGroupOut:
    group, screens = await sg_service.publish_screen_group(db, user, group_id, body)
    hub = get_realtime_hub()
    now = datetime.now(timezone.utc)
    for screen in screens:
        await db.refresh(screen)
        payload = await build_display_payload(db, screen)
        if payload is None:
            continue
        await hub.publish_event(
            RealtimeEvent(
                type="wall.published",
                screen_id=screen.id,
                payload=payload.model_dump(by_alias=True, mode="json"),
                ts=now,
            )
        )
    return await _to_out(db, group)


@router.post("/{group_id}/sync", response_model=ScreenGroupSyncOut)
async def sync_screen_group(
    group_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ScreenGroupSyncOut:
    group, screens = await sg_service.sync_screen_group(db, user, group_id)
    hub = get_realtime_hub()
    now = datetime.now(timezone.utc)
    epoch = group.sync_epoch_ms or 0
    for screen in screens:
        await hub.publish_event(
            RealtimeEvent(
                type="wall.sync",
                screen_id=screen.id,
                payload={
                    "groupId": group.id,
                    "syncEpochMs": epoch,
                    "contentMode": group.content_mode,
                },
                ts=now,
            )
        )
    return ScreenGroupSyncOut(
        screen_group_id=group.id,
        sync_epoch_ms=epoch,
        member_count=len(screens),
    )
