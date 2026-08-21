/**
 * Mock app session for role-aware UI during the frontend-first phase.
 * Clerk handles sign-in; role/org scope comes from here until the backend ships.
 */

import { organizations, users } from "@/lib/mock-data";
import type { MockSession, Role } from "@/lib/types/schema";

const STORAGE_KEY = "dss_mock_role";

const DEFAULT_ROLE: Role = "super_admin";

const ALL_ROLES: Role[] = [
  "super_admin",
  "admin",
  "location_manager",
  "content_manager",
  "viewer",
];

function userForRole(role: Role) {
  return users.find((u) => u.role === role) ?? users[0];
}

export function getMockSession(role: Role = DEFAULT_ROLE): MockSession {
  const user = userForRole(role);
  const organization = organizations.find((o) => o.id === user.organizationId)!;
  return { user, organization };
}

export function readStoredRole(): Role {
  if (typeof window === "undefined") return DEFAULT_ROLE;
  const stored = window.localStorage.getItem(STORAGE_KEY) as Role | null;
  if (stored && ALL_ROLES.includes(stored)) return stored;
  return DEFAULT_ROLE;
}

export function writeStoredRole(role: Role) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, role);
}

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Organization Owner",
  admin: "Organization Admin",
  location_manager: "Location Manager",
  content_manager: "Content Manager",
  viewer: "Viewer",
};

export const ASSIGNABLE_ROLES: Role[] = ALL_ROLES;
