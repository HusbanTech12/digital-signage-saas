"""Centralized permission catalog and role → permission map.

Roles (stored on users.role; keep legacy names for compatibility):
  super_admin       → Organization Owner
  admin             → Organization Admin
  location_manager  → Location Manager
  content_manager   → Content Manager
  viewer            → Viewer
"""

from __future__ import annotations

from fastapi import HTTPException, status

from db.models import User

# --- Permission strings -----------------------------------------------------

ORGANIZATION_READ = "organization.read"
ORGANIZATION_UPDATE = "organization.update"
TEAM_READ = "team.read"
TEAM_INVITE = "team.invite"
TEAM_UPDATE = "team.update"
TEAM_REMOVE = "team.remove"
LOCATIONS_READ = "locations.read"
LOCATIONS_CREATE = "locations.create"
LOCATIONS_UPDATE = "locations.update"
LOCATIONS_DELETE = "locations.delete"
SCREENS_READ = "screens.read"
SCREENS_CREATE = "screens.create"
SCREENS_UPDATE = "screens.update"
SCREENS_DELETE = "screens.delete"
SCREENS_PAIR = "screens.pair"
SCREENS_PUBLISH = "screens.publish"
MENUS_READ = "menus.read"
MENUS_CREATE = "menus.create"
MENUS_UPDATE = "menus.update"
MENUS_DELETE = "menus.delete"
TEMPLATES_READ = "templates.read"
TEMPLATES_CREATE = "templates.create"
TEMPLATES_UPDATE = "templates.update"
TEMPLATES_DELETE = "templates.delete"
MEDIA_READ = "media.read"
MEDIA_UPLOAD = "media.upload"
MEDIA_UPDATE = "media.update"
MEDIA_DELETE = "media.delete"
PLAYLISTS_READ = "playlists.read"
PLAYLISTS_CREATE = "playlists.create"
PLAYLISTS_UPDATE = "playlists.update"
PLAYLISTS_DELETE = "playlists.delete"
PLAYLISTS_PUBLISH = "playlists.publish"
AUDIO_READ = "audio.read"
AUDIO_CREATE = "audio.create"
AUDIO_UPDATE = "audio.update"
AUDIO_DELETE = "audio.delete"
AUDIO_PUBLISH = "audio.publish"
SCHEDULES_READ = "schedules.read"
SCHEDULES_CREATE = "schedules.create"
SCHEDULES_UPDATE = "schedules.update"
SCHEDULES_DELETE = "schedules.delete"
POS_READ = "pos.read"
POS_CONFIGURE = "pos.configure"
ANALYTICS_READ = "analytics.read"
AUDIT_READ = "audit.read"
OWNERSHIP_TRANSFER = "ownership.transfer"

ALL_PERMISSIONS: frozenset[str] = frozenset(
    {
        ORGANIZATION_READ,
        ORGANIZATION_UPDATE,
        TEAM_READ,
        TEAM_INVITE,
        TEAM_UPDATE,
        TEAM_REMOVE,
        LOCATIONS_READ,
        LOCATIONS_CREATE,
        LOCATIONS_UPDATE,
        LOCATIONS_DELETE,
        SCREENS_READ,
        SCREENS_CREATE,
        SCREENS_UPDATE,
        SCREENS_DELETE,
        SCREENS_PAIR,
        SCREENS_PUBLISH,
        MENUS_READ,
        MENUS_CREATE,
        MENUS_UPDATE,
        MENUS_DELETE,
        TEMPLATES_READ,
        TEMPLATES_CREATE,
        TEMPLATES_UPDATE,
        TEMPLATES_DELETE,
        MEDIA_READ,
        MEDIA_UPLOAD,
        MEDIA_UPDATE,
        MEDIA_DELETE,
        PLAYLISTS_READ,
        PLAYLISTS_CREATE,
        PLAYLISTS_UPDATE,
        PLAYLISTS_DELETE,
        PLAYLISTS_PUBLISH,
        AUDIO_READ,
        AUDIO_CREATE,
        AUDIO_UPDATE,
        AUDIO_DELETE,
        AUDIO_PUBLISH,
        SCHEDULES_READ,
        SCHEDULES_CREATE,
        SCHEDULES_UPDATE,
        SCHEDULES_DELETE,
        POS_READ,
        POS_CONFIGURE,
        ANALYTICS_READ,
        AUDIT_READ,
        OWNERSHIP_TRANSFER,
    }
)

