from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.access import assert_same_org, require_roles
from app.auth.clerk import get_current_user
from app.schemas.organization import (
    OrganizationCreate,
    OrganizationOut,
    OrganizationUpdate,
)
from app.utils.ids import new_id
from db.models import Organization, User
from db.session import get_db

router = APIRouter(prefix="/api/v1/organizations", tags=["organizations"])


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _normalize_slug(raw: str) -> str:
    slug = raw.strip().lower()
    slug = "".join(ch if ch.isalnum() or ch == "-" else "-" for ch in slug)
    while "--" in slug:
        slug = slug.replace("--", "-")
    return slug.strip("-")


@router.get("", response_model=list[OrganizationOut])
async def list_organizations(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[Organization]:
    """Super Admin can list organizations (platform / multi-brand view)."""
    require_roles(user, "super_admin")
    result = await db.execute(select(Organization).order_by(Organization.name))
    return list(result.scalars().all())


@router.post("", response_model=OrganizationOut, status_code=status.HTTP_201_CREATED)
async def create_organization(
    body: OrganizationCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Organization:
    require_roles(user, "super_admin")
    name = body.name.strip()
    slug = _normalize_slug(body.slug)
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    if not slug:
        raise HTTPException(status_code=400, detail="Slug is required")

    conflict = await db.execute(
        select(Organization).where(Organization.slug == slug)
    )
    if conflict.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Slug already in use",
        )

    org = Organization(
        id=new_id("org"),
        name=name,
        slug=slug,
        created_at=_utcnow(),
    )
    db.add(org)
    await db.commit()
    await db.refresh(org)
    return org


@router.get("/me", response_model=OrganizationOut)
async def get_my_organization(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Organization:
    org = await db.get(Organization, user.organization_id)
    if org is None:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org


@router.get("/{organization_id}", response_model=OrganizationOut)
async def get_organization(
    organization_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Organization:
    assert_same_org(user, organization_id)
    org = await db.get(Organization, organization_id)
    if org is None:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org


@router.patch("/{organization_id}", response_model=OrganizationOut)
async def update_organization(
    organization_id: str,
    body: OrganizationUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Organization:
    require_roles(user, "super_admin")
    assert_same_org(user, organization_id)

    org = await db.get(Organization, organization_id)
    if org is None:
        raise HTTPException(status_code=404, detail="Organization not found")

    if body.name is not None:
        org.name = body.name.strip()
    if body.slug is not None:
        slug = _normalize_slug(body.slug)
        conflict = await db.execute(
            select(Organization).where(
                Organization.slug == slug,
                Organization.id != organization_id,
            )
        )
        if conflict.scalar_one_or_none() is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Slug already in use",
            )
        org.slug = slug

    await db.commit()
    await db.refresh(org)
    return org
