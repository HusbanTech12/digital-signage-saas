import type { Location, Role, Screen, User } from "@/lib/types/schema";

export function canManageOrganization(role: Role) {
  return role === "super_admin";
}

export function canManageLocations(role: Role) {
  return role === "super_admin" || role === "admin";
}

export function canCreateLocation(role: Role) {
  return role === "super_admin" || role === "admin";
}

export function canDeleteLocation(role: Role) {
  return role === "super_admin";
}

export function canManageScreens(role: Role) {
  return (
    role === "super_admin" || role === "admin" || role === "location_manager"
  );
}

export function canPairScreens(role: Role) {
  return canManageScreens(role);
}

export function canManageMenus(role: Role) {
  return (
    role === "super_admin" || role === "admin" || role === "location_manager"
  );
}

export function canPublishMenus(role: Role) {
  return canManageMenus(role);
}

export function canManageTemplates(role: Role) {
  return role === "super_admin" || role === "admin";
}

export function canManageThemes(role: Role) {
  return role === "super_admin" || role === "admin";
}

export function canManagePos(role: Role) {
  return role === "super_admin" || role === "admin";
}

/** Open / edit designer canvas (includes Location Manager for publish flow). */
export function canEditDesigner(role: Role) {
  return canManageMenus(role);
}


/** Locations visible to the current user. */
export function filterLocationsForUser(
  locations: Location[],
  user: User,
): Location[] {
  const orgLocations = locations.filter(
    (l) => l.organizationId === user.organizationId,
  );
  // Super Admin + Admin: all org locations. Location Manager: scoped list.
  if (user.role === "super_admin" || user.role === "admin") return orgLocations;
  return orgLocations.filter((l) => user.locationIds.includes(l.id));
}

/** Screens visible to the current user (by location scope). */
export function filterScreensForUser(screens: Screen[], user: User): Screen[] {
  const orgScreens = screens.filter(
    (s) => s.organizationId === user.organizationId,
  );
  if (user.role === "super_admin" || user.role === "admin") return orgScreens;
  return orgScreens.filter(
    (s) => s.locationId !== null && user.locationIds.includes(s.locationId),
  );
}

export function canAccessLocation(user: User, locationId: string) {
  if (user.role === "super_admin" || user.role === "admin") return true;
  return user.locationIds.includes(locationId);
}
