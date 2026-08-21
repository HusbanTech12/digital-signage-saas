from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.permissions import (
    MEDIA_DELETE,
    MEDIA_READ,
    MEDIA_UPDATE,
    MEDIA_UPLOAD,
    require_permission,
)
from app.services.audit import record_audit
from app.services.storage import (
    get_media_storage,
    guess_mime,
    infer_kind,
    sanitize_filename,
)
from app.utils.ids import new_id
from db.models import MediaAsset, MediaFolder, User

MAX_UPLOAD_BYTES = 50 * 1024 * 1024  # 50 MB
ALLOWED_PREFIXES = ("image/", "video/", "audio/")
ALLOWED_EXACT = {
    "application/pdf",
    "image/svg+xml",
}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _validate_mime(mime: str) -> None:
    if mime in ALLOWED_EXACT:
        return
    if any(mime.startswith(p) for p in ALLOWED_PREFIXES):
        return
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"Unsupported media type: {mime}",
    )


async def get_org_asset_or_404(
    db: AsyncSession, user: User, asset_id: str
) -> MediaAsset:
    asset = await db.get(MediaAsset, asset_id)
    if asset is None or asset.organization_id != user.organization_id:
        raise HTTPException(status_code=404, detail="Media asset not found")
    return asset


async def get_org_folder_or_404(
    db: AsyncSession, user: User, folder_id: str
) -> MediaFolder:
    folder = await db.get(MediaFolder, folder_id)
    if folder is None or folder.organization_id != user.organization_id:
        raise HTTPException(status_code=404, detail="Folder not found")
    return folder


async def list_media(
    db: AsyncSession,
    *,
    user: User,
    q: str | None = None,
    kind: str | None = None,
    folder_id: str | None = None,
    tag: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> tuple[list[MediaAsset], list[MediaFolder], int]:
    require_permission(user, MEDIA_READ)
    stmt = select(MediaAsset).where(
        MediaAsset.organization_id == user.organization_id
    )
    if q:
        like = f"%{q.strip().lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(MediaAsset.name).like(like),
                func.lower(MediaAsset.original_filename).like(like),
            )
        )
    if kind:
        stmt = stmt.where(MediaAsset.kind == kind)
    if folder_id == "__root__":
        stmt = stmt.where(MediaAsset.folder_id.is_(None))
    elif folder_id:
        stmt = stmt.where(MediaAsset.folder_id == folder_id)
    if tag:
        stmt = stmt.where(MediaAsset.tags.any(tag))

    count_stmt = select(func.count()).select_from(MediaAsset).where(
        MediaAsset.organization_id == user.organization_id
    )
    if q:
        like = f"%{q.strip().lower()}%"
        count_stmt = count_stmt.where(
            or_(
                func.lower(MediaAsset.name).like(like),
                func.lower(MediaAsset.original_filename).like(like),
            )
        )
    if kind:
        count_stmt = count_stmt.where(MediaAsset.kind == kind)
    if folder_id == "__root__":
        count_stmt = count_stmt.where(MediaAsset.folder_id.is_(None))
    elif folder_id:
        count_stmt = count_stmt.where(MediaAsset.folder_id == folder_id)
    if tag:
        count_stmt = count_stmt.where(MediaAsset.tags.any(tag))

    total = int(await db.scalar(count_stmt) or 0)
    assets = list(
        (
            await db.execute(
                stmt.order_by(MediaAsset.created_at.desc())
                .offset(max(0, offset))
                .limit(min(200, max(1, limit)))
            )
        )
        .scalars()
        .all()
    )

    folder_stmt = select(MediaFolder).where(
        MediaFolder.organization_id == user.organization_id
    )
    if folder_id == "__root__":
        folder_stmt = folder_stmt.where(MediaFolder.parent_id.is_(None))
    elif folder_id:
        folder_stmt = folder_stmt.where(MediaFolder.parent_id == folder_id)

    folders = list(
        (await db.execute(folder_stmt.order_by(MediaFolder.name))).scalars().all()
    )
    return assets, folders, total


