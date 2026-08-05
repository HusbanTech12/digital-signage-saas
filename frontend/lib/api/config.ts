/** When set, dashboard org/location/screen calls hit the FastAPI backend. */
export function getApiBaseUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_API_URL?.trim();
  return url ? url.replace(/\/$/, "") : null;
}

/** Prefer live API when NEXT_PUBLIC_API_URL is configured. */
export function useLiveApi(): boolean {
  if (process.env.NEXT_PUBLIC_USE_MOCK_API === "true") return false;
  return Boolean(getApiBaseUrl());
}

export const DEFAULT_ORGANIZATION_ID =
  process.env.NEXT_PUBLIC_DEFAULT_ORGANIZATION_ID?.trim() || "org_demo_001";

/** Maps mock session roles → seeded clerk_user_id for DEV_AUTH_BYPASS. */
export const DEV_CLERK_USER_BY_ROLE = {
  super_admin: "user_clerk_super_demo",
  admin: "user_clerk_admin_demo",
  location_manager: "user_clerk_mgr_demo",
} as const;
