from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.permissions import (
    LOCATION_SCOPED_ROLES,
    ORG_WIDE_ROLES,
    ROLE_LABELS,
    TEAM_INVITE,
    TEAM_REMOVE,
    TEAM_UPDATE,
    has_permission,
    is_owner,
    require_permission,
    validate_assignable_role,
)
from app.config import get_settings
from app.services.audit import record_audit
from app.services.email import send_invitation_email
from app.utils.ids import new_id
from db.models import Invitation, Location, Organization, User


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def hash_invite_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def generate_invite_token() -> str:
    return secrets.token_urlsafe(32)


def normalize_email(email: str) -> str:
    return email.strip().lower()


async def assert_location_ids_in_org(
    db: AsyncSession, organization_id: str, location_ids: list[str]
) -> list[str]:
    if not location_ids:
        return []
    unique = list(dict.fromkeys(location_ids))
    result = await db.execute(
        select(Location.id).where(
            Location.organization_id == organization_id,
            Location.id.in_(unique),
        )
    )
    found = {row[0] for row in result.all()}
    missing = [lid for lid in unique if lid not in found]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid location ids for this organization: {', '.join(missing)}",
        )
    return unique


async def count_owners(db: AsyncSession, organization_id: str) -> int:
    result = await db.scalar(
        select(func.count())
        .select_from(User)
        .where(
            User.organization_id == organization_id,
            User.role == "super_admin",
            User.status != "removed",
        )
    )
    return int(result or 0)


def assert_not_final_owner_downgrade(user: User, owner_count: int) -> None:
    if is_owner(user) and owner_count <= 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove or downgrade the final organization owner. "
            "Transfer ownership first.",
        )


async def create_invitation(
    db: AsyncSession,
    *,
    actor: User,
    email: str,
    name: str,
    role: str,
    location_ids: list[str],
    message: str | None,
) -> tuple[Invitation, str, bool]:
    """Returns (invitation, raw_token, email_sent). Raw token is never persisted."""
    require_permission(actor, TEAM_INVITE)
    role = validate_assignable_role(role)
    if role == "super_admin" and not is_owner(actor):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the organization owner can invite another owner",
        )

    email_norm = normalize_email(email)
    if not email_norm or "@" not in email_norm:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid email address"
        )

    existing_member = (
        await db.execute(
            select(User).where(
                User.organization_id == actor.organization_id,
                func.lower(User.email) == email_norm,
            )
        )
    ).scalar_one_or_none()
    if existing_member is not None and existing_member.status != "removed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A team member with this email already exists",
        )

    pending = (
        await db.execute(
            select(Invitation).where(
                Invitation.organization_id == actor.organization_id,
                func.lower(Invitation.email) == email_norm,
                Invitation.status == "pending",
            )
        )
    ).scalar_one_or_none()
    if pending is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A pending invitation already exists for this email",
        )

    scoped_ids = await assert_location_ids_in_org(
        db, actor.organization_id, location_ids
    )
    if role in LOCATION_SCOPED_ROLES and not scoped_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Location Manager and Viewer require at least one location",
        )
    if role in ORG_WIDE_ROLES:
        # Owners/admins/content managers may have empty = all locations
        pass

    settings = get_settings()
    raw_token = generate_invite_token()
    now = _utcnow()
    invitation = Invitation(
        id=new_id("inv"),
        organization_id=actor.organization_id,
        email=email_norm,
        name=name.strip() or email_norm.split("@")[0],
        role=role,
        location_ids=scoped_ids,
        token_hash=hash_invite_token(raw_token),
        status="pending",
        message=(message.strip() if message else None) or None,
        invited_by_user_id=actor.id,
        expires_at=now + timedelta(days=max(1, settings.invite_expiry_days)),
        created_at=now,
        updated_at=now,
    )
    db.add(invitation)

    await record_audit(
        db,
        organization_id=actor.organization_id,
        actor=actor,
        action="invitation.created",
        metadata={
            "invitationId": invitation.id,
            "email": email_norm,
            "role": role,
            "locationIds": scoped_ids,
        },
    )

    org = await db.get(Organization, actor.organization_id)
    invite_url = f"{settings.frontend_url.rstrip('/')}/invite/{raw_token}"
    email_sent = await send_invitation_email(
        to_email=email_norm,
        to_name=invitation.name,
        organization_name=org.name if org else "your organization",
        inviter_name=actor.name,
        role_label=ROLE_LABELS.get(role, role),
        invite_url=invite_url,
        message=invitation.message,
        expires_at_iso=invitation.expires_at.isoformat(),
    )

    await db.commit()
    await db.refresh(invitation)
    return invitation, raw_token, email_sent


async def get_pending_invitation_by_token(
    db: AsyncSession, raw_token: str
) -> Invitation:
    if not raw_token or len(raw_token) < 16:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid invitation token"
        )
    token_hash = hash_invite_token(raw_token)
    invitation = (
        await db.execute(select(Invitation).where(Invitation.token_hash == token_hash))
    ).scalar_one_or_none()
    if invitation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found"
        )
    return invitation


