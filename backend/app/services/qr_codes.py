"""QR code CRUD, payload resolution, rendering, and scan tracking."""

from __future__ import annotations

import secrets
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.access import (
    assert_location_access,
    can_access_location,
    get_org_location_or_404,
)
from app.auth.permissions import (
    QR_CREATE,
    QR_DELETE,
    QR_READ,
    QR_UPDATE,
    require_permission,
)
from app.config import get_settings
from app.services import media as media_service
from app.services.audit import record_audit
from app.services.qr_render import (
    QrStyle,
    build_matrix,
    logo_data_uri,
    render_png,
    render_svg,
)
from app.services.storage import get_media_storage
from app.utils.ids import new_id
from db.models import MediaAsset, Menu, MenuItem, Organization, QrCode, User
from db.models.qr_code import QR_REDIRECT_TYPES

SHORT_CODE_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789"
SHORT_CODE_LENGTH = 10


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _generate_short_code() -> str:
    return "".join(
        secrets.choice(SHORT_CODE_ALPHABET) for _ in range(SHORT_CODE_LENGTH)
    )


async def _unique_short_code(db: AsyncSession) -> str:
    for _ in range(8):
        code = _generate_short_code()
        existing = await db.scalar(
            select(func.count()).select_from(QrCode).where(QrCode.short_code == code)
        )
        if not existing:
            return code
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Could not allocate a QR short code, please retry",
    )


def normalize_target_url(raw: str | None) -> str | None:
    """Accept `example.com/menu` and store it as an absolute https URL."""
    if raw is None:
        return None
    value = raw.strip()
    if not value:
        return None
    lowered = value.lower()
    if lowered.startswith(("http://", "https://")):
        return value
    if lowered.startswith(("javascript:", "data:", "file:", "vbscript:")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Destination URL scheme is not allowed",
        )
    if "://" in value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Destination URL must be http or https",
        )
    return f"https://{value}"


def validate_destination(
    *,
    destination_type: str,
    target_url: str | None,
    menu_id: str | None,
    text_payload: str | None,
) -> None:
    """Enforce the field each destination kind depends on."""
    if destination_type in QR_REDIRECT_TYPES and not target_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A destination URL is required for this QR type",
        )
    if destination_type == "menu" and not menu_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Select a menu for a menu QR code",
        )
    if destination_type == "text" and not (text_payload or "").strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Enter the text this QR code should carry",
        )


def encoded_value(qr: QrCode) -> str:
    """The exact string the QR image encodes."""
    settings = get_settings()
    if qr.destination_type == "text":
        return (qr.text_payload or "").strip()
    if qr.destination_type == "menu":
        return f"{settings.public_frontend_origin}/m/{qr.short_code}"
    if qr.tracking_enabled:
        return f"{settings.public_api_origin}/q/{qr.short_code}"
    return qr.target_url or ""


def public_url(qr: QrCode) -> str | None:
    if qr.destination_type == "text":
        return None
    return encoded_value(qr) or None


def render_svg_path(qr: QrCode) -> str:
    return f"/api/v1/public/qr/{qr.short_code}/render.svg"


def render_png_path(qr: QrCode) -> str:
    return f"/api/v1/public/qr/{qr.short_code}/render.png"


def style_for(qr: QrCode, *, with_logo: bool) -> QrStyle:
    return QrStyle(
        foreground=qr.foreground_color,
        background=qr.background_color,
        eye_color=qr.eye_color,
        module_shape=qr.module_shape,
        eye_shape=qr.eye_shape,
        quiet_zone=qr.quiet_zone,
        logo_ratio=qr.logo_size_ratio if with_logo else 0.0,
    )


async def _logo_asset(db: AsyncSession, qr: QrCode) -> MediaAsset | None:
    if not qr.logo_media_asset_id:
        return None
    asset = await db.get(MediaAsset, qr.logo_media_asset_id)
    if asset is None or asset.organization_id != qr.organization_id:
        return None
    return asset


async def _logo_bytes(db: AsyncSession, qr: QrCode) -> tuple[bytes, str] | None:
    asset = await _logo_asset(db, qr)
    if asset is None:
        return None
    data = get_media_storage().read_bytes(asset.storage_key)
    if not data:
        return None
    return data, asset.mime_type


