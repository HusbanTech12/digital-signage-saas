"""Default structured menu-board config for templates."""

from __future__ import annotations

from copy import deepcopy
from typing import Any

DEFAULT_DISPLAY_CONFIG: dict[str, Any] = {
    "layout": "premium",
    "brandTitle": "Menu Board",
    "subtitle": "TODAY'S MENU",
    "accentColor": "#c4a574",
    "backgroundColor": "#0c0c0e",
    "textColor": "#fafaf9",
    "mutedColor": "#71717a",
    "soldOutColor": "#991b1b",
    "categories": ["Starters", "Mains", "Sweets"],
    "showClock": True,
    "showSoldOut": True,
    "animations": {
        "enabled": True,
        "boardTransition": "fade",
    "itemAnimation": "fade-in",
    "durationMs": 400,
    "staggerMs": 45,
        "animateOnUpdate": True,
    },
}


def default_display_config() -> dict[str, Any]:
    return deepcopy(DEFAULT_DISPLAY_CONFIG)


def as_premium_display_config(value: dict[str, Any] | None) -> dict[str, Any]:
    """Ensure a template always has a structured menu-board config."""
    merged = default_display_config()
    if value:
        merged.update(value)
    merged["layout"] = "premium"
    if not merged.get("categories"):
        merged["categories"] = list(DEFAULT_DISPLAY_CONFIG["categories"])
    return merged