def invitation_error_detail(invitation: Invitation) -> str | None:
    now = _utcnow()
    if invitation.status == "cancelled":
        return "This invitation was cancelled"
    if invitation.status == "accepted":
        return "This invitation has already been used"
    if invitation.status == "expired" or invitation.expires_at <= now:
        return "This invitation has expired"
    if invitation.status != "pending":
        return "This invitation is no longer valid"
    return None


async def accept_invitation(
    db: AsyncSession,
    *,
    raw_token: str,
    clerk_user_id: str,
    email: str | None,
    name: str,
) -> User:
    invitation = await get_pending_invitation_by_token(db, raw_token)
    err = invitation_error_detail(invitation)
    if err:
        if invitation.status == "pending" and invitation.expires_at <= _utcnow():
            invitation.status = "expired"
            invitation.updated_at = _utcnow()
            await db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err)

    if email:
        if normalize_email(email) != normalize_email(invitation.email):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Signed-in email does not match the invitation email",
            )

    existing = (
        await db.execute(select(User).where(User.clerk_user_id == clerk_user_id))
    ).scalar_one_or_none()
    if existing is not None:
        if existing.organization_id != invitation.organization_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This account already belongs to another organization",
            )
        # Re-activate / sync if same org
        existing.role = invitation.role
        existing.location_ids = list(invitation.location_ids or [])
        existing.status = "active"
        existing.name = name or existing.name
        if email:
            existing.email = normalize_email(email)
        existing.last_active_at = _utcnow()
        user = existing
    else:
        email_clash = (
            await db.execute(
                select(User).where(
                    User.organization_id == invitation.organization_id,
                    func.lower(User.email) == normalize_email(invitation.email),
                )
            )
        ).scalar_one_or_none()
        if email_clash is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A member with this email already exists in the organization",
            )
        now = _utcnow()
        user = User(
            id=new_id("user"),
            clerk_user_id=clerk_user_id,
            organization_id=invitation.organization_id,
            email=normalize_email(invitation.email),
            name=name.strip() or invitation.name,
            role=invitation.role,
            location_ids=list(invitation.location_ids or []),
            status="active",
            last_active_at=now,
            created_at=now,
        )
        db.add(user)

    invitation.status = "accepted"
    invitation.accepted_at = _utcnow()
    invitation.accepted_user_id = user.id
    invitation.updated_at = _utcnow()

    await record_audit(
        db,
        organization_id=invitation.organization_id,
        actor=user,
        target_user_id=user.id,
        action="invitation.accepted",
        metadata={"invitationId": invitation.id, "email": invitation.email},
    )
    await db.commit()
    await db.refresh(user)
    return user


async def resend_invitation(
    db: AsyncSession, *, actor: User, invitation_id: str
) -> tuple[Invitation, str, bool]:
    require_permission(actor, TEAM_INVITE)
    invitation = await db.get(Invitation, invitation_id)
    if invitation is None or invitation.organization_id != actor.organization_id:
        raise HTTPException(status_code=404, detail="Invitation not found")
    if invitation.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only pending invitations can be resent",
        )

    settings = get_settings()
    raw_token = generate_invite_token()
    now = _utcnow()
    invitation.token_hash = hash_invite_token(raw_token)
    invitation.expires_at = now + timedelta(days=max(1, settings.invite_expiry_days))
    invitation.updated_at = now

    await record_audit(
        db,
        organization_id=actor.organization_id,
        actor=actor,
        action="invitation.resent",
        metadata={"invitationId": invitation.id, "email": invitation.email},
    )

    org = await db.get(Organization, actor.organization_id)
    invite_url = f"{settings.frontend_url.rstrip('/')}/invite/{raw_token}"
    email_sent = await send_invitation_email(
        to_email=invitation.email,
        to_name=invitation.name,
        organization_name=org.name if org else "your organization",
        inviter_name=actor.name,
        role_label=ROLE_LABELS.get(invitation.role, invitation.role),
        invite_url=invite_url,
        message=invitation.message,
        expires_at_iso=invitation.expires_at.isoformat(),
    )
    await db.commit()
    await db.refresh(invitation)
    return invitation, raw_token, email_sent


async def cancel_invitation(
    db: AsyncSession, *, actor: User, invitation_id: str
) -> Invitation:
    require_permission(actor, TEAM_INVITE)
    invitation = await db.get(Invitation, invitation_id)
    if invitation is None or invitation.organization_id != actor.organization_id:
        raise HTTPException(status_code=404, detail="Invitation not found")
    if invitation.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only pending invitations can be cancelled",
        )
    invitation.status = "cancelled"
    invitation.updated_at = _utcnow()
    # Invalidate token
    invitation.token_hash = hash_invite_token(generate_invite_token())
    await record_audit(
        db,
        organization_id=actor.organization_id,
        actor=actor,
        action="invitation.cancelled",
        metadata={"invitationId": invitation.id, "email": invitation.email},
    )
    await db.commit()
    await db.refresh(invitation)
    return invitation


