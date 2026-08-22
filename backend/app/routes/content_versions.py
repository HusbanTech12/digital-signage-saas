from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.clerk import get_current_user
from app.schemas.content_version import (
    ContentVersionListOut,
    ContentVersionOut,
    RestoreVersionOut,
)
from app.services import content_versions as cv_service
from db.models import User
from db.session import get_db

router = APIRouter(prefix="/api/v1/content-versions", tags=["content-versions"])


def _to_out(row, *, include_snapshot: bool = False) -> ContentVersionOut:
    return ContentVersionOut(
        id=row.id,
        organization_id=row.organization_id,
        entity_type=row.entity_type,
        entity_id=row.entity_id,
        version=row.version,
        status=row.status,
        change_summary=row.change_summary,
        published_by_user_id=row.published_by_user_id,
        created_at=row.created_at,
        snapshot=row.snapshot if include_snapshot else None,
    )


@router.get("", response_model=ContentVersionListOut)
async def list_content_versions(
    entity_type: str = Query(..., alias="entityType"),
    entity_id: str = Query(..., alias="entityId"),
    limit: int = Query(default=50, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ContentVersionListOut:
    if entity_type not in ("menu", "template", "playlist"):
        from fastapi import HTTPException

        raise HTTPException(status_code=400, detail="Invalid entityType")
    rows = await cv_service.list_versions(
        db,
        user,
        entity_type=entity_type,  # type: ignore[arg-type]
        entity_id=entity_id,
        limit=limit,
    )
    return ContentVersionListOut(
        versions=[_to_out(r) for r in rows],
        total=len(rows),
    )


@router.get("/{version_id}", response_model=ContentVersionOut)
async def get_content_version(
    version_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ContentVersionOut:
    row = await cv_service.get_version_or_404(db, user, version_id)
    return _to_out(row, include_snapshot=True)


@router.post(
    "/{version_id}/restore",
    response_model=RestoreVersionOut,
    status_code=status.HTTP_200_OK,
)
async def restore_content_version(
    version_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RestoreVersionOut:
    result = await cv_service.restore_version(db, user, version_id)
    return RestoreVersionOut(
        entity_type=result["entityType"],
        entity_id=result["entityId"],
        restored_version=int(result["restoredVersion"]),
    )