async def to_out_payload(db: AsyncSession, qr: QrCode) -> dict[str, Any]:
    """Model columns plus the derived fields `QrCodeOut` adds."""
    menu_name: str | None = None
    if qr.menu_id:
        menu = await db.get(Menu, qr.menu_id)
        if menu is not None and menu.organization_id == qr.organization_id:
            menu_name = menu.name
    logo = await _logo_asset(db, qr)
    return {
        "id": qr.id,
        "organization_id": qr.organization_id,
        "location_id": qr.location_id,
        "name": qr.name,
        "short_code": qr.short_code,
        "destination_type": qr.destination_type,
        "target_url": qr.target_url,
        "menu_id": qr.menu_id,
        "menu_name": menu_name,
        "text_payload": qr.text_payload,
        "tracking_enabled": qr.tracking_enabled,
        "foreground_color": qr.foreground_color,
        "background_color": qr.background_color,
        "eye_color": qr.eye_color,
        "module_shape": qr.module_shape,
        "eye_shape": qr.eye_shape,
        "error_correction": qr.error_correction,
        "quiet_zone": qr.quiet_zone,
        "logo_media_asset_id": qr.logo_media_asset_id,
        "logo_url": logo.url if logo else None,
        "logo_size_ratio": qr.logo_size_ratio,
        "caption": qr.caption,
        "size_px": qr.size_px,
        "scan_count": qr.scan_count,
        "last_scanned_at": qr.last_scanned_at,
        "created_by_user_id": qr.created_by_user_id,
        "created_at": qr.created_at,
        "updated_at": qr.updated_at,
        "encoded_value": encoded_value(qr),
        "public_url": public_url(qr),
        "render_svg_url": render_svg_path(qr),
        "render_png_url": render_png_path(qr),
    }


async def get_org_qr_or_404(db: AsyncSession, user: User, qr_id: str) -> QrCode:
    qr = await db.get(QrCode, qr_id)
    if qr is None or qr.organization_id != user.organization_id:
        raise HTTPException(status_code=404, detail="QR code not found")
    if qr.location_id:
        assert_location_access(user, qr.location_id)
    return qr


async def get_by_short_code(db: AsyncSession, short_code: str) -> QrCode:
    result = await db.execute(
        select(QrCode).where(QrCode.short_code == short_code.strip().lower())
    )
    qr = result.scalar_one_or_none()
    if qr is None:
        raise HTTPException(status_code=404, detail="QR code not found")
    return qr


