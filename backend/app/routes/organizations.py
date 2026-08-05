from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.access import assert_same_org, require_roles
from app.auth.clerk import get_current_user
from app.schemas.organization import OrganizationOut, OrganizationUpdate
from db.models import Organization, User
from db.session import get_db

router = APIRouter(prefix="/api/v1/organizations", tags=["organizations"])


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
        slug = body.slug.strip().lower()
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
