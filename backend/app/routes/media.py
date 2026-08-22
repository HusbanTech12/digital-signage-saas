from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Response,
    UploadFile,
    status,
)
from fastapi.responses import RedirectResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.clerk import get_current_user
from app.auth.permissions import MEDIA_READ, require_permission
from app.schemas.media import (
    MediaAssetOut,
    MediaAssetUpdate,
    MediaDownloadOut,
    MediaFolderCreate,
    MediaFolderOut,
    MediaFolderUpdate,
    MediaListOut,
)
from app.services import media as media_service
from app.services.storage import get_media_storage
from db.models import MediaAsset, User
from db.session import get_db

router = APIRouter(prefix="/api/v1/media", tags=["media"])


def _parse_tags(raw: str | None) -> list[str] | None:
    if raw is None or raw.strip() == "":
        return None
    return [t.strip() for t in raw.split(",") if t.strip()]


@router.get("", response_model=MediaListOut)
async def list_media(
    q: str | None = Query(default=None),
    kind: str | None = Query(default=None),
    folder_id: str | None = Query(default=None),
    tag: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MediaListOut:
    assets, folders, total = await media_service.list_media(
        db,
        user=user,
        q=q,
        kind=kind,
        folder_id=folder_id,
        tag=tag,
        limit=limit,
        offset=offset,
    )
    return MediaListOut(
        assets=[MediaAssetOut.model_validate(a) for a in assets],
        folders=[MediaFolderOut.model_validate(f) for f in folders],
        total=total,
    )


@router.get("/assets/{asset_id}", response_model=MediaAssetOut)
async def get_asset(
    asset_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MediaAssetOut:
    require_permission(user, MEDIA_READ)
    asset = await media_service.get_org_asset_or_404(db, user, asset_id)
    return MediaAssetOut.model_validate(asset)


@router.post("/upload", response_model=MediaAssetOut, status_code=status.HTTP_201_CREATED)
async def upload_media(
    file: UploadFile = File(...),
    name: str | None = Form(default=None),
    kind: str | None = Form(default=None),
    folder_id: str | None = Form(default=None),
    tags: str | None = Form(default=None),
    notes: str | None = Form(default=None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MediaAssetOut:
    data = await file.read()
    asset = await media_service.upload_asset(
        db,
        user=user,
        filename=file.filename or "upload.bin",
        data=data,
        content_type=file.content_type,
        name=name,
        kind=kind,
        folder_id=folder_id or None,
        tags=_parse_tags(tags),
        notes=notes,
    )
    return MediaAssetOut.model_validate(asset)


@router.patch("/assets/{asset_id}", response_model=MediaAssetOut)
async def update_asset(
    asset_id: str,
    body: MediaAssetUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MediaAssetOut:
    asset = await media_service.update_asset(
        db,
        user=user,
        asset_id=asset_id,
        name=body.name,
        kind=body.kind,
        folder_id=body.folder_id,
        clear_folder=body.clear_folder,
        tags=body.tags,
        notes=body.notes,
    )
    return MediaAssetOut.model_validate(asset)


@router.put("/assets/{asset_id}/content", response_model=MediaAssetOut)
async def replace_asset(
    asset_id: str,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MediaAssetOut:
    data = await file.read()
    asset = await media_service.replace_asset_content(
        db,
        user=user,
        asset_id=asset_id,
        filename=file.filename or "upload.bin",
        data=data,
        content_type=file.content_type,
    )
    return MediaAssetOut.model_validate(asset)


@router.delete("/assets/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_asset(
    asset_id: str,
    force: bool = Query(default=False),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    await media_service.delete_asset(db, user=user, asset_id=asset_id, force=force)


@router.get("/assets/{asset_id}/download", response_model=MediaDownloadOut)
async def download_asset(
    asset_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MediaDownloadOut | RedirectResponse:
    require_permission(user, MEDIA_READ)
    asset = await media_service.get_org_asset_or_404(db, user, asset_id)
    storage = get_media_storage()
    signed = storage.signed_download_url(asset.storage_key)
    if signed:
        return MediaDownloadOut(url=signed, expires_in=3600)
    # Local / public URL
    return MediaDownloadOut(url=asset.url, expires_in=None)


@router.get("/content/{org_id}/{asset_id}/{filename}")
async def serve_local_content(
    org_id: str,
    asset_id: str,
    filename: str,
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Serve locally stored media for <img>/<video> tags.

    No Bearer header — browsers cannot attach Authorization on media elements.
    Access is gated by unguessable asset IDs + storage_key match (same model as
    public object URLs when using S3).
    """
    asset = await db.get(MediaAsset, asset_id)
    if (
        asset is None
        or asset.organization_id != org_id
        or asset.storage_key != f"{org_id}/{asset_id}/{filename}"
    ):
        raise HTTPException(status_code=404, detail="File not found")
    data = get_media_storage().read_bytes(asset.storage_key)
    if data is None:
        raise HTTPException(status_code=404, detail="File missing on disk")
    return StreamingResponse(
        iter([data]),
        media_type=asset.mime_type,
        headers={
            "Content-Disposition": f'inline; filename="{asset.original_filename}"',
            "Cache-Control": "private, max-age=3600",
            # Allow dashboard (localhost:3000) to load images from API origin
            "Access-Control-Allow-Origin": "*",
        },
    )


@router.post(
    "/folders",
    response_model=MediaFolderOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_folder(
    body: MediaFolderCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MediaFolderOut:
    folder = await media_service.create_folder(
        db, user=user, name=body.name, parent_id=body.parent_id
    )
    return MediaFolderOut.model_validate(folder)


@router.patch("/folders/{folder_id}", response_model=MediaFolderOut)
async def update_folder(
    folder_id: str,
    body: MediaFolderUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MediaFolderOut:
    folder = await media_service.update_folder(
        db,
        user=user,
        folder_id=folder_id,
        name=body.name,
        parent_id=body.parent_id,
        set_parent="parent_id" in body.model_fields_set,
    )
    return MediaFolderOut.model_validate(folder)


@router.delete("/folders/{folder_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_folder(
    folder_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    await media_service.delete_folder(db, user=user, folder_id=folder_id)
