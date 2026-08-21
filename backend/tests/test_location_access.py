"""Location access enforcement unit tests."""

from types import SimpleNamespace

from app.auth.access import can_access_location


def test_location_manager_cannot_access_unassigned_location():
    user = SimpleNamespace(
        role="location_manager",
        location_ids=["loc_a"],
        status="active",
    )
    assert can_access_location(user, "loc_a")
    assert not can_access_location(user, "loc_b")


def test_admin_can_access_any_location_even_if_list_set():
    user = SimpleNamespace(
        role="admin",
        location_ids=["loc_a"],
        status="active",
    )
    assert can_access_location(user, "loc_b")


def test_viewer_scoped():
    user = SimpleNamespace(role="viewer", location_ids=["loc_a"], status="active")
    assert can_access_location(user, "loc_a")
    assert not can_access_location(user, "loc_x")
