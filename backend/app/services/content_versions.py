"""Content versioning — snapshots, publish history, restore."""

from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Literal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.permissions import (
    MENUS_READ,
    MENUS_UPDATE,
    PLAYLISTS_READ,
    PLAYLISTS_UPDATE,
    SCREENS_PUBLISH,
    TEMPLATES_READ,
    TEMPLATES_UPDATE,
    require_any_permission,
    require_permission,
)
from app.services.audit import record_audit
from app.utils.ids import new_id
from db.models import (
    ContentVersion,
    MediaAsset,
    Menu,
    MenuItem,
    Playlist,
    Template,
    User,
)

EntityType = Literal["menu", "template", "playlist"]


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _item_dict(item: MenuItem) -> dict[str, Any]:
    price = float(item.price if isinstance(item.price, Decimal) else item.price)
    return {
        "id": item.id,
        "menuId": item.menu_id,
        "organizationId": item.organization_id,
        "name": item.name,
        "price": price,
        "description": item.description or "",
        "imageUrl": item.image_url,
        "available": item.available,
        "sortOrder": item.sort_order,
        "category": item.category,
        "createdAt": item.created_at.isoformat() if item.created_at else None,
        "updatedAt": item.updated_at.isoformat() if item.updated_at else None,
    }


def _template_dict(template: Template) -> dict[str, Any]:
    return {
        "id": template.id,
        "organizationId": template.organization_id,
        "name": template.name,
        "description": template.description or "",
        "thumbnailUrl": template.thumbnail_url,
        "isGlobal": template.is_global,
        "canvasJson": deepcopy(template.canvas_json)
        if isinstance(template.canvas_json, dict)
        else {},
        "displayConfig": deepcopy(template.display_config)
        if isinstance(template.display_config, dict)
        else {},
        "resolution": template.resolution,
        "orientation": template.orientation,
        "version": int(getattr(template, "version", 1) or 1),
        "status": getattr(template, "status", "draft") or "draft",
    }


async def build_menu_snapshot(
    db: AsyncSession, menu: Menu, template: Template | None
) -> dict[str, Any]:
    result = await db.execute(
        select(MenuItem)
        .where(MenuItem.menu_id == menu.id)
        .order_by(MenuItem.sort_order, MenuItem.name)
    )
    items = [_item_dict(i) for i in result.scalars().all()]
    return {
        "menuId": menu.id,
        "menuName": menu.name,
        "menuVersion": menu.version,
        "items": items,
        "templateId": template.id if template else None,
        "templateName": template.name if template else None,
        "canvasJson": deepcopy(template.canvas_json)
        if template and isinstance(template.canvas_json, dict)
        else None,
        "displayConfig": deepcopy(template.display_config)
        if template and isinstance(template.display_config, dict)
        else None,
        "template": _template_dict(template) if template else None,
    }


async def build_template_snapshot(template: Template) -> dict[str, Any]:
    return {"template": _template_dict(template)}


async def build_playlist_snapshot(
    db: AsyncSession, playlist: Playlist
) -> dict[str, Any]:
    """Resolved slides suitable for kiosk PlaylistPlayback."""
    from app.services.display_content import _menu_items  # local to avoid cycles

    slides: list[dict[str, Any]] = []
    for row in sorted(playlist.items or [], key=lambda i: i.sort_order):
        slide: dict[str, Any] = {
            "id": row.id,
            "sortOrder": row.sort_order,
            "contentType": row.content_type,
            "durationSeconds": max(1, int(row.duration_seconds or 10)),
            "label": row.label,
            "transition": row.transition,
            "menuId": None,
            "menuName": None,
            "menuVersion": None,
            "items": [],
            "templateId": None,
            "templateName": None,
            "canvasJson": None,
            "displayConfig": None,
            "mediaUrl": None,
            "mediaMimeType": None,
            "mediaKind": None,
            "mediaName": None,
        }
        if row.content_type == "menu" and row.menu_id:
            menu = await db.get(Menu, row.menu_id)
            if menu is None:
                continue
            slide["menuId"] = menu.id
            slide["menuName"] = menu.name
            slide["menuVersion"] = menu.version
            items = await _menu_items(db, menu.id)
            slide["items"] = [
                i.model_dump(by_alias=True, mode="json") for i in items
            ]
            if row.template_id:
                tpl = await db.get(Template, row.template_id)
                if tpl is not None:
                    snap = _template_dict(tpl)
                    slide["templateId"] = snap["id"]
                    slide["templateName"] = snap["name"]
                    slide["canvasJson"] = snap["canvasJson"]
                    slide["displayConfig"] = snap["displayConfig"] or None
        elif row.content_type == "template" and row.template_id:
            tpl = await db.get(Template, row.template_id)
            if tpl is None:
                continue
            snap = _template_dict(tpl)
            slide["templateId"] = snap["id"]
            slide["templateName"] = snap["name"]
            slide["canvasJson"] = snap["canvasJson"]
            slide["displayConfig"] = snap["displayConfig"] or None
        elif row.content_type in ("image", "video") and row.media_asset_id:
            asset = await db.get(MediaAsset, row.media_asset_id)
            if asset is None:
                continue
            slide["mediaUrl"] = asset.url
            slide["mediaMimeType"] = asset.mime_type
            slide["mediaKind"] = asset.kind
            slide["mediaName"] = asset.name
            if (
                row.content_type == "video"
                and asset.duration_seconds
                and int(row.duration_seconds or 10) <= 10
            ):
                slide["durationSeconds"] = max(1, int(asset.duration_seconds))
        else:
            continue
        slides.append(slide)

    return {
        "id": playlist.id,
        "name": playlist.name,
        "version": playlist.version,
        "loop": bool(playlist.loop),
        "priority": int(playlist.priority or 0),
        "slides": slides,
        "items": [
            {
                "id": row.id,
                "contentType": row.content_type,
                "durationSeconds": row.duration_seconds,
                "label": row.label,
                "menuId": row.menu_id,
                "templateId": row.template_id,
                "mediaAssetId": row.media_asset_id,
                "transition": row.transition,
                "sortOrder": row.sort_order,
            }
            for row in sorted(playlist.items or [], key=lambda i: i.sort_order)
        ],
    }


