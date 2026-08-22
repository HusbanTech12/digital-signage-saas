/**
 * Centralized permission catalog (mirrors backend/app/auth/permissions.py).
 * Prefer these helpers over scattering role string checks in UI.
 */

import type { Role, User } from "@/lib/types/schema";

export const PERMISSIONS = {
  ORGANIZATION_READ: "organization.read",
  ORGANIZATION_UPDATE: "organization.update",
  TEAM_READ: "team.read",
  TEAM_INVITE: "team.invite",
  TEAM_UPDATE: "team.update",
  TEAM_REMOVE: "team.remove",
  LOCATIONS_READ: "locations.read",
  LOCATIONS_CREATE: "locations.create",
  LOCATIONS_UPDATE: "locations.update",
  LOCATIONS_DELETE: "locations.delete",
  SCREENS_READ: "screens.read",
  SCREENS_CREATE: "screens.create",
  SCREENS_UPDATE: "screens.update",
  SCREENS_DELETE: "screens.delete",
  SCREENS_PAIR: "screens.pair",
  SCREENS_PUBLISH: "screens.publish",
  MENUS_READ: "menus.read",
  MENUS_CREATE: "menus.create",
  MENUS_UPDATE: "menus.update",
  MENUS_DELETE: "menus.delete",
  TEMPLATES_READ: "templates.read",
  TEMPLATES_CREATE: "templates.create",
  TEMPLATES_UPDATE: "templates.update",
  TEMPLATES_DELETE: "templates.delete",
  MEDIA_READ: "media.read",
  MEDIA_UPLOAD: "media.upload",
  MEDIA_UPDATE: "media.update",
  MEDIA_DELETE: "media.delete",
  PLAYLISTS_READ: "playlists.read",
  PLAYLISTS_CREATE: "playlists.create",
  PLAYLISTS_UPDATE: "playlists.update",
  PLAYLISTS_DELETE: "playlists.delete",
  PLAYLISTS_PUBLISH: "playlists.publish",
  SCHEDULES_READ: "schedules.read",
  SCHEDULES_CREATE: "schedules.create",
  SCHEDULES_UPDATE: "schedules.update",
  SCHEDULES_DELETE: "schedules.delete",
  POS_READ: "pos.read",
  POS_CONFIGURE: "pos.configure",
  ANALYTICS_READ: "analytics.read",
  AUDIT_READ: "audit.read",
  OWNERSHIP_TRANSFER: "ownership.transfer",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const ALL = Object.values(PERMISSIONS);

const CONTENT = [
  PERMISSIONS.MENUS_READ,
  PERMISSIONS.MENUS_CREATE,
  PERMISSIONS.MENUS_UPDATE,
  PERMISSIONS.MENUS_DELETE,
  PERMISSIONS.TEMPLATES_READ,
  PERMISSIONS.TEMPLATES_CREATE,
  PERMISSIONS.TEMPLATES_UPDATE,
  PERMISSIONS.TEMPLATES_DELETE,
  PERMISSIONS.MEDIA_READ,
  PERMISSIONS.MEDIA_UPLOAD,
  PERMISSIONS.MEDIA_UPDATE,
  PERMISSIONS.MEDIA_DELETE,
  PERMISSIONS.PLAYLISTS_READ,
  PERMISSIONS.PLAYLISTS_CREATE,
  PERMISSIONS.PLAYLISTS_UPDATE,
  PERMISSIONS.PLAYLISTS_DELETE,
  PERMISSIONS.PLAYLISTS_PUBLISH,
  PERMISSIONS.SCHEDULES_READ,
  PERMISSIONS.SCHEDULES_CREATE,
  PERMISSIONS.SCHEDULES_UPDATE,
  PERMISSIONS.SCHEDULES_DELETE,
  PERMISSIONS.SCREENS_READ,
  PERMISSIONS.SCREENS_PUBLISH,
  PERMISSIONS.ORGANIZATION_READ,
  PERMISSIONS.LOCATIONS_READ,
  PERMISSIONS.ANALYTICS_READ,
] as const;

const LOCATION_MANAGER = [
  PERMISSIONS.ORGANIZATION_READ,
  PERMISSIONS.LOCATIONS_READ,
  PERMISSIONS.SCREENS_READ,
  PERMISSIONS.SCREENS_CREATE,
  PERMISSIONS.SCREENS_UPDATE,
  PERMISSIONS.SCREENS_DELETE,
  PERMISSIONS.SCREENS_PAIR,
  PERMISSIONS.SCREENS_PUBLISH,
  PERMISSIONS.MENUS_READ,
  PERMISSIONS.MENUS_CREATE,
  PERMISSIONS.MENUS_UPDATE,
  PERMISSIONS.MENUS_DELETE,
  PERMISSIONS.TEMPLATES_READ,
  PERMISSIONS.TEMPLATES_CREATE,
  PERMISSIONS.TEMPLATES_UPDATE,
  PERMISSIONS.TEMPLATES_DELETE,
  PERMISSIONS.MEDIA_READ,
  PERMISSIONS.MEDIA_UPLOAD,
  PERMISSIONS.MEDIA_UPDATE,
  PERMISSIONS.MEDIA_DELETE,
  PERMISSIONS.PLAYLISTS_READ,
  PERMISSIONS.PLAYLISTS_CREATE,
  PERMISSIONS.PLAYLISTS_UPDATE,
  PERMISSIONS.PLAYLISTS_DELETE,
  PERMISSIONS.PLAYLISTS_PUBLISH,
  PERMISSIONS.SCHEDULES_READ,
  PERMISSIONS.SCHEDULES_CREATE,
  PERMISSIONS.SCHEDULES_UPDATE,
  PERMISSIONS.SCHEDULES_DELETE,
  PERMISSIONS.POS_READ,
  PERMISSIONS.POS_CONFIGURE,
  PERMISSIONS.ANALYTICS_READ,
] as const;

const VIEWER = [
  PERMISSIONS.ORGANIZATION_READ,
  PERMISSIONS.LOCATIONS_READ,
  PERMISSIONS.SCREENS_READ,
  PERMISSIONS.MENUS_READ,
  PERMISSIONS.TEMPLATES_READ,
  PERMISSIONS.MEDIA_READ,
  PERMISSIONS.PLAYLISTS_READ,
  PERMISSIONS.SCHEDULES_READ,
  PERMISSIONS.POS_READ,
  PERMISSIONS.ANALYTICS_READ,
] as const;

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  super_admin: ALL,
  admin: ALL.filter((p) => p !== PERMISSIONS.OWNERSHIP_TRANSFER),
  location_manager: LOCATION_MANAGER,
  content_manager: CONTENT,
  viewer: VIEWER,
};

export const ORG_WIDE_ROLES: Role[] = [
  "super_admin",
  "admin",
  "content_manager",
];

export function permissionsForRole(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function hasPermission(
  userOrRole: User | Role,
  permission: Permission,
): boolean {
  if (typeof userOrRole === "string") {
    return permissionsForRole(userOrRole).includes(permission);
  }
  if (userOrRole.status === "suspended") return false;
  return permissionsForRole(userOrRole.role).includes(permission);
}

export function canManageTeam(userOrRole: User | Role) {
  return (
    hasPermission(userOrRole, PERMISSIONS.TEAM_READ) ||
    hasPermission(userOrRole, PERMISSIONS.TEAM_INVITE)
  );
}
