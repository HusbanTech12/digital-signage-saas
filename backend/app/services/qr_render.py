"""QR matrix generation and styled SVG/PNG rendering.

`segno` produces the module matrix; drawing lives here so module shapes, eye
shapes, logo knockout, and captions stay identical between the SVG and PNG
exports (and therefore between dashboard preview, print export, and kiosk).
"""

from __future__ import annotations

import base64
import math
from dataclasses import dataclass
from io import BytesIO

import segno

#: Finder patterns are always 7x7 modules in the three outer corners.
EYE_SIZE = 7
#: Caption band height, in module units.
CAPTION_UNITS = 3.4

MAX_LOGO_RATIO = 0.30


@dataclass(frozen=True)
class QrStyle:
    foreground: str = "#000000"
    background: str = "#ffffff"
    eye_color: str | None = None
    module_shape: str = "square"
    eye_shape: str = "square"
    quiet_zone: int = 4
    logo_ratio: float = 0.0

    @property
    def eye_fill(self) -> str:
        return self.eye_color or self.foreground

    @property
    def has_background(self) -> bool:
        return (self.background or "").strip().lower() not in (
            "",
            "none",
            "transparent",
        )


def build_matrix(data: str, error_correction: str = "M") -> list[list[bool]]:
    """Encode `data` and return the module matrix as rows of booleans."""
    if not data:
        raise ValueError("QR payload is empty")
    code = segno.make(
        data, error=(error_correction or "M").lower(), micro=False, boost_error=False
    )
    return [[bool(module) for module in row] for row in code.matrix]


def _in_eye(x: int, y: int, n: int) -> bool:
    for ex, ey in ((0, 0), (n - EYE_SIZE, 0), (0, n - EYE_SIZE)):
        if ex <= x < ex + EYE_SIZE and ey <= y < ey + EYE_SIZE:
            return True
    return False


def logo_geometry(n: int, ratio: float) -> tuple[float, float] | None:
    """Centered logo box as `(side, knockout_side)` in module units."""
    if ratio is None or ratio <= 0:
        return None
    side = max(3.0, round(min(ratio, MAX_LOGO_RATIO) * n))
    return side, side + 2.0


def _knockout_bounds(n: int, knockout: float) -> tuple[float, float]:
    origin = (n - knockout) / 2
    return origin, origin + knockout


def _module_hidden_by_logo(
    x: int, y: int, bounds: tuple[float, float] | None
) -> bool:
    if bounds is None:
        return False
    low, high = bounds
    return x + 1 > low and x < high and y + 1 > low and y < high


def _eye_rounding(eye_shape: str, size: float) -> float:
    if eye_shape == "circle":
        return size / 2
    if eye_shape == "rounded":
        return size * 0.28
    return 0.0


# --- SVG ---------------------------------------------------------------------


