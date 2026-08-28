import type { Location, Role, Screen, User } from "@/lib/types/schema";
import {
  PERMISSIONS,
  canManageTeam,
  hasPermission,
} from "@/lib/permissions";

const ALWAYS_ALL_LOCATIONS: Role[] = ["super_admin", "admin"];

export function canManageOrganization(role: Role) {
  return hasPermission(role, PERMISSIONS.ORGANIZATION_UPDATE);
}

export function canManageLocations(role: Role) {
  return (
    hasPermission(role, PERMISSIONS.LOCATIONS_CREATE) ||
    hasPermission(role, PERMISSIONS.LOCATIONS_UPDATE)
  );
}

export function canCreateLocation(role: Role) {
  return hasPermission(role, PERMISSIONS.LOCATIONS_CREATE);
}

export function canDeleteLocation(role: Role) {
  return hasPermission(role, PERMISSIONS.LOCATIONS_DELETE);
}

export function canManageScreens(role: Role) {
  return (
    hasPermission(role, PERMISSIONS.SCREENS_CREATE) ||
    hasPermission(role, PERMISSIONS.SCREENS_UPDATE)
  );
}

export function canPairScreens(role: Role) {
  return hasPermission(role, PERMISSIONS.SCREENS_PAIR);
}

export function canManageMenus(role: Role) {
  return (
    hasPermission(role, PERMISSIONS.MENUS_CREATE) ||
    hasPermission(role, PERMISSIONS.MENUS_UPDATE)
  );
}

export function canPublishMenus(role: Role) {
  return hasPermission(role, PERMISSIONS.SCREENS_PUBLISH);
}

export function canManageTemplates(role: Role) {
  return (
    hasPermission(role, PERMISSIONS.TEMPLATES_CREATE) ||
    hasPermission(role, PERMISSIONS.TEMPLATES_UPDATE)
  );
}

export function canManageThemes(role: Role) {
  return (
    hasPermission(role, PERMISSIONS.SCHEDULES_CREATE) ||
    hasPermission(role, PERMISSIONS.SCHEDULES_UPDATE)
  );
}

export function canManagePos(role: Role) {
  return hasPermission(role, PERMISSIONS.POS_CONFIGURE);
}

export function canManageMedia(role: Role) {
  return (
    hasPermission(role, PERMISSIONS.MEDIA_READ) ||
    hasPermission(role, PERMISSIONS.MEDIA_UPLOAD)
  );
}

export function canUploadMedia(role: Role) {
  return hasPermission(role, PERMISSIONS.MEDIA_UPLOAD);
}

export function canManagePlaylists(role: Role) {
  return (
    hasPermission(role, PERMISSIONS.PLAYLISTS_CREATE) ||
    hasPermission(role, PERMISSIONS.PLAYLISTS_UPDATE)
  );
}

export function canPublishPlaylists(role: Role) {
  return hasPermission(role, PERMISSIONS.PLAYLISTS_PUBLISH);
}

export function canManageAudio(role: Role) {
  return (
    hasPermission(role, PERMISSIONS.AUDIO_CREATE) ||
    hasPermission(role, PERMISSIONS.AUDIO_UPDATE)
  );
}

export function canPublishAudio(role: Role) {
  return hasPermission(role, PERMISSIONS.AUDIO_PUBLISH);
}

export function canManageQrCodes(role: Role) {
  return (
    hasPermission(role, PERMISSIONS.QR_CREATE) ||
    hasPermission(role, PERMISSIONS.QR_UPDATE)
  );
}

export function canDeleteQrCodes(role: Role) {
  return hasPermission(role, PERMISSIONS.QR_DELETE);
}

/** Open / edit designer canvas (includes Location Manager for publish flow). */
export function canEditDesigner(role: Role) {
  return canManageMenus(role);
}

export { canManageTeam };

/** Locations visible to the current user. */
export function filterLocationsForUser(
  locations: Location[],
  user: User,
): Location[] {
  const orgLocations = locations.filter(
    (l) => l.organizationId === user.organizationId,
  );
  if (ALWAYS_ALL_LOCATIONS.includes(user.role)) return orgLocations;
  if (user.role === "content_manager" && user.locationIds.length === 0) {
    return orgLocations;
  }
  return orgLocations.filter((l) => user.locationIds.includes(l.id));
}

/** Screens visible to the current user (by location scope). */
export function filterScreensForUser(screens: Screen[], user: User): Screen[] {
  const orgScreens = screens.filter(
    (s) => s.organizationId === user.organizationId,
  );
  if (ALWAYS_ALL_LOCATIONS.includes(user.role)) return orgScreens;
  if (user.role === "content_manager" && user.locationIds.length === 0) {
    return orgScreens;
  }
  return orgScreens.filter(
    (s) => s.locationId !== null && user.locationIds.includes(s.locationId),
  );
}

export function canAccessLocation(user: User, locationId: string) {
  if (ALWAYS_ALL_LOCATIONS.includes(user.role)) return true;
  if (user.role === "content_manager" && user.locationIds.length === 0) {
    return true;
  }
  return user.locationIds.includes(locationId);
}