async def record_content_version(
    db: AsyncSession,
    *,
    organization_id: str,
    entity_type: EntityType,
    entity_id: str,
    version: int,
    snapshot: dict[str, Any],
    publisher: User | None,
    change_summary: str | None = None,
    status: str = "published",
) -> ContentVersion:
    row = ContentVersion(
        id=new_id("cver"),
        organization_id=organization_id,
        entity_type=entity_type,
        entity_id=entity_id,
        version=version,
        status=status,
        change_summary=(change_summary or "").strip() or None,
        snapshot=snapshot,
        published_by_user_id=publisher.id if publisher else None,
    )
    db.add(row)
    return row


async def list_versions(
    db: AsyncSession,
    user: User,
    *,
    entity_type: EntityType,
    entity_id: str,
    limit: int = 50,
) -> list[ContentVersion]:
    _require_read(user, entity_type)
    result = await db.execute(
        select(ContentVersion)
        .where(
            ContentVersion.organization_id == user.organization_id,
            ContentVersion.entity_type == entity_type,
            ContentVersion.entity_id == entity_id,
        )
        .order_by(ContentVersion.version.desc())
        .limit(limit)
    )
    return list(result.scalars().all())


async def get_version_or_404(
    db: AsyncSession, user: User, version_id: str
) -> ContentVersion:
    row = await db.get(ContentVersion, version_id)
    if row is None or row.organization_id != user.organization_id:
        raise HTTPException(status_code=404, detail="Version not found")
    _require_read(user, row.entity_type)  # type: ignore[arg-type]
    return row


def _require_read(user: User, entity_type: str) -> None:
    if entity_type == "menu":
        require_permission(user, MENUS_READ)
    elif entity_type == "template":
        require_permission(user, TEMPLATES_READ)
    elif entity_type == "playlist":
        require_permission(user, PLAYLISTS_READ)
    else:
        raise HTTPException(status_code=400, detail="Invalid entity type")


def _require_write(user: User, entity_type: str) -> None:
    if entity_type == "menu":
        require_any_permission(user, MENUS_UPDATE, SCREENS_PUBLISH)
    elif entity_type == "template":
        require_permission(user, TEMPLATES_UPDATE)
    elif entity_type == "playlist":
        require_permission(user, PLAYLISTS_UPDATE)
    else:
        raise HTTPException(status_code=400, detail="Invalid entity type")


