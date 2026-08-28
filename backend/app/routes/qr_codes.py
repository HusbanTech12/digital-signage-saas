from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.clerk import get_current_user
from app.auth.permissions import QR_READ, require_permission
from app.schemas.media import MediaAssetOut
from app.schemas.qr_code import (
    QrCodeCreate,
    QrCodeListOut,
    QrCodeOut,
    QrCodeUpdate,
    QrPreviewIn,
    QrPreviewOut,
    QrPublicMenuOut,
    QrPublicResolveOut,
)
from app.services import qr_codes as qr_service
from db.models import User
from db.session import get_db

router = APIRouter(prefix="/api/v1/qr-codes", tags=["qr-codes"])

#: Unauthenticated render + resolve. Access is gated by the unguessable short
#: code, matching how kiosk screens and printed codes are consumed.
public_router = APIRouter(prefix="/api/v1/public/qr", tags=["qr-codes"])

#: Short redirect origin encoded into tracked QR codes.
redirect_router = APIRouter(tags=["qr-codes"])

RENDER_CACHE_HEADERS = {
    # Short window: editing an untracked code changes what this URL renders,
    # and screens hold the same URL across publishes.
    "Cache-Control": "public, max-age=60",
    # <img> requests carry no Origin, so CORS middleware never sees them.
    "Access-Control-Allow-Origin": "*",
}


@router.get("", response_model=QrCodeListOut)
async def list_qr_codes(
    q: str | None = Query(default=None),
    destination_type: str | None = Query(default=None),
    location_id: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> QrCodeListOut:
    rows, total = await qr_service.list_qr_codes(
        db,
        user=user,
        q=q,
        destination_type=destination_type,
        location_id=location_id,
        limit=limit,
        offset=offset,
    )
    return QrCodeListOut(
        qr_codes=[
            QrCodeOut.model_validate(await qr_service.to_out_payload(db, qr))
            for qr in rows
        ],
        total=total,
    )


@router.post("", response_model=QrCodeOut, status_code=status.HTTP_201_CREATED)
async def create_qr_code(
    body: QrCodeCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> QrCodeOut:
    qr = await qr_service.create_qr_code(db, user=user, body=body)
    return QrCodeOut.model_validate(await qr_service.to_out_payload(db, qr))


@router.post("/preview", response_model=QrPreviewOut)
async def preview_qr_code(
    body: QrPreviewIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> QrPreviewOut:
    """Live editor preview — renders a draft without persisting it."""
    svg, encoded_value = await qr_service.preview_svg(db, user=user, body=body)
    return QrPreviewOut(svg=svg, encoded_value=encoded_value)


@router.get("/{qr_id}", response_model=QrCodeOut)
async def get_qr_code(
    qr_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> QrCodeOut:
    require_permission(user, QR_READ)
    qr = await qr_service.get_org_qr_or_404(db, user, qr_id)
    return QrCodeOut.model_validate(await qr_service.to_out_payload(db, qr))


@router.patch("/{qr_id}", response_model=QrCodeOut)
async def update_qr_code(
    qr_id: str,
    body: QrCodeUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> QrCodeOut:
    qr = await qr_service.update_qr_code(db, user=user, qr_id=qr_id, body=body)
    return QrCodeOut.model_validate(await qr_service.to_out_payload(db, qr))


@router.delete("/{qr_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_qr_code(
    qr_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    await qr_service.delete_qr_code(db, user=user, qr_id=qr_id)


@router.post(
    "/{qr_id}/save-to-media",
    response_model=MediaAssetOut,
    status_code=status.HTTP_201_CREATED,
)
async def save_qr_to_media(
    qr_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MediaAssetOut:
    """Render a PNG into the Media Library for reuse in templates and playlists."""
    asset = await qr_service.save_to_media(db, user=user, qr_id=qr_id)
    return MediaAssetOut.model_validate(asset)


@public_router.get("/{short_code}", response_model=QrPublicResolveOut)
async def resolve_qr_code(
    short_code: str,
    count_scan: bool = Query(default=True, alias="countScan"),
    db: AsyncSession = Depends(get_db),
) -> QrPublicResolveOut:
    qr, redirect_url, menu_payload = await qr_service.resolve_scan(
        db, short_code, count_scan=count_scan
    )
    return QrPublicResolveOut(
        short_code=qr.short_code,
        name=qr.name,
        destination_type=qr.destination_type,
        caption=qr.caption,
        redirect_url=redirect_url,
        menu=QrPublicMenuOut.model_validate(menu_payload) if menu_payload else None,
    )


@public_router.get("/{short_code}/render.svg")
async def render_qr_svg(
    short_code: str,
    db: AsyncSession = Depends(get_db),
) -> Response:
    qr = await qr_service.get_by_short_code(db, short_code)
    data, media_type = await qr_service.render_qr(db, qr, fmt="svg")
    return Response(content=data, media_type=media_type, headers=RENDER_CACHE_HEADERS)


@public_router.get("/{short_code}/render.png")
async def render_qr_png(
    short_code: str,
    size: int | None = Query(default=None, ge=128, le=2048),
    db: AsyncSession = Depends(get_db),
) -> Response:
    qr = await qr_service.get_by_short_code(db, short_code)
    data, media_type = await qr_service.render_qr(db, qr, fmt="png", size_px=size)
    return Response(content=data, media_type=media_type, headers=RENDER_CACHE_HEADERS)


@redirect_router.get("/q/{short_code}", include_in_schema=False)
async def follow_qr_code(
    short_code: str,
    db: AsyncSession = Depends(get_db),
) -> RedirectResponse:
    """Scan target for tracked codes — counts the scan, then forwards."""
    qr, _, _ = await qr_service.resolve_scan(db, short_code, include_menu=False)
    target = qr_service.scan_redirect_url(qr)
    if not target:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="This QR code does not point to a web destination",
        )
    return RedirectResponse(
        url=target, status_code=status.HTTP_307_TEMPORARY_REDIRECT
    )
