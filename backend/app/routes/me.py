from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.clerk import ClerkClaims, get_clerk_claims, get_current_user
from app.config import get_settings
from app.schemas.onboarding import OnboardOut
from app.schemas.organization import OrganizationOut
from app.schemas.user import UserOut
from app.utils.ids import new_id
from db.models import Organization, User
from db.session import get_db

router = APIRouter(prefix="/api/v1/me", tags=["me"])

DEMO_ORG_ID = "org_demo_001"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _display_name(claims: ClerkClaims) -> str:
    raw = claims.raw or {}
    for key in ("name", "full_name", "given_name"):
        value = raw.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    if claims.email:
        return claims.email.split("@")[0]
    return "Dashboard User"


@router.get("", response_model=UserOut)
async def get_me(user: User = Depends(get_current_user)) -> User:
    return user


@router.get("/bootstrap")
async def bootstrap_context(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Return current user + organization for dashboard hydration."""
    org = await db.get(Organization, user.organization_id)
    if org is None:
        raise HTTPException(status_code=404, detail="Organization not found")
    return {
        "user": UserOut.model_validate(user).model_dump(by_alias=True, mode="json"),
        "organization": OrganizationOut.model_validate(org).model_dump(
            by_alias=True, mode="json"
        ),
    }


@router.post("/onboard", response_model=OnboardOut)
async def onboard_me(
    claims: ClerkClaims = Depends(get_clerk_claims),
    db: AsyncSession = Depends(get_db),
) -> OnboardOut:
    """
    Provision the Clerk user into the API DB on first visit.
    - If already provisioned: return existing user + org.
    - Development: attach to Harbor & Hearth demo org when present.
    - Otherwise: create a new organization and make this user super_admin.
    """
    existing = (
        await db.execute(select(User).where(User.clerk_user_id == claims.sub))
    ).scalar_one_or_none()
    if existing is not None:
        org = await db.get(Organization, existing.organization_id)
        if org is None:
            raise HTTPException(status_code=500, detail="User org missing")
        return OnboardOut(
            user=UserOut.model_validate(existing),
            organization=OrganizationOut.model_validate(org),
            created=False,
        )

    settings = get_settings()
    now = _utcnow()
    email = claims.email or f"{claims.sub}@users.clerk.local"
    name = _display_name(claims)

    demo_org = await db.get(Organization, DEMO_ORG_ID)
    if demo_org is not None and settings.app_env in ("development", "dev", "local"):
        org = demo_org
        role = "super_admin"
        location_ids: list[str] = []
    else:
        slug_base = (email.split("@")[0] or "org").lower()
        slug = "".join(ch if ch.isalnum() else "-" for ch in slug_base).strip("-")
        slug = (slug or "org")[:40]
        # Avoid unique collisions
        candidate = slug
        n = 1
        while True:
            clash = (
                await db.execute(select(Organization).where(Organization.slug == candidate))
            ).scalar_one_or_none()
            if clash is None:
                slug = candidate
                break
            n += 1
            candidate = f"{slug}-{n}"

        org = Organization(
            id=new_id("org"),
            name=f"{name}'s Organization",
            slug=slug,
            created_at=now,
        )
        db.add(org)
        await db.flush()
        role = "super_admin"
        location_ids = []

    user = User(
        id=new_id("user"),
        clerk_user_id=claims.sub,
        organization_id=org.id,
        email=email,
        name=name,
        role=role,
        location_ids=location_ids,
        created_at=now,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    await db.refresh(org)

    return OnboardOut(
        user=UserOut.model_validate(user),
        organization=OrganizationOut.model_validate(org),
        created=True,
    )