async def create_folder(
    db: AsyncSession,
    *,
    user: User,
    name: str,
    parent_id: str | None,
) -> MediaFolder:
    require_permission(user, MEDIA_UPLOAD)
    if parent_id:
        await get_org_folder_or_404(db, user, parent_id)
    now = _utcnow()
    folder = MediaFolder(
        id=new_id("mfold"),
        organization_id=user.organization_id,
        parent_id=parent_id,
        name=name.strip(),
        created_by_user_id=user.id,
        created_at=now,
        updated_at=now,
    )
    db.add(folder)
    await record_audit(
        db,
        organization_id=user.organization_id,
        actor=user,
        action="media.folder_created",
        metadata={"folderId": folder.id, "name": folder.name},
    )
    await db.commit()
    await db.refresh(folder)
    return folder


async def update_folder(
    db: AsyncSession,
    *,
    user: User,
    folder_id: str,
    name: str | None,
    parent_id: str | None,
    set_parent: bool,
) -> MediaFolder:
    require_permission(user, MEDIA_UPDATE)
    folder = await get_org_folder_or_404(db, user, folder_id)
    if name is not None:
        folder.name = name.strip()
    if set_parent:
        if parent_id:
            if parent_id == folder.id:
                raise HTTPException(400, detail="Folder cannot be its own parent")
            await get_org_folder_or_404(db, user, parent_id)
        folder.parent_id = parent_id
    folder.updated_at = _utcnow()
    await db.commit()
    await db.refresh(folder)
    return folder


async def delete_folder(
    db: AsyncSession, *, user: User, folder_id: str
) -> None:
    require_permission(user, MEDIA_DELETE)
    folder = await get_org_folder_or_404(db, user, folder_id)
    child_count = await db.scalar(
        select(func.count())
        .select_from(MediaFolder)
        .where(MediaFolder.parent_id == folder.id)
    )
    asset_count = await db.scalar(
        select(func.count())
        .select_from(MediaAsset)
        .where(MediaAsset.folder_id == folder.id)
    )
    if (child_count or 0) > 0 or (asset_count or 0) > 0:
        raise HTTPException(
            status_code=400,
            detail="Move or delete folder contents before deleting the folder",
        )
    await record_audit(
        db,
        organization_id=user.organization_id,
        actor=user,
        action="media.folder_deleted",
        metadata={"folderId": folder.id, "name": folder.name},
    )
    await db.delete(folder)
    await db.commit()


async def upload_asset(
    db: AsyncSession,
    *,
    user: User,
    filename: str,
    data: bytes,
    content_type: str | None,
    name: str | None,
    kind: str | None,
    folder_id: str | None,
    tags: list[str] | None,
    notes: str | None,
) -> MediaAsset:
    require_permission(user, MEDIA_UPLOAD)
    if not data:
        raise HTTPException(400, detail="Empty file")
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(400, detail="File exceeds 50MB limit")

    safe_name = sanitize_filename(filename)
    mime = guess_mime(safe_name, content_type)
    _validate_mime(mime)
    resolved_kind = infer_kind(mime, kind)

    if folder_id:
        await get_org_folder_or_404(db, user, folder_id)

    asset_id = new_id("media")
    storage_key = f"{user.organization_id}/{asset_id}/{safe_name}"
    storage = get_media_storage()
    url = storage.put_bytes(
        storage_key=storage_key, data=data, content_type=mime
    )

    # Local mode URLs are relative content routes — absolute for clients later.
    if url.startswith("/api/"):
        # Keep relative; frontend can prefix API base.
        pass

    now = _utcnow()
    display_name = (name or Path_stem(safe_name)).strip() or safe_name
    asset = MediaAsset(
        id=asset_id,
        organization_id=user.organization_id,
        folder_id=folder_id,
        name=display_name[:255],
        original_filename=safe_name,
        kind=resolved_kind,
        mime_type=mime,
        size_bytes=len(data),
        storage_key=storage_key,
        url=url,
        tags=_normalize_tags(tags),
        usage_count=0,
        uploaded_by_user_id=user.id,
        notes=(notes.strip() if notes else None) or None,
        created_at=now,
        updated_at=now,
    )
    db.add(asset)
    await record_audit(
        db,
        organization_id=user.organization_id,
        actor=user,
        action="media.uploaded",
        metadata={
            "mediaId": asset.id,
            "name": asset.name,
            "kind": asset.kind,
            "sizeBytes": asset.size_bytes,
        },
    )
    await db.commit()
    await db.refresh(asset)
    return asset


