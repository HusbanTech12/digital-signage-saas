"""QR code generator — permissions, destination rules, and rendering."""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.auth.permissions import (
    QR_CREATE,
    QR_DELETE,
    QR_READ,
    QR_UPDATE,
    has_permission,
    permissions_for_role,
)
from app.services import qr_codes as qr_service
from app.services.qr_render import (
    EYE_SIZE,
    QrStyle,
    build_matrix,
    logo_geometry,
    render_png,
    render_svg,
)
from db.models import QrCode


class FakeUser:
    def __init__(self, role: str, status: str = "active"):
        self.role = role
        self.status = status


def make_qr(**overrides) -> QrCode:
    defaults = dict(
        id="qr_test",
        organization_id="org_demo_001",
        name="Table tent",
        short_code="abc23xyz45",
        destination_type="url",
        target_url="https://example.com/promo",
        tracking_enabled=True,
        foreground_color="#000000",
        background_color="#ffffff",
        module_shape="square",
        eye_shape="square",
        error_correction="M",
        quiet_zone=4,
        logo_size_ratio=0.0,
        size_px=512,
        scan_count=0,
    )
    defaults.update(overrides)
    return QrCode(**defaults)


# --- permissions -------------------------------------------------------------


def test_qr_permissions_by_role():
    assert QR_READ in permissions_for_role("viewer")
    assert QR_CREATE not in permissions_for_role("viewer")
    for perm in (QR_READ, QR_CREATE, QR_UPDATE, QR_DELETE):
        assert perm in permissions_for_role("content_manager")
        assert perm in permissions_for_role("location_manager")
        assert perm in permissions_for_role("admin")
        assert perm in permissions_for_role("super_admin")


def test_suspended_member_loses_qr_access():
    assert has_permission(FakeUser("admin"), QR_CREATE)
    assert not has_permission(FakeUser("admin", status="suspended"), QR_CREATE)


# --- destinations ------------------------------------------------------------


def test_normalize_target_url_adds_scheme():
    assert qr_service.normalize_target_url("example.com/menu") == (
        "https://example.com/menu"
    )
    assert qr_service.normalize_target_url("http://a.test") == "http://a.test"
    assert qr_service.normalize_target_url("  ") is None


@pytest.mark.parametrize("raw", ["javascript:alert(1)", "data:text/html,x", "ftp://a"])
def test_normalize_target_url_rejects_unsafe_schemes(raw: str):
    with pytest.raises(HTTPException) as err:
        qr_service.normalize_target_url(raw)
    assert err.value.status_code == 400


def test_validate_destination_requires_matching_field():
    with pytest.raises(HTTPException):
        qr_service.validate_destination(
            destination_type="url", target_url=None, menu_id=None, text_payload=None
        )
    with pytest.raises(HTTPException):
        qr_service.validate_destination(
            destination_type="menu", target_url=None, menu_id=None, text_payload=None
        )
    with pytest.raises(HTTPException):
        qr_service.validate_destination(
            destination_type="text", target_url=None, menu_id=None, text_payload="  "
        )
    qr_service.validate_destination(
        destination_type="ordering",
        target_url="https://order.test",
        menu_id=None,
        text_payload=None,
    )


def test_encoded_value_routes_tracked_codes_through_api():
    tracked = make_qr(tracking_enabled=True)
    assert qr_service.encoded_value(tracked).endswith(f"/q/{tracked.short_code}")

    direct = make_qr(tracking_enabled=False)
    assert qr_service.encoded_value(direct) == "https://example.com/promo"


def test_encoded_value_for_menu_and_text():
    menu_qr = make_qr(destination_type="menu", menu_id="menu_1", target_url=None)
    assert qr_service.encoded_value(menu_qr).endswith(f"/m/{menu_qr.short_code}")
    assert qr_service.public_url(menu_qr) is not None

    text_qr = make_qr(
        destination_type="text", target_url=None, text_payload="Table 4  "
    )
    assert qr_service.encoded_value(text_qr) == "Table 4"
    assert qr_service.public_url(text_qr) is None


def test_scan_redirect_url_only_for_web_destinations():
    assert qr_service.scan_redirect_url(make_qr()) == "https://example.com/promo"
    menu_qr = make_qr(destination_type="menu", menu_id="menu_1", target_url=None)
    assert "/m/" in (qr_service.scan_redirect_url(menu_qr) or "")
    text_qr = make_qr(destination_type="text", target_url=None, text_payload="hi")
    assert qr_service.scan_redirect_url(text_qr) is None


