"""Orientation helpers.

Orientation is the only screen-shape setting the product exposes. Layouts are
authored in a fixed design-space board per orientation and the kiosk stretches
that board to fill whatever resolution the physical TV reports, so no pixel
dimension is ever required from an admin.
"""

from __future__ import annotations

LANDSCAPE_BOARD: tuple[int, int] = (1280, 720)
PORTRAIT_BOARD: tuple[int, int] = (720, 1280)

LANDSCAPE_RESOLUTION = "1920x1080"
PORTRAIT_RESOLUTION = "1080x1920"


def board_size(orientation: str | None) -> tuple[int, int]:
    """Design-space board (width, height) for an orientation."""
    return PORTRAIT_BOARD if orientation == "portrait" else LANDSCAPE_BOARD


def nominal_resolution(orientation: str | None) -> str:
    """Resolution kept on records for reporting only — layout never reads it."""
    return PORTRAIT_RESOLUTION if orientation == "portrait" else LANDSCAPE_RESOLUTION


def orientation_of_board(width: int | float, height: int | float) -> str:
    return "portrait" if height > width else "landscape"
