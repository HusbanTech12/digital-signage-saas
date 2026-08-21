"""Media library helpers (kind inference, filename sanitization)."""

from app.services.storage import infer_kind, sanitize_filename


def test_sanitize_filename():
    assert sanitize_filename("../../evil name!!.png") == "evil_name_.png"
    assert sanitize_filename("") == "file"


def test_infer_kind():
    assert infer_kind("image/png") == "image"
    assert infer_kind("video/mp4") == "video"
    assert infer_kind("audio/mpeg") == "audio"
    assert infer_kind("image/png", "logo") == "logo"
    assert infer_kind("application/pdf") == "other"