async def list_qr_codes(
    db: AsyncSession,
    *,
    user: User,
    q: str | None = None,
    destination_type: str | None = None,
    location_id: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> tuple[list[QrCode], int]:
    require_permission(user, QR_READ)

    def scoped(stmt):
        stmt = stmt.where(QrCode.organization_id == user.organization_id)
        if q:
            like = f"%{q.strip().lower()}%"
            stmt = stmt.where(
                or_(
                    func.lower(QrCode.name).like(like),
                    func.lower(QrCode.short_code).like(like),
                    func.lower(func.coalesce(QrCode.target_url, "")).like(like),
                )
            )
        if destination_type:
            stmt = stmt.where(QrCode.destination_type == destination_type)
        if location_id == "__unassigned__":
            stmt = stmt.where(QrCode.location_id.is_(None))
        elif location_id:
            stmt = stmt.where(QrCode.location_id == location_id)
        return stmt

    total = int(
        await db.scalar(scoped(select(func.count()).select_from(QrCode))) or 0
    )
    rows = list(
        (
            await db.execute(
                scoped(select(QrCode))
                .order_by(QrCode.created_at.desc())
                .offset(max(0, offset))
                .limit(min(200, max(1, limit)))
            )
        )
        .scalars()
        .all()
    )
    # Location-scoped roles must not see codes tied to other locations.
    return [
        qr
        for qr in rows
        if qr.location_id is None or can_access_location(user, qr.location_id)
    ], total


async def _assert_menu_in_org(db: AsyncSession, user: User, menu_id: str) -> Menu:
    menu = await db.get(Menu, menu_id)
    if menu is None or menu.organization_id != user.organization_id:
        raise HTTPException(status_code=404, detail="Menu not found")
    return menu


async def _assert_logo_in_org(db: AsyncSession, user: User, asset_id: str) -> MediaAsset:
    asset = await media_service.get_org_asset_or_404(db, user, asset_id)
    if not (asset.mime_type or "").startswith("image/"):
        raise HTTPException(400, detail="Logo must be an image asset")
    return asset


async def create_qr_code(db: AsyncSession, *, user: User, body) -> QrCode:
    require_permission(user, QR_CREATE)

    target_url = normalize_target_url(body.target_url)
    validate_destination(
        destination_type=body.destination_type,
        target_url=target_url,
        menu_id=body.menu_id,
        text_payload=body.text_payload,
    )
    if body.menu_id:
        await _assert_menu_in_org(db, user, body.menu_id)
    if body.location_id:
        await get_org_location_or_404(db, user, body.location_id)
    if body.logo_media_asset_id:
        await _assert_logo_in_org(db, user, body.logo_media_asset_id)

    now = _utcnow()
    qr = QrCode(
        id=new_id("qr"),
        organization_id=user.organization_id,
        location_id=body.location_id,
        name=body.name.strip(),
        short_code=await _unique_short_code(db),
        destination_type=body.destination_type,
        target_url=target_url,
        menu_id=body.menu_id,
        text_payload=(body.text_payload or "").strip() or None,
        tracking_enabled=(
            body.tracking_enabled and body.destination_type in QR_REDIRECT_TYPES
        ),
        foreground_color=body.foreground_color,
        background_color=body.background_color,
        eye_color=body.eye_color,
        module_shape=body.module_shape,
        eye_shape=body.eye_shape,
        error_correction=body.error_correction,
        quiet_zone=body.quiet_zone,
        logo_media_asset_id=body.logo_media_asset_id,
        logo_size_ratio=body.logo_size_ratio,
        caption=(body.caption or "").strip() or None,
        size_px=body.size_px,
        scan_count=0,
        created_by_user_id=user.id,
        created_at=now,
        updated_at=now,
    )
    db.add(qr)
    if qr.logo_media_asset_id:
        await media_service.bump_usage(
            db, asset_id=qr.logo_media_asset_id, organization_id=qr.organization_id
        )
    await record_audit(
        db,
        organization_id=user.organization_id,
        actor=user,
        action="qr.created",
        metadata={
            "qrCodeId": qr.id,
            "name": qr.name,
            "destinationType": qr.destination_type,
        },
    )
    await db.commit()
    await db.refresh(qr)
    return qr


async def update_qr_code(
    db: AsyncSession, *, user: User, qr_id: str, body
) -> QrCode:
    require_permission(user, QR_UPDATE)
    qr = await get_org_qr_or_404(db, user, qr_id)
    fields = body.model_fields_set

    if body.name is not None:
        qr.name = body.name.strip()
    if "destination_type" in fields and body.destination_type is not None:
        qr.destination_type = body.destination_type
    if "target_url" in fields:
        qr.target_url = normalize_target_url(body.target_url)
    if "menu_id" in fields:
        if body.menu_id:
            await _assert_menu_in_org(db, user, body.menu_id)
        qr.menu_id = body.menu_id
    if "text_payload" in fields:
        qr.text_payload = (body.text_payload or "").strip() or None
    if body.clear_location:
        qr.location_id = None
    elif "location_id" in fields and body.location_id:
        await get_org_location_or_404(db, user, body.location_id)
        qr.location_id = body.location_id
    if body.tracking_enabled is not None:
        qr.tracking_enabled = body.tracking_enabled
    if body.foreground_color is not None:
        qr.foreground_color = body.foreground_color
    if body.background_color is not None:
        qr.background_color = body.background_color
    if body.clear_eye_color:
        qr.eye_color = None
    elif body.eye_color is not None:
        qr.eye_color = body.eye_color
    if body.module_shape is not None:
        qr.module_shape = body.module_shape
    if body.eye_shape is not None:
        qr.eye_shape = body.eye_shape
    if body.error_correction is not None:
        qr.error_correction = body.error_correction
    if body.quiet_zone is not None:
        qr.quiet_zone = body.quiet_zone
    if body.clear_logo:
        if qr.logo_media_asset_id:
            await media_service.bump_usage(
                db,
                asset_id=qr.logo_media_asset_id,
                organization_id=qr.organization_id,
                delta=-1,
            )
        qr.logo_media_asset_id = None
    elif "logo_media_asset_id" in fields and body.logo_media_asset_id:
        await _assert_logo_in_org(db, user, body.logo_media_asset_id)
        if qr.logo_media_asset_id != body.logo_media_asset_id:
            if qr.logo_media_asset_id:
                await media_service.bump_usage(
                    db,
                    asset_id=qr.logo_media_asset_id,
                    organization_id=qr.organization_id,
                    delta=-1,
                )
            await media_service.bump_usage(
                db,
                asset_id=body.logo_media_asset_id,
                organization_id=qr.organization_id,
            )
        qr.logo_media_asset_id = body.logo_media_asset_id
    if body.logo_size_ratio is not None:
        qr.logo_size_ratio = body.logo_size_ratio
    if "caption" in fields:
        qr.caption = (body.caption or "").strip() or None
    if body.size_px is not None:
        qr.size_px = body.size_px

    validate_destination(
        destination_type=qr.destination_type,
        target_url=qr.target_url,
        menu_id=qr.menu_id,
        text_payload=qr.text_payload,
    )
    if qr.destination_type not in QR_REDIRECT_TYPES:
        qr.tracking_enabled = False
    qr.updated_at = _utcnow()

    await record_audit(
        db,
        organization_id=user.organization_id,
        actor=user,
        action="qr.updated",
        metadata={"qrCodeId": qr.id, "name": qr.name},
    )
    await db.commit()
    await db.refresh(qr)
    return qr


async def delete_qr_code(db: AsyncSession, *, user: User, qr_id: str) -> None:
    require_permission(user, QR_DELETE)
    qr = await get_org_qr_or_404(db, user, qr_id)
    if qr.logo_media_asset_id:
        await media_service.bump_usage(
            db,
            asset_id=qr.logo_media_asset_id,
            organization_id=qr.organization_id,
            delta=-1,
        )
    await record_audit(
        db,
        organization_id=user.organization_id,
        actor=user,
        action="qr.deleted",
        metadata={"qrCodeId": qr.id, "name": qr.name},
    )
    await db.delete(qr)
    await db.commit()


async def render_qr(
    db: AsyncSession,
    qr: QrCode,
    *,
    fmt: str = "svg",
    size_px: int | None = None,
) -> tuple[bytes, str]:
    """Render the code to bytes. Returns `(data, media_type)`."""
    value = encoded_value(qr)
    if not value:
        raise HTTPException(400, detail="QR code has no destination to encode")
    try:
        matrix = build_matrix(value, qr.error_correction)
    except ValueError as err:
        raise HTTPException(400, detail=str(err)) from err

    logo = await _logo_bytes(db, qr)
    style = style_for(qr, with_logo=logo is not None)

    if fmt == "png":
        data = render_png(
            matrix,
            style,
            logo_bytes=logo[0] if logo else None,
            caption=qr.caption,
            size_px=size_px or qr.size_px,
        )
        return data, "image/png"

    svg = render_svg(
        matrix,
        style,
        logo_data_uri=logo_data_uri(*logo) if logo else None,
        caption=qr.caption,
    )
    return svg.encode("utf-8"), "image/svg+xml"


#: Stand-in short code so a draft preview encodes the same payload length as
#: the saved code will, and therefore the same module count.
PREVIEW_SHORT_CODE = "previewqr1"


async def preview_svg(db: AsyncSession, *, user: User, body) -> tuple[str, str]:
    """Render an unsaved draft. Never touches the database."""
    require_permission(user, QR_READ)
    target_url = normalize_target_url(body.target_url)
    validate_destination(
        destination_type=body.destination_type,
        target_url=target_url,
        menu_id=body.menu_id,
        text_payload=body.text_payload,
    )
    if body.logo_media_asset_id:
        await _assert_logo_in_org(db, user, body.logo_media_asset_id)

    draft = QrCode(
        id="qr_preview",
        organization_id=user.organization_id,
        name="Preview",
        short_code=PREVIEW_SHORT_CODE,
        destination_type=body.destination_type,
        target_url=target_url,
        menu_id=body.menu_id,
        text_payload=(body.text_payload or "").strip() or None,
        tracking_enabled=(
            body.tracking_enabled and body.destination_type in QR_REDIRECT_TYPES
        ),
        foreground_color=body.foreground_color,
        background_color=body.background_color,
        eye_color=body.eye_color,
        module_shape=body.module_shape,
        eye_shape=body.eye_shape,
        error_correction=body.error_correction,
        quiet_zone=body.quiet_zone,
        logo_media_asset_id=body.logo_media_asset_id,
        logo_size_ratio=body.logo_size_ratio,
        caption=(body.caption or "").strip() or None,
        size_px=512,
        scan_count=0,
    )
    data, _ = await render_qr(db, draft, fmt="svg")
    return data.decode("utf-8"), encoded_value(draft)


async def save_to_media(db: AsyncSession, *, user: User, qr_id: str) -> MediaAsset:
    """Export a PNG into the Media Library so designers can reuse it."""
    require_permission(user, QR_READ)
    qr = await get_org_qr_or_404(db, user, qr_id)
    data, _ = await render_qr(db, qr, fmt="png")
    slug = "".join(c if c.isalnum() else "-" for c in qr.name.lower()).strip("-")
    asset = await media_service.upload_asset(
        db,
        user=user,
        filename=f"qr-{slug or qr.short_code}.png",
        data=data,
        content_type="image/png",
        name=f"QR · {qr.name}",
        kind="promo",
        folder_id=None,
        tags=["qr"],
        notes=f"Generated from QR code {qr.short_code}",
    )
    return asset


def scan_redirect_url(qr: QrCode) -> str | None:
    """Where a scan of this code should land. `None` for plain-text codes."""
    if qr.destination_type in QR_REDIRECT_TYPES:
        return qr.target_url
    if qr.destination_type == "menu":
        return f"{get_settings().public_frontend_origin}/m/{qr.short_code}"
    return None


async def resolve_scan(
    db: AsyncSession,
    short_code: str,
    *,
    count_scan: bool = True,
    include_menu: bool = True,
) -> tuple[QrCode, str | None, dict[str, Any] | None]:
    """Public resolution for a scanned code: `(qr, redirect_url, menu_payload)`."""
    qr = await get_by_short_code(db, short_code)
    redirect_url: str | None = None
    menu_payload: dict[str, Any] | None = None

    if qr.destination_type in QR_REDIRECT_TYPES:
        redirect_url = qr.target_url
        if not redirect_url:
            raise HTTPException(status_code=410, detail="This QR code has no target")
    elif qr.destination_type == "menu" and include_menu:
        menu_payload = await _public_menu_payload(db, qr)

    if count_scan:
        qr.scan_count = (qr.scan_count or 0) + 1
        qr.last_scanned_at = _utcnow()
        await db.commit()
        await db.refresh(qr)

    return qr, redirect_url, menu_payload


async def _public_menu_payload(db: AsyncSession, qr: QrCode) -> dict[str, Any]:
    if not qr.menu_id:
        raise HTTPException(status_code=410, detail="This QR code has no menu")
    menu = await db.get(Menu, qr.menu_id)
    if menu is None or menu.organization_id != qr.organization_id:
        raise HTTPException(status_code=410, detail="This menu is no longer available")
    organization = await db.get(Organization, qr.organization_id)
    rows = list(
        (
            await db.execute(
                select(MenuItem)
                .where(MenuItem.menu_id == menu.id)
                .order_by(MenuItem.category, MenuItem.sort_order)
            )
        )
        .scalars()
        .all()
    )
    return {
        "id": menu.id,
        "name": menu.name,
        "version": menu.version,
        "organization_name": organization.name if organization else "",
        "items": [
            {
                "id": item.id,
                "name": item.name,
                "price": item.price,
                "description": item.description,
                "image_url": item.image_url,
                "available": item.available,
                "category": item.category,
                "sort_order": item.sort_order,
            }
            for item in rows
        ],
    }