_CONTENT_PERMS = frozenset(
    {
        MENUS_READ,
        MENUS_CREATE,
        MENUS_UPDATE,
        MENUS_DELETE,
        TEMPLATES_READ,
        TEMPLATES_CREATE,
        TEMPLATES_UPDATE,
        TEMPLATES_DELETE,
        MEDIA_READ,
        MEDIA_UPLOAD,
        MEDIA_UPDATE,
        MEDIA_DELETE,
        PLAYLISTS_READ,
        PLAYLISTS_CREATE,
        PLAYLISTS_UPDATE,
        PLAYLISTS_DELETE,
        PLAYLISTS_PUBLISH,
        AUDIO_READ,
        AUDIO_CREATE,
        AUDIO_UPDATE,
        AUDIO_DELETE,
        AUDIO_PUBLISH,
        SCHEDULES_READ,
        SCHEDULES_CREATE,
        SCHEDULES_UPDATE,
        SCHEDULES_DELETE,
        SCREENS_READ,
        SCREENS_PUBLISH,
        ORGANIZATION_READ,
        LOCATIONS_READ,
        ANALYTICS_READ,
    }
)

_LOCATION_MANAGER_PERMS = frozenset(
    {
        ORGANIZATION_READ,
        LOCATIONS_READ,
        SCREENS_READ,
        SCREENS_CREATE,
        SCREENS_UPDATE,
        SCREENS_DELETE,
        SCREENS_PAIR,
        SCREENS_PUBLISH,
        MENUS_READ,
        MENUS_CREATE,
        MENUS_UPDATE,
        MENUS_DELETE,
        TEMPLATES_READ,
        TEMPLATES_CREATE,
        TEMPLATES_UPDATE,
        TEMPLATES_DELETE,
        MEDIA_READ,
        MEDIA_UPLOAD,
        MEDIA_UPDATE,
        MEDIA_DELETE,
        PLAYLISTS_READ,
        PLAYLISTS_CREATE,
        PLAYLISTS_UPDATE,
        PLAYLISTS_DELETE,
        PLAYLISTS_PUBLISH,
        AUDIO_READ,
        AUDIO_CREATE,
        AUDIO_UPDATE,
        AUDIO_DELETE,
        AUDIO_PUBLISH,
        SCHEDULES_READ,
        SCHEDULES_CREATE,
        SCHEDULES_UPDATE,
        SCHEDULES_DELETE,
        POS_READ,
        POS_CONFIGURE,
        ANALYTICS_READ,
    }
)

_VIEWER_PERMS = frozenset(
    {
        ORGANIZATION_READ,
        LOCATIONS_READ,
        SCREENS_READ,
        MENUS_READ,
        TEMPLATES_READ,
        MEDIA_READ,
        PLAYLISTS_READ,
        AUDIO_READ,
        SCHEDULES_READ,
        POS_READ,
        ANALYTICS_READ,
    }
)

_ADMIN_PERMS = ALL_PERMISSIONS - {OWNERSHIP_TRANSFER}

ROLE_PERMISSIONS: dict[str, frozenset[str]] = {
    "super_admin": ALL_PERMISSIONS,
    "admin": _ADMIN_PERMS,
    "location_manager": _LOCATION_MANAGER_PERMS,
    "content_manager": _CONTENT_PERMS,
    "viewer": _VIEWER_PERMS,
}

ASSIGNABLE_ROLES: frozenset[str] = frozenset(
    {
        "super_admin",
        "admin",
        "location_manager",
        "content_manager",
        "viewer",
    }
)

# Roles that always see all org locations (ignore location_ids for access)
ALWAYS_ALL_LOCATIONS_ROLES: frozenset[str] = frozenset({"super_admin", "admin"})

# Roles that see all org locations when location_ids is empty
ORG_WIDE_ROLES: frozenset[str] = frozenset(
    {"super_admin", "admin", "content_manager"}
)

# Roles that must be scoped to explicit location_ids (unless empty = deny all)
LOCATION_SCOPED_ROLES: frozenset[str] = frozenset(
    {"location_manager", "viewer"}
)

ROLE_LABELS: dict[str, str] = {
    "super_admin": "Organization Owner",
    "admin": "Organization Admin",
    "location_manager": "Location Manager",
    "content_manager": "Content Manager",
    "viewer": "Viewer",
}


def permissions_for_role(role: str) -> frozenset[str]:
    return ROLE_PERMISSIONS.get(role, frozenset())


def has_permission(user: User, permission: str) -> bool:
    if getattr(user, "status", "active") == "suspended":
        return False
    return permission in permissions_for_role(user.role)


def require_permission(user: User, permission: str) -> None:
    if not has_permission(user, permission):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Missing permission: {permission}",
        )


def require_any_permission(user: User, *permissions: str) -> None:
    if any(has_permission(user, p) for p in permissions):
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Insufficient permissions for this action",
    )


def is_owner(user: User) -> bool:
    return user.role == "super_admin"


def validate_assignable_role(role: str) -> str:
    if role not in ASSIGNABLE_ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role: {role}",
        )
    return role