async def restore_version(
    db: AsyncSession, user: User, version_id: str
) -> dict[str, Any]:
    """Restore snapshot into the working (draft) copy. Does not republish."""
    row = await get_version_or_404(db, user, version_id)
    _require_write(user, row.entity_type)
    snap = row.snapshot or {}

    if row.entity_type == "menu":
        menu = await db.get(Menu, row.entity_id)
        if menu is None or menu.organization_id != user.organization_id:
            raise HTTPException(status_code=404, detail="Menu not found")
        items_data = snap.get("items") or []
        # Replace live items with snapshot
        existing = await db.execute(
            select(MenuItem).where(MenuItem.menu_id == menu.id)
        )
        for item in existing.scalars().all():
            await db.delete(item)
        await db.flush()
        for raw in items_data:
            db.add(
                MenuItem(
                    id=str(raw.get("id") or new_id("item")),
                    menu_id=menu.id,
                    organization_id=menu.organization_id,
                    name=str(raw.get("name") or "Item"),
                    price=Decimal(str(raw.get("price") or 0)),
                    description=str(raw.get("description") or ""),
                    image_url=raw.get("imageUrl"),
                    available=bool(raw.get("available", True)),
                    sort_order=int(raw.get("sortOrder") or 0),
                    category=str(raw.get("category") or "General"),
                )
            )
        if snap.get("menuName"):
            menu.name = str(snap["menuName"])
        # Restored working copy — stay draft until republish
        if menu.status == "archived":
            menu.status = "draft"
        menu.updated_at = _utcnow()
        await record_audit(
            db,
            organization_id=user.organization_id,
            action="menu.version_restored",
            actor=user,
            metadata={
                "menuId": menu.id,
                "versionId": row.id,
                "version": row.version,
            },
        )
        await db.commit()
        return {"entityType": "menu", "entityId": menu.id, "restoredVersion": row.version}

    if row.entity_type == "template":
        template = await db.get(Template, row.entity_id)
        if template is None or (
            not template.is_global
            and template.organization_id != user.organization_id
        ):
            raise HTTPException(status_code=404, detail="Template not found")
        tpl = snap.get("template") or snap
        if tpl.get("name"):
            template.name = str(tpl["name"])
        if "description" in tpl:
            template.description = str(tpl.get("description") or "")
        if isinstance(tpl.get("canvasJson"), dict):
            template.canvas_json = deepcopy(tpl["canvasJson"])
        if isinstance(tpl.get("displayConfig"), dict):
            template.display_config = deepcopy(tpl["displayConfig"])
        template.status = "draft"
        template.updated_at = _utcnow()
        await record_audit(
            db,
            organization_id=user.organization_id,
            action="template.version_restored",
            actor=user,
            metadata={
                "templateId": template.id,
                "versionId": row.id,
                "version": row.version,
            },
        )
        await db.commit()
        return {
            "entityType": "template",
            "entityId": template.id,
            "restoredVersion": row.version,
        }

    if row.entity_type == "playlist":
        from app.schemas.playlist import PlaylistItemIn
        from app.services import playlist as playlist_service

        playlist = await playlist_service.get_org_playlist_or_404(
            db, user, row.entity_id
        )
        raw_items = snap.get("items") or []
        items_in: list[PlaylistItemIn] = []
        if isinstance(raw_items, list) and raw_items:
            for i, it in enumerate(raw_items):
                if not isinstance(it, dict):
                    continue
                ctype = it.get("contentType") or it.get("content_type")
                if ctype not in ("menu", "template", "image", "video"):
                    continue
                items_in.append(
                    PlaylistItemIn(
                        content_type=ctype,  # type: ignore[arg-type]
                        duration_seconds=int(
                            it.get("durationSeconds")
                            or it.get("duration_seconds")
                            or 10
                        ),
                        label=it.get("label"),
                        menu_id=it.get("menuId") or it.get("menu_id"),
                        template_id=it.get("templateId") or it.get("template_id"),
                        media_asset_id=it.get("mediaAssetId")
                        or it.get("media_asset_id"),
                        transition=it.get("transition"),
                        sort_order=int(
                            it.get("sortOrder")
                            if it.get("sortOrder") is not None
                            else (it.get("sort_order") or i)
                        ),
                    )
                )
        if snap.get("name"):
            playlist.name = str(snap["name"])
        if "loop" in snap:
            playlist.loop = bool(snap["loop"])
        if "priority" in snap:
            playlist.priority = int(snap["priority"] or 0)
        playlist.status = "draft"
        playlist.updated_at = _utcnow()
        if items_in:
            await playlist_service._replace_items(db, user, playlist, items_in)
        await record_audit(
            db,
            organization_id=user.organization_id,
            action="playlist.version_restored",
            actor=user,
            metadata={
                "playlistId": playlist.id,
                "versionId": row.id,
                "version": row.version,
            },
        )
        await db.commit()
        return {
            "entityType": "playlist",
            "entityId": playlist.id,
            "restoredVersion": row.version,
        }

    raise HTTPException(status_code=400, detail="Unsupported entity type")


async def publish_template(
    db: AsyncSession,
    user: User,
    template: Template,
    *,
    change_summary: str | None = None,
) -> ContentVersion:
    require_permission(user, TEMPLATES_UPDATE)
    now = _utcnow()
    template.version = int(template.version or 0) + 1
    template.status = "published"
    template.published_at = now
    template.published_by_user_id = user.id
    snapshot = await build_template_snapshot(template)
    template.published_snapshot = snapshot
    template.updated_at = now
    ver = await record_content_version(
        db,
        organization_id=user.organization_id,
        entity_type="template",
        entity_id=template.id,
        version=template.version,
        snapshot=snapshot,
        publisher=user,
        change_summary=change_summary,
    )
    await record_audit(
        db,
        organization_id=user.organization_id,
        action="template.published",
        actor=user,
        metadata={
            "templateId": template.id,
            "version": template.version,
            "versionId": ver.id,
        },
    )
    return ver
