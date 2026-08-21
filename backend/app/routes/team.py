from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.clerk import get_current_user
from app.auth.permissions import ROLE_LABELS, TEAM_READ, require_permission
from app.config import get_settings
from app.schemas.team import (
    InviteCreate,
    InviteCreateResult,
    InvitationOut,
    MemberLocationsUpdate,
    MemberRoleUpdate,
    OwnershipTransferIn,
    TeamListOut,
    TeamMemberOut,
)
from app.services import team as team_service
from db.models import Invitation, User
from db.session import get_db

router = APIRouter(prefix="/api/v1/team", tags=["team"])


def _member_out(user: User) -> TeamMemberOut:
    return TeamMemberOut(
        kind="member",
        id=user.id,
        clerk_user_id=user.clerk_user_id,
        organization_id=user.organization_id,
        email=user.email,
        name=user.name,
        role=user.role,
        location_ids=list(user.location_ids or []),
        status=getattr(user, "status", None) or "active",
        last_active_at=getattr(user, "last_active_at", None),
        created_at=user.created_at,
        invitation_status=None,
    )


def _invitation_out(inv: Invitation) -> InvitationOut:
    return InvitationOut(
        kind="invitation",
        id=inv.id,
        organization_id=inv.organization_id,
        email=inv.email,
        name=inv.name,
        role=inv.role,
        location_ids=list(inv.location_ids or []),
        status=inv.status,
        message=inv.message,
        invited_by_user_id=inv.invited_by_user_id,
        expires_at=inv.expires_at,
        created_at=inv.created_at,
    )


@router.get("", response_model=TeamListOut)
async def list_team(
    q: str | None = Query(default=None),
    role: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    location_id: str | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TeamListOut:
    require_permission(user, TEAM_READ)

    member_stmt = select(User).where(User.organization_id == user.organization_id)
    if q:
        like = f"%{q.strip().lower()}%"
        member_stmt = member_stmt.where(
            or_(
                func.lower(User.name).like(like),
                func.lower(User.email).like(like),
            )
        )
    if role:
        member_stmt = member_stmt.where(User.role == role)
    if status_filter:
        member_stmt = member_stmt.where(User.status == status_filter)
    if location_id:
        member_stmt = member_stmt.where(User.location_ids.any(location_id))

    members = list(
        (
            await db.execute(member_stmt.order_by(User.name))
        ).scalars().all()
    )

    inv_stmt = select(Invitation).where(
        Invitation.organization_id == user.organization_id,
        Invitation.status == "pending",
    )
    if q:
        like = f"%{q.strip().lower()}%"
        inv_stmt = inv_stmt.where(
            or_(
                func.lower(Invitation.name).like(like),
                func.lower(Invitation.email).like(like),
            )
        )
    if role:
        inv_stmt = inv_stmt.where(Invitation.role == role)
    if status_filter and status_filter != "pending":
        invitations: list[Invitation] = []
    else:
        if location_id:
            inv_stmt = inv_stmt.where(Invitation.location_ids.any(location_id))
        invitations = list(
            (await db.execute(inv_stmt.order_by(Invitation.created_at.desc())))
            .scalars()
            .all()
        )

    return TeamListOut(
        members=[_member_out(m) for m in members],
        invitations=[_invitation_out(i) for i in invitations],
    )


@router.get("/members/{member_id}", response_model=TeamMemberOut)
async def get_member(
    member_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TeamMemberOut:
    require_permission(user, TEAM_READ)
    member = await db.get(User, member_id)
    if member is None or member.organization_id != user.organization_id:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Team member not found")
    return _member_out(member)


@router.post(
    "/invitations",
    response_model=InviteCreateResult,
    status_code=status.HTTP_201_CREATED,
)
async def invite_member(
    body: InviteCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> InviteCreateResult:
    invitation, raw_token, email_sent = await team_service.create_invitation(
        db,
        actor=user,
        email=str(body.email),
        name=body.name,
        role=body.role,
        location_ids=body.location_ids,
        message=body.message,
    )
    settings = get_settings()
    invite_url = f"{settings.frontend_url.rstrip('/')}/invite/{raw_token}"
    return InviteCreateResult(
        invitation=_invitation_out(invitation),
        email_sent=email_sent,
        invite_url=None if email_sent else invite_url,
    )


@router.post("/invitations/{invitation_id}/resend", response_model=InviteCreateResult)
async def resend_invitation(
    invitation_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> InviteCreateResult:
    invitation, raw_token, email_sent = await team_service.resend_invitation(
        db, actor=user, invitation_id=invitation_id
    )
    settings = get_settings()
    invite_url = f"{settings.frontend_url.rstrip('/')}/invite/{raw_token}"
    return InviteCreateResult(
        invitation=_invitation_out(invitation),
        email_sent=email_sent,
        invite_url=None if email_sent else invite_url,
    )


@router.post("/invitations/{invitation_id}/cancel", response_model=InvitationOut)
async def cancel_invitation(
    invitation_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> InvitationOut:
    invitation = await team_service.cancel_invitation(
        db, actor=user, invitation_id=invitation_id
    )
    return _invitation_out(invitation)


@router.patch("/members/{member_id}/role", response_model=TeamMemberOut)
async def update_role(
    member_id: str,
    body: MemberRoleUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TeamMemberOut:
    member = await team_service.update_member_role(
        db, actor=user, member_id=member_id, role=body.role
    )
    return _member_out(member)


@router.patch("/members/{member_id}/locations", response_model=TeamMemberOut)
async def update_locations(
    member_id: str,
    body: MemberLocationsUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TeamMemberOut:
    member = await team_service.update_member_locations(
        db, actor=user, member_id=member_id, location_ids=body.location_ids
    )
    return _member_out(member)


@router.post("/members/{member_id}/suspend", response_model=TeamMemberOut)
async def suspend_member(
    member_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TeamMemberOut:
    member = await team_service.suspend_member(db, actor=user, member_id=member_id)
    return _member_out(member)


@router.post("/members/{member_id}/reactivate", response_model=TeamMemberOut)
async def reactivate_member(
    member_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TeamMemberOut:
    member = await team_service.reactivate_member(db, actor=user, member_id=member_id)
    return _member_out(member)


@router.delete("/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    member_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    await team_service.remove_member(db, actor=user, member_id=member_id)


@router.post("/ownership/transfer", response_model=TeamMemberOut)
async def transfer_ownership(
    body: OwnershipTransferIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TeamMemberOut:
    member = await team_service.transfer_ownership(
        db, actor=user, new_owner_id=body.new_owner_user_id
    )
    return _member_out(member)


@router.get("/roles")
async def list_roles(
    user: User = Depends(get_current_user),
) -> list[dict[str, str]]:
    require_permission(user, TEAM_READ)
    return [{"id": k, "label": v} for k, v in ROLE_LABELS.items()]
