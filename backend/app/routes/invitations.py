from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.clerk import ClerkClaims, get_clerk_claims
from app.auth.permissions import ROLE_LABELS
from app.schemas.team import AcceptInvitationIn, InvitationPreviewOut
from app.schemas.user import UserOut
from app.services import team as team_service
from db.models import Location, Organization
from db.session import get_db

router = APIRouter(prefix="/api/v1/invitations", tags=["invitations"])


def _display_name(claims: ClerkClaims) -> str:
    raw = claims.raw or {}
    for key in ("name", "full_name", "given_name"):
        value = raw.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    if claims.email:
        return claims.email.split("@")[0]
    return "New User"


@router.get("/preview", response_model=InvitationPreviewOut)
async def preview_invitation(
    token: str,
    db: AsyncSession = Depends(get_db),
) -> InvitationPreviewOut:
    invitation = await team_service.get_pending_invitation_by_token(db, token)
    org = await db.get(Organization, invitation.organization_id)
    err = team_service.invitation_error_detail(invitation)
    location_names: list[str] = []
    ids = list(invitation.location_ids or [])
    if ids:
        rows = (
            await db.execute(select(Location).where(Location.id.in_(ids)))
        ).scalars().all()
        by_id = {loc.id: loc.name for loc in rows}
        location_names = [by_id[i] for i in ids if i in by_id]

    return InvitationPreviewOut(
        organization_id=invitation.organization_id,
        organization_name=org.name if org else "Organization",
        email=invitation.email,
        name=invitation.name,
        role=invitation.role,
        role_label=ROLE_LABELS.get(invitation.role, invitation.role),
        location_ids=ids,
        location_names=location_names,
        expires_at=invitation.expires_at,
        status=invitation.status if not err else (
            "expired" if "expired" in (err or "").lower() else invitation.status
        ),
        message=invitation.message,
        valid=err is None,
        error=err,
    )


@router.post("/accept", response_model=UserOut)
async def accept_invitation(
    body: AcceptInvitationIn,
    claims: ClerkClaims = Depends(get_clerk_claims),
    db: AsyncSession = Depends(get_db),
) -> UserOut:
    user = await team_service.accept_invitation(
        db,
        raw_token=body.token,
        clerk_user_id=claims.sub,
        email=claims.email,
        name=_display_name(claims),
    )
    return UserOut.model_validate(user)
