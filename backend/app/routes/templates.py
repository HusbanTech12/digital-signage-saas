from copy import deepcopy
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.access import assert_same_org, require_roles
from app.auth.clerk import get_current_user
from app.schemas.template import (
    TemplateCreate,
    TemplateDuplicateIn,
    TemplateOut,
    TemplateUpdate,
)
from app.schemas.content_version import PublishTemplateIn
from app.services import content_versions as cv_service
from app.utils.ids import new_id
from db.models import Template, User
from db.session import get_db

router = APIRouter(prefix="/api/v1/templates", tags=["templates"])

BLANK_CANVAS: dict[str, Any] = {
    "version": "6.0.0",
    "background": "#1a1a1a",
    "objects": [
        {
            "type": "textbox",
            "version": "6.0.0",
            "left": 48,
            "top": 40,
            "width": 600,
            "fill": "#f5f5f5",
            "fontSize": 42,
            "fontFamily": "Georgia, serif",
            "fontWeight": "600",
            "text": "Menu Board",
            "editable": True,
        }
    ],
    "width": 1920,
    "height": 1080,
}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


async def _get_visible_template_or_404(
    db: AsyncSession, user: User, template_id: str
) -> Template:
    template = await db.get(Template, template_id)
    if template is None:
        raise HTTPException(status_code=404, detail="Template not found")
    if template.is_global:
        return template
    if template.organization_id != user.organization_id:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


@router.get("", response_model=list[TemplateOut])
async def list_templates(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[Template]:
    require_roles(user, "super_admin", "admin", "location_manager", "content_manager")
    result = await db.execute(
        select(Template)
        .where(
            or_(
                Template.is_global.is_(True),
                Template.organization_id == user.organization_id,
            )
        )
        .order_by(Template.is_global.desc(), Template.name)
    )
    return list(result.scalars().all())


@router.post("", response_model=TemplateOut, status_code=status.HTTP_201_CREATED)
async def create_template(
    body: TemplateCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Template:
    require_roles(user, "super_admin", "admin")
    assert_same_org(user, body.organization_id)
    now = _utcnow()
    resolution = (body.resolution or "1920x1080").strip() or "1920x1080"
    orientation = body.orientation or "landscape"
    template = Template(
        id=new_id("tpl"),
        organization_id=body.organization_id,
        name=body.name.strip(),
        description=(body.description or "").strip(),
        thumbnail_url=None,
        is_global=False,
        canvas_json=deepcopy(BLANK_CANVAS),
        display_config={},
        resolution=resolution,
        orientation=orientation,
        created_at=now,
        updated_at=now,
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return template


@router.post(
    "/duplicate",
    response_model=TemplateOut,
    status_code=status.HTTP_201_CREATED,
)
async def duplicate_template(
    body: TemplateDuplicateIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Template:
    require_roles(user, "super_admin", "admin")
    assert_same_org(user, body.organization_id)
    source = await _get_visible_template_or_404(db, user, body.template_id)
    now = _utcnow()
    copy = Template(
        id=new_id("tpl"),
        organization_id=body.organization_id,
        name=f"{source.name} (copy)",
        description=source.description,
        thumbnail_url=None,
        is_global=False,
        canvas_json=deepcopy(source.canvas_json or {}),
        display_config=deepcopy(source.display_config or {}),
        resolution=source.resolution or "1920x1080",
        orientation=source.orientation or "landscape",
        created_at=now,
        updated_at=now,
    )
    db.add(copy)
    await db.commit()
    await db.refresh(copy)
    return copy


@router.get("/{template_id}", response_model=TemplateOut)
async def get_template(
    template_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Template:
    require_roles(user, "super_admin", "admin", "location_manager")
    return await _get_visible_template_or_404(db, user, template_id)


@router.patch("/{template_id}", response_model=TemplateOut)
async def update_template(
    template_id: str,
    body: TemplateUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Template:
    require_roles(user, "super_admin", "admin", "location_manager")
    template = await _get_visible_template_or_404(db, user, template_id)

    if template.is_global:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Global templates are read-only. Duplicate to edit.",
        )

    if body.name is not None or body.description is not None:
        require_roles(user, "super_admin", "admin")
    if body.name is not None:
        template.name = body.name.strip()
    if body.description is not None:
        template.description = body.description.strip()
    if body.canvas_json is not None:
        template.canvas_json = deepcopy(body.canvas_json)
    if body.display_config is not None:
        template.display_config = deepcopy(body.display_config)
    if body.resolution is not None:
        template.resolution = body.resolution.strip() or template.resolution
    if body.orientation is not None:
        template.orientation = body.orientation

    template.updated_at = _utcnow()
    await db.commit()
    await db.refresh(template)
    return template


@router.post("/{template_id}/publish", response_model=TemplateOut)
async def publish_template(
    template_id: str,
    body: PublishTemplateIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Template:
    require_roles(user, "super_admin", "admin", "location_manager", "content_manager")
    template = await _get_visible_template_or_404(db, user, template_id)
    if template.is_global:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Global templates cannot be published as org versions.",
        )
    await cv_service.publish_template(
        db, user, template, change_summary=body.change_summary
    )
    await db.commit()
    await db.refresh(template)
    return template


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(
    template_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    require_roles(user, "super_admin", "admin")
    template = await _get_visible_template_or_404(db, user, template_id)
    if template.is_global:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete a global template.",
        )
    await db.delete(template)
    await db.commit()
