"""Unit tests for display animation helpers."""

from __future__ import annotations

# Pure Python mirror of clamp/merge rules for CI without Node.
# Frontend source of truth: frontend/lib/display/animations.ts


def merge_animations(partial: dict | None) -> dict:
    defaults = {
        "enabled": True,
        "boardTransition": "fade",
        "itemAnimation": "fade-in",
        "durationMs": 400,
        "staggerMs": 45,
        "animateOnUpdate": True,
    }
    if not partial:
        return dict(defaults)
    board = partial.get("boardTransition", defaults["boardTransition"])
    item = partial.get("itemAnimation", defaults["itemAnimation"])
    allowed_board = {
        "none",
        "fade",
        "slide",
        "slide-up",
        "slide-down",
        "zoom",
        "scale",
        "wipe",
        "dissolve",
        "pan",
    }
    allowed_item = {
        "none",
        "fade-in",
        "slide-up",
        "slide-left",
        "zoom-in",
        "scale-in",
    }
    duration = partial.get("durationMs", defaults["durationMs"])
    stagger = partial.get("staggerMs", defaults["staggerMs"])
    try:
        duration = int(duration)
    except (TypeError, ValueError):
        duration = defaults["durationMs"]
    try:
        stagger = int(stagger)
    except (TypeError, ValueError):
        stagger = defaults["staggerMs"]
    return {
        "enabled": partial.get("enabled", defaults["enabled"]),
        "boardTransition": board if board in allowed_board else defaults["boardTransition"],
        "itemAnimation": item if item in allowed_item else defaults["itemAnimation"],
        "durationMs": max(150, min(900, duration)),
        "staggerMs": max(0, min(200, stagger)),
        "animateOnUpdate": partial.get(
            "animateOnUpdate", defaults["animateOnUpdate"]
        ),
    }


def item_delay_ms(index: int, stagger_ms: int, max_index: int = 16) -> int:
    return min(index, max_index) * stagger_ms


def test_merge_defaults():
    cfg = merge_animations(None)
    assert cfg["boardTransition"] == "fade"
    assert cfg["enabled"] is True


def test_merge_clamps_duration():
    cfg = merge_animations({"durationMs": 5000, "staggerMs": -10})
    assert cfg["durationMs"] == 900
    assert cfg["staggerMs"] == 0


def test_merge_rejects_unknown_effects():
    cfg = merge_animations({"boardTransition": "explode", "itemAnimation": "spin"})
    assert cfg["boardTransition"] == "fade"
    assert cfg["itemAnimation"] == "fade-in"


def test_item_delay_capped():
    assert item_delay_ms(0, 45) == 0
    assert item_delay_ms(3, 45) == 135
    assert item_delay_ms(100, 45) == 16 * 45