def Path_stem(filename: str) -> str:
    from pathlib import Path

    return Path(filename).stem


def _normalize_tags(tags: list[str] | None) -> list[str]:
    if not tags:
        return []
    cleaned: list[str] = []
    for tag in tags:
        t = tag.strip().lower()[:64]
        if t and t not in cleaned:
            cleaned.append(t)
    return cleaned[:30]


async def update_asset(
    db: AsyncSession,
    *,
    user: User,
    asset_id: str,
    name: str | None,
    kind: str | None,
    folder_id: str | None,
    clear_folder: bool,
    tags: list[str] | None,
    notes: str | None,
) -> MediaAsset:
    require_permission(user, MEDIA_UPDATE)
    asset = await get_org_asset_or_404(db, user, asset_id)
    if name is not None:
        asset.name = name.strip()
    if kind is not None:
        if kind not in {"image", "video", "audio", "logo", "promo", "other"}:
            raise HTTPException(400, detail="Invalid media kind")
        asset.kind = kind
    if clear_folder:
        asset.folder_id = None
    elif folder_id is not None:
        if folder_id:
            await get_org_folder_or_404(db, user, folder_id)
        asset.folder_id = folder_id or None
    if tags is not None:
        asset.tags = _normalize_tags(tags)
    if notes is not None:
        asset.notes = notes.strip() or None
    asset.updated_at = _utcnow()
    await record_audit(
        db,
        organization_id=user.organization_id,
        actor=user,
        action="media.updated",
        metadata={"mediaId": asset.id},
    )
    await db.commit()
    await db.refresh(asset)
    return asset


async def replace_asset_content(
    db: AsyncSession,
    *,
    user: User,
    asset_id: str,
    filename: str,
    data: bytes,
    content_type: str | None,
) -> MediaAsset:
    require_permission(user, MEDIA_UPDATE)
    asset = await get_org_asset_or_404(db, user, asset_id)
    if not data:
        raise HTTPException(400, detail="Empty file")
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(400, detail="File exceeds 50MB limit")

    safe_name = sanitize_filename(filename)
    mime = guess_mime(safe_name, content_type)
    _validate_mime(mime)

    storage = get_media_storage()
    old_key = asset.storage_key
    new_key = f"{user.organization_id}/{asset.id}/{safe_name}"
    url = storage.put_bytes(storage_key=new_key, data=data, content_type=mime)
    if old_key != new_key:
        storage.delete_key(old_key)

    asset.original_filename = safe_name
    asset.mime_type = mime
    asset.size_bytes = len(data)
    asset.storage_key = new_key
    asset.url = url
    asset.kind = infer_kind(mime, asset.kind if asset.kind in {"logo", "promo"} else None)
    asset.updated_at = _utcnow()
    await record_audit(
        db,
        organization_id=user.organization_id,
        actor=user,
        action="media.replaced",
        metadata={"mediaId": asset.id, "sizeBytes": asset.size_bytes},
    )
    await db.commit()
    await db.refresh(asset)
    return asset


async def delete_asset(
    db: AsyncSession, *, user: User, asset_id: str, force: bool = False
) -> None:
    require_permission(user, MEDIA_DELETE)
    asset = await get_org_asset_or_404(db, user, asset_id)
    if asset.usage_count > 0 and not force:
        raise HTTPException(
            status_code=400,
            detail=f"Asset is in use ({asset.usage_count}). Pass force=true to delete.",
        )
    storage = get_media_storage()
    storage.delete_key(asset.storage_key)
    await record_audit(
        db,
        organization_id=user.organization_id,
        actor=user,
        action="media.deleted",
        metadata={"mediaId": asset.id, "name": asset.name},
    )
    await db.delete(asset)
    await db.commit()


async def bump_usage(
    db: AsyncSession, *, asset_id: str, organization_id: str, delta: int = 1
) -> None:
    asset = await db.get(MediaAsset, asset_id)
    if asset is None or asset.organization_id != organization_id:
        return
    asset.usage_count = max(0, (asset.usage_count or 0) + delta)
    await db.commit()