def render_svg(
    matrix: list[list[bool]],
    style: QrStyle,
    *,
    logo_data_uri: str | None = None,
    caption: str | None = None,
) -> str:
    n = len(matrix)
    q = max(0, min(8, style.quiet_zone))
    total = n + 2 * q
    caption_band = CAPTION_UNITS if caption else 0.0
    height = total + caption_band

    logo = logo_geometry(n, style.logo_ratio) if logo_data_uri else None
    knockout_bounds = _knockout_bounds(n, logo[1]) if logo else None

    rendering = "crispEdges" if style.module_shape == "square" else "geometricPrecision"
    parts: list[str] = [
        f'<svg xmlns="http://www.w3.org/2000/svg" '
        f'viewBox="0 0 {_num(total)} {_num(height)}" '
        f'width="{_num(total)}" height="{_num(height)}" '
        f'shape-rendering="{rendering}">'
    ]
    if style.has_background:
        parts.append(
            f'<rect x="0" y="0" width="{_num(total)}" height="{_num(height)}" '
            f'fill="{_esc(style.background)}"/>'
        )

    square_path: list[str] = []
    shaped: list[str] = []
    for y, row in enumerate(matrix):
        for x, dark in enumerate(row):
            if not dark or _in_eye(x, y, n):
                continue
            if _module_hidden_by_logo(x, y, knockout_bounds):
                continue
            cx, cy = x + q, y + q
            if style.module_shape == "dot":
                shaped.append(
                    f'<circle cx="{_num(cx + 0.5)}" cy="{_num(cy + 0.5)}" r="0.44"/>'
                )
            elif style.module_shape == "rounded":
                shaped.append(
                    f'<rect x="{_num(cx)}" y="{_num(cy)}" width="1" height="1" '
                    f'rx="0.3" ry="0.3"/>'
                )
            else:
                square_path.append(f"M{_num(cx)} {_num(cy)}h1v1h-1z")

    if square_path:
        parts.append(
            f'<path fill="{_esc(style.foreground)}" d="{"".join(square_path)}"/>'
        )
    if shaped:
        parts.append(f'<g fill="{_esc(style.foreground)}">{"".join(shaped)}</g>')

    parts.append(_eyes_svg(n, q, style))

    if logo and logo_data_uri:
        side, knockout = logo
        k_origin = (n - knockout) / 2 + q
        l_origin = (n - side) / 2 + q
        if style.has_background:
            parts.append(
                f'<rect x="{_num(k_origin)}" y="{_num(k_origin)}" '
                f'width="{_num(knockout)}" height="{_num(knockout)}" '
                f'rx="{_num(knockout * 0.12)}" fill="{_esc(style.background)}"/>'
            )
        parts.append(
            f'<image x="{_num(l_origin)}" y="{_num(l_origin)}" '
            f'width="{_num(side)}" height="{_num(side)}" '
            f'preserveAspectRatio="xMidYMid meet" '
            f'href="{_esc(logo_data_uri)}"/>'
        )

    if caption:
        parts.append(
            f'<text x="{_num(total / 2)}" y="{_num(total + CAPTION_UNITS * 0.72)}" '
            f'text-anchor="middle" font-family="system-ui, sans-serif" '
            f'font-size="{_num(CAPTION_UNITS * 0.62)}" font-weight="600" '
            f'fill="{_esc(style.foreground)}">{_esc(caption)}</text>'
        )

    parts.append("</svg>")
    return "".join(parts)


def _eyes_svg(n: int, q: int, style: QrStyle) -> str:
    # The ring is stroked with width 1, so its path sits on the 0.5 offset and
    # the painted band covers exactly the outermost module of the 7x7 finder.
    ring_r = _eye_rounding(style.eye_shape, EYE_SIZE - 1)
    pupil_r = _eye_rounding(style.eye_shape, 3)
    fill = _esc(style.eye_fill)
    out: list[str] = []
    for ex, ey in ((0, 0), (n - EYE_SIZE, 0), (0, n - EYE_SIZE)):
        x, y = ex + q, ey + q
        out.append(
            f'<rect x="{_num(x + 0.5)}" y="{_num(y + 0.5)}" width="6" height="6" '
            f'rx="{_num(ring_r)}" fill="none" stroke="{fill}" stroke-width="1"/>'
        )
        out.append(
            f'<rect x="{_num(x + 2)}" y="{_num(y + 2)}" width="3" height="3" '
            f'rx="{_num(pupil_r)}" fill="{fill}"/>'
        )
    return "".join(out)


def _num(value: float) -> str:
    if abs(value - round(value)) < 1e-9:
        return str(int(round(value)))
    return f"{value:.3f}".rstrip("0").rstrip(".")