async def update_member_role(
    db: AsyncSession, *, actor: User, member_id: str, role: str
) -> User:
    require_permission(actor, TEAM_UPDATE)
    role = validate_assignable_role(role)
    member = await _get_org_member(db, actor, member_id)
    if member.id == actor.id and role != member.role and is_owner(member):
        owners = await count_owners(db, actor.organization_id)
        assert_not_final_owner_downgrade(member, owners)

    if role == "super_admin" and not is_owner(actor):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the organization owner can assign the owner role",
        )

    if is_owner(member) and role != "super_admin":
        owners = await count_owners(db, actor.organization_id)
        assert_not_final_owner_downgrade(member, owners)

    old_role = member.role
    member.role = role
    await record_audit(
        db,
        organization_id=actor.organization_id,
        actor=actor,
        target_user_id=member.id,
        action="member.role_changed",
        metadata={"from": old_role, "to": role},
    )
    await db.commit()
    await db.refresh(member)
    return member


async def update_member_locations(
    db: AsyncSession, *, actor: User, member_id: str, location_ids: list[str]
) -> User:
    require_permission(actor, TEAM_UPDATE)
    member = await _get_org_member(db, actor, member_id)
    scoped = await assert_location_ids_in_org(
        db, actor.organization_id, location_ids
    )
    if member.role in LOCATION_SCOPED_ROLES and not scoped:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This role requires at least one location",
        )
    old = list(member.location_ids or [])
    member.location_ids = scoped
    await record_audit(
        db,
        organization_id=actor.organization_id,
        actor=actor,
        target_user_id=member.id,
        action="member.locations_changed",
        metadata={"from": old, "to": scoped},
    )
    await db.commit()
    await db.refresh(member)
    return member


async def suspend_member(
    db: AsyncSession, *, actor: User, member_id: str
) -> User:
    require_permission(actor, TEAM_UPDATE)
    member = await _get_org_member(db, actor, member_id)
    if member.id == actor.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot suspend yourself",
        )
    if is_owner(member):
        owners = await count_owners(db, actor.organization_id)
        assert_not_final_owner_downgrade(member, owners)
    member.status = "suspended"
    await record_audit(
        db,
        organization_id=actor.organization_id,
        actor=actor,
        target_user_id=member.id,
        action="member.suspended",
    )
    await db.commit()
    await db.refresh(member)
    return member


async def reactivate_member(
    db: AsyncSession, *, actor: User, member_id: str
) -> User:
    require_permission(actor, TEAM_UPDATE)
    member = await _get_org_member(db, actor, member_id)
    member.status = "active"
    await record_audit(
        db,
        organization_id=actor.organization_id,
        actor=actor,
        target_user_id=member.id,
        action="member.reactivated",
    )
    await db.commit()
    await db.refresh(member)
    return member


async def remove_member(
    db: AsyncSession, *, actor: User, member_id: str
) -> None:
    require_permission(actor, TEAM_REMOVE)
    member = await _get_org_member(db, actor, member_id)
    if member.id == actor.id:
        owners = await count_owners(db, actor.organization_id)
        if is_owner(member) and owners <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot remove yourself as the final organization owner",
            )
    if is_owner(member):
        owners = await count_owners(db, actor.organization_id)
        assert_not_final_owner_downgrade(member, owners)

    await record_audit(
        db,
        organization_id=actor.organization_id,
        actor=actor,
        target_user_id=member.id,
        action="member.removed",
        metadata={"email": member.email, "role": member.role},
    )
    await db.delete(member)
    await db.commit()


async def transfer_ownership(
    db: AsyncSession, *, actor: User, new_owner_id: str
) -> User:
    from app.auth.permissions import OWNERSHIP_TRANSFER

    require_permission(actor, OWNERSHIP_TRANSFER)
    if not is_owner(actor):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the current owner can transfer ownership",
        )
    new_owner = await _get_org_member(db, actor, new_owner_id)
    if new_owner.id == actor.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Already the organization owner",
        )
    if new_owner.status != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New owner must be an active member",
        )

    new_owner.role = "super_admin"
    new_owner.location_ids = []
    actor.role = "admin"
    await record_audit(
        db,
        organization_id=actor.organization_id,
        actor=actor,
        target_user_id=new_owner.id,
        action="ownership.transferred",
        metadata={"fromUserId": actor.id, "toUserId": new_owner.id},
    )
    await db.commit()
    await db.refresh(new_owner)
    return new_owner


async def _get_org_member(
    db: AsyncSession, actor: User, member_id: str
) -> User:
    member = await db.get(User, member_id)
    if member is None or member.organization_id != actor.organization_id:
        raise HTTPException(status_code=404, detail="Team member not found")
    return member


def can_manage_team(user: User) -> bool:
    return has_permission(user, TEAM_INVITE) or has_permission(user, TEAM_UPDATE)
