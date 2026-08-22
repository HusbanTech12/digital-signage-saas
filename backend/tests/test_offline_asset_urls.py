"""Mirror tests for offline asset URL extraction rules (Python parity)."""

from __future__ import annotations


def collect_raw_asset_urls(payload: dict) -> list[str]:
    urls: set[str] = set()

    def add(raw: object) -> None:
        if not isinstance(raw, str):
            return
        trimmed = raw.strip()
        if not trimmed or trimmed.startswith("blob:") or trimmed.startswith("data:"):
            return
        urls.add(trimmed)

    def walk_canvas(canvas: object) -> None:
        if not isinstance(canvas, dict):
            return
        objects = canvas.get("objects")
        if not isinstance(objects, list):
            return
        for obj in objects:
            if not isinstance(obj, dict):
                continue
            src = obj.get("src")
            if isinstance(src, str):
                add(src)
            fill = obj.get("fill")
            if isinstance(fill, str) and fill.startswith(("http://", "https://")):
                add(fill)

    for item in payload.get("items") or []:
        if isinstance(item, dict):
            add(item.get("imageUrl") or item.get("image_url"))

    walk_canvas(payload.get("canvasJson") or payload.get("canvas_json"))

    playlist = payload.get("playlist") or {}
    for slide in playlist.get("slides") or []:
        if not isinstance(slide, dict):
            continue
        add(slide.get("mediaUrl") or slide.get("media_url"))
        for item in slide.get("items") or []:
            if isinstance(item, dict):
                add(item.get("imageUrl") or item.get("image_url"))
        walk_canvas(slide.get("canvasJson") or slide.get("canvas_json"))

    return sorted(urls)


def test_collects_playlist_media_and_item_images():
    urls = collect_raw_asset_urls(
        {
            "items": [{"imageUrl": "https://cdn.example/a.jpg"}],
            "playlist": {
                "slides": [
                    {"mediaUrl": "https://cdn.example/promo.mp4", "items": []},
                    {
                        "mediaUrl": None,
                        "items": [{"imageUrl": "https://cdn.example/b.png"}],
                    },
                ]
            },
            "canvasJson": {
                "objects": [{"type": "image", "src": "https://cdn.example/logo.png"}]
            },
        }
    )
    assert "https://cdn.example/a.jpg" in urls
    assert "https://cdn.example/promo.mp4" in urls
    assert "https://cdn.example/b.png" in urls
    assert "https://cdn.example/logo.png" in urls


def test_skips_blob_and_data_urls():
    urls = collect_raw_asset_urls(
        {
            "items": [{"imageUrl": "blob:abc"}, {"imageUrl": "data:image/png;base64,xx"}],
            "playlist": {"slides": []},
        }
    )
    assert urls == []
