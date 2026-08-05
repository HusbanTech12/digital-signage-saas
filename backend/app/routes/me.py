from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.clerk import get_current_user
from app.schemas.organization import OrganizationOut
from app.schemas.user import UserOut
from db.models import Organization, User
from db.session import get_db

router = APIRouter(prefix="/api/v1/me", tags=["me"])


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