def _esc(value: str) -> str:
    return (
        str(value)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def logo_data_uri(data: bytes, mime_type: str) -> str:
    return f"data:{mime_type or 'image/png'};base64,{base64.b64encode(data).decode()}"


# --- PNG ---------------------------------------------------------------------


def render_png(
    matrix: list[list[bool]],
    style: QrStyle,
    *,
    logo_bytes: bytes | None = None,
    caption: str | None = None,
    size_px: int = 512,
) -> bytes:
    from PIL import Image, ImageDraw, ImageFont

    n = len(matrix)
    q = max(0, min(8, style.quiet_zone))
    total = n + 2 * q
    target = max(128, min(2048, int(size_px)))
    scale = max(4, math.ceil(target / total))
    width = total * scale
    caption_h = int(round(CAPTION_UNITS * scale)) if caption else 0

    bg = style.background if style.has_background else (255, 255, 255, 0)
    image = Image.new("RGBA", (width, width + caption_h), bg)
    draw = ImageDraw.Draw(image)

    logo = logo_geometry(n, style.logo_ratio) if logo_bytes else None
    knockout_bounds = _knockout_bounds(n, logo[1]) if logo else None

    for y, row in enumerate(matrix):
        for x, dark in enumerate(row):
            if not dark or _in_eye(x, y, n):
                continue
            if _module_hidden_by_logo(x, y, knockout_bounds):
                continue
            x0 = (x + q) * scale
            y0 = (y + q) * scale
            box = (x0, y0, x0 + scale - 1, y0 + scale - 1)
            if style.module_shape == "dot":
                draw.ellipse(box, fill=style.foreground)
            elif style.module_shape == "rounded":
                draw.rounded_rectangle(
                    box, radius=max(1, int(scale * 0.3)), fill=style.foreground
                )
            else:
                draw.rectangle(box, fill=style.foreground)

    _draw_eyes_png(draw, n, q, scale, style)

    if logo and logo_bytes:
        side, knockout = logo
        if style.has_background:
            k0 = int(round(((n - knockout) / 2 + q) * scale))
            k1 = int(round(k0 + knockout * scale))
            draw.rounded_rectangle(
                (k0, k0, k1, k1),
                radius=max(1, int(knockout * scale * 0.12)),
                fill=style.background,
            )
        try:
            logo_img = Image.open(BytesIO(logo_bytes)).convert("RGBA")
            side_px = max(1, int(round(side * scale)))
            logo_img.thumbnail((side_px, side_px), Image.LANCZOS)
            offset = int(round(((n - side) / 2 + q) * scale))
            image.alpha_composite(
                logo_img,
                (
                    offset + (side_px - logo_img.width) // 2,
                    offset + (side_px - logo_img.height) // 2,
                ),
            )
        except Exception:  # noqa: BLE001 — a broken logo must not break export
            pass

    if caption:
        font_px = max(8, int(round(CAPTION_UNITS * scale * 0.55)))
        try:
            font = ImageFont.load_default(size=font_px)
        except TypeError:  # Pillow < 10.1 has no sizeable default font
            font = ImageFont.load_default()
        draw.text(
            (width / 2, width + caption_h / 2),
            caption,
            fill=style.foreground,
            font=font,
            anchor="mm",
        )

    if width != target:
        image = image.resize(
            (target, int(round((width + caption_h) * target / width))), Image.LANCZOS
        )

    buffer = BytesIO()
    image.save(buffer, format="PNG", optimize=True)
    return buffer.getvalue()


def _draw_eyes_png(draw, n: int, q: int, scale: int, style: QrStyle) -> None:
    outer_r = int(round(_eye_rounding(style.eye_shape, EYE_SIZE) * scale))
    inner_r = int(round(_eye_rounding(style.eye_shape, 3) * scale))
    for ex, ey in ((0, 0), (n - EYE_SIZE, 0), (0, n - EYE_SIZE)):
        x0 = (ex + q) * scale
        y0 = (ey + q) * scale
        outer = (x0, y0, x0 + EYE_SIZE * scale - 1, y0 + EYE_SIZE * scale - 1)
        inner_hole = (
            x0 + scale,
            y0 + scale,
            x0 + (EYE_SIZE - 1) * scale - 1,
            y0 + (EYE_SIZE - 1) * scale - 1,
        )
        pupil = (
            x0 + 2 * scale,
            y0 + 2 * scale,
            x0 + 5 * scale - 1,
            y0 + 5 * scale - 1,
        )
        if outer_r > 0:
            draw.rounded_rectangle(outer, radius=outer_r, fill=style.eye_fill)
            draw.rounded_rectangle(
                inner_hole,
                radius=max(0, outer_r - scale),
                fill=style.background if style.has_background else (0, 0, 0, 0),
            )
            draw.rounded_rectangle(pupil, radius=inner_r, fill=style.eye_fill)
        else:
            draw.rectangle(outer, fill=style.eye_fill)
            draw.rectangle(
                inner_hole,
                fill=style.background if style.has_background else (0, 0, 0, 0),
            )
            draw.rectangle(pupil, fill=style.eye_fill)