async def test_out_payload_matches_response_model():
    """`QrCodeOut` forbids extras, so the payload keys must line up exactly."""
    from datetime import datetime, timezone

    from app.schemas.qr_code import QrCodeOut

    now = datetime.now(timezone.utc)
    qr = make_qr(created_at=now, updated_at=now)
    # No menu and no logo, so this never reaches the database.
    payload = await qr_service.to_out_payload(None, qr)
    out = QrCodeOut.model_validate(payload)
    dumped = out.model_dump(by_alias=True)
    assert dumped["shortCode"] == qr.short_code
    assert dumped["encodedValue"].endswith(f"/q/{qr.short_code}")
    assert dumped["renderSvgUrl"].endswith("render.svg")


def test_render_paths_use_short_code():
    qr = make_qr()
    assert qr_service.render_svg_path(qr) == (
        f"/api/v1/public/qr/{qr.short_code}/render.svg"
    )
    assert qr_service.render_png_path(qr).endswith("render.png")


# --- rendering ---------------------------------------------------------------


def test_build_matrix_is_square_and_has_finder_patterns():
    matrix = build_matrix("https://example.com/promo", "M")
    size = len(matrix)
    assert size >= 21
    assert all(len(row) == size for row in matrix)
    for ox, oy in ((0, 0), (size - EYE_SIZE, 0), (0, size - EYE_SIZE)):
        assert matrix[oy][ox] is True
        assert matrix[oy + 1][ox + 1] is False


def test_error_correction_level_changes_matrix_size():
    low = build_matrix("https://example.com/a-fairly-long-promo-url", "L")
    high = build_matrix("https://example.com/a-fairly-long-promo-url", "H")
    assert len(high) >= len(low)


def test_render_svg_includes_geometry_and_colors():
    matrix = build_matrix("https://example.com", "M")
    style = QrStyle(foreground="#112233", background="#ffffff", quiet_zone=2)
    svg = render_svg(matrix, style, caption="Scan for menu")
    total = len(matrix) + 4
    assert svg.startswith("<svg")
    assert svg.endswith("</svg>")
    assert f'viewBox="0 0 {total}' in svg
    assert "#112233" in svg
    assert "Scan for menu" in svg


def test_render_svg_transparent_background_skips_backdrop():
    matrix = build_matrix("hello", "M")
    svg = render_svg(matrix, QrStyle(background="transparent"))
    assert "<rect x=\"0\" y=\"0\"" not in svg


def test_render_svg_escapes_caption_text():
    matrix = build_matrix("hello", "M")
    svg = render_svg(matrix, QrStyle(), caption='<script>"x"</script>')
    assert "<script>" not in svg
    assert "&lt;script&gt;" in svg


def test_render_svg_dot_modules_use_circles():
    matrix = build_matrix("hello", "M")
    assert "<circle" in render_svg(matrix, QrStyle(module_shape="dot"))
    assert "<circle" not in render_svg(matrix, QrStyle(module_shape="square"))


def test_logo_geometry_is_centered_and_capped():
    assert logo_geometry(33, 0.0) is None
    side, knockout = logo_geometry(33, 0.9)  # clamped to MAX_LOGO_RATIO
    assert side <= 33 * 0.3 + 1
    assert knockout == side + 2


def test_render_png_returns_png_at_requested_size():
    from PIL import Image
    from io import BytesIO

    matrix = build_matrix("https://example.com", "M")
    data = render_png(matrix, QrStyle(), size_px=256)
    assert data[:8] == b"\x89PNG\r\n\x1a\n"
    image = Image.open(BytesIO(data))
    assert image.width == 256


def test_render_png_pixels_match_the_encoded_matrix():
    """Every module (including finder patterns) must land where segno put it."""
    from io import BytesIO

    from PIL import Image

    matrix = build_matrix("https://example.com/promo", "M")
    n = len(matrix)
    quiet = 4
    total = n + 2 * quiet
    size = 512
    data = render_png(
        matrix, QrStyle(quiet_zone=quiet), size_px=size
    )
    pixels = Image.open(BytesIO(data)).convert("L")

    for y, row in enumerate(matrix):
        for x, dark in enumerate(row):
            px = int((x + quiet + 0.5) * pixels.width / total)
            py = int((y + quiet + 0.5) * pixels.height / total)
            luma = pixels.getpixel((px, py))
            if dark:
                assert luma < 96, f"module ({x},{y}) should be dark, got {luma}"
            else:
                assert luma > 160, f"module ({x},{y}) should be light, got {luma}"


def test_render_png_with_caption_is_taller_than_wide():
    from PIL import Image
    from io import BytesIO

    matrix = build_matrix("https://example.com", "M")
    data = render_png(matrix, QrStyle(), caption="Order online", size_px=256)
    image = Image.open(BytesIO(data))
    assert image.height > image.width
