/**
 * Tenant mutations for org / location / screen / pairing.
 * Uses FastAPI when NEXT_PUBLIC_API_URL is set; otherwise the in-memory mock store.
 */

import { ApiError } from "@/lib/api/client";
import {
  completePairingApi,
  createLocationApi,
  createOrganizationApi,
  deleteLocationApi,
  deleteScreenApi,
  getMyOrganizationApi,
  listLocations,
  listOrganizationsApi,
  listScreens,
  onboardMeApi,
  startPairingSessionApi,
  updateLocationApi,
  updateOrganizationApi,
  updateScreenApi,
} from "@/lib/api/tenant";
import {
  listMenuItemsApi,
  listMenusApi,
  listTemplatesApi,
} from "@/lib/api/menus";
import { listThemesApi } from "@/lib/api/themes";
import { DEFAULT_ORGANIZATION_ID, useLiveApi } from "@/lib/api/config";
import {
  completePairing as completePairingMock,
  createLocation as createLocationMock,
  createOrganization as createOrganizationMock,
  deleteLocation as deleteLocationMock,
  deleteScreen as deleteScreenMock,
  hydrateTenantData,
  removeLocationLocal,
  removeScreenLocal,
  startPairingSession as startPairingSessionMock,
  updateLocation as updateLocationMock,
  updateOrganization as updateOrganizationMock,
  updateScreen as updateScreenMock,
  upsertLocation,
  upsertOrganization,
  upsertScreen,
  getMockStoreSnapshot,
} from "@/lib/mock-api/store";
import type {
  Location,
  Organization,
  PendingPairing,
  Screen,
  ScreenOrientation,
} from "@/lib/types/schema";

type Token = string;

export async function ensureProvisioned(token: Token) {
  try {
    return await getMyOrganizationApi(token);
  } catch (err) {
    const needsOnboard =
      err instanceof ApiError &&
      err.status === 403 &&
      /not provisioned/i.test(err.message);
    if (!needsOnboard) throw err;
    const onboarded = await onboardMeApi(token);
    return onboarded.organization;
  }
}

/** Ensure Clerk user exists in API DB, then run the mutation (retry once if needed). */
export async function withProvisioned<T>(
  token: Token,
  action: () => Promise<T>,
): Promise<T> {
  await ensureProvisioned(token);
  try {
    return await action();
  } catch (err) {
    const needsOnboard =
      err instanceof ApiError &&
      err.status === 403 &&
      /not provisioned/i.test(err.message);
    if (!needsOnboard) throw err;
    await onboardMeApi(token);
    return await action();
  }
}

export async function refreshTenantFromApi(token: Token) {
  const organization = await ensureProvisioned(token);
  const [locations, screens, menus, menuItems, templates, themes] =
    await Promise.all([
      listLocations(token),
      listScreens(token),
      listMenusApi(token),
      listMenuItemsApi(token),
      listTemplatesApi(token),
      listThemesApi(token).catch(() => []),
    ]);
  hydrateTenantData({
    organizations: [organization],
    locations,
    screens,
    menus,
    menuItems,
    templates,
    themes,
  });
  return {
    organization,
    locations,
    screens,
    menus,
    menuItems,
    templates,
    themes,
  };
}

/** Lightweight poll so dashboard online/offline status stays fresh. */
export async function refreshScreensFromApi(token: Token) {
  const screens = await listScreens(token);
  hydrateTenantData({ screens });
  return screens;
}

export async function updateOrganization(
  organizationId: string,
  patch: Partial<Pick<Organization, "name" | "slug">>,
  token?: Token | null,
): Promise<Organization> {
  if (useLiveApi() && token) {
    const org = await withProvisioned(token, () =>
      updateOrganizationApi(token, organizationId, patch),
    );
    upsertOrganization(org);
    return org;
  }
  return updateOrganizationMock(organizationId, patch);
}

export async function createOrganization(
  input: { name: string; slug: string },
  token?: Token | null,
): Promise<Organization> {
  if (useLiveApi() && token) {
    const org = await withProvisioned(token, () =>
      createOrganizationApi(token, input),
    );
    upsertOrganization(org);
    return org;
  }
  return createOrganizationMock(input);
}

export async function listOrganizations(
  token?: Token | null,
): Promise<Organization[]> {
  if (useLiveApi() && token) {
    const orgs = await withProvisioned(token, () =>
      listOrganizationsApi(token),
    );
    hydrateTenantData({ organizations: orgs });
    return orgs;
  }
  return getMockStoreSnapshot().organizations.map((o) => ({ ...o }));
}

export async function createLocation(
  input: {
    organizationId: string;
    name: string;
    address: string;
    timezone: string;
  },
  token?: Token | null,
): Promise<Location> {
  if (useLiveApi() && token) {
    const location = await withProvisioned(token, () =>
      createLocationApi(token, input),
    );
    upsertLocation(location);
    return location;
  }
  return createLocationMock(input);
}

export async function updateLocation(
  locationId: string,
  patch: Partial<Pick<Location, "name" | "address" | "timezone">>,
  token?: Token | null,
): Promise<Location> {
  if (useLiveApi() && token) {
    const location = await withProvisioned(token, () =>
      updateLocationApi(token, locationId, patch),
    );
    upsertLocation(location);
    return location;
  }
  return updateLocationMock(locationId, patch);
}

export async function deleteLocation(
  locationId: string,
  token?: Token | null,
): Promise<void> {
  if (useLiveApi() && token) {
    await withProvisioned(token, () => deleteLocationApi(token, locationId));
    removeLocationLocal(locationId);
    return;
  }
  deleteLocationMock(locationId);
}

export async function updateScreen(
  screenId: string,
  patch: Partial<
    Pick<Screen, "name" | "locationId" | "orientation" | "resolution">
  >,
  token?: Token | null,
): Promise<Screen> {
  if (useLiveApi() && token) {
    const screen = await withProvisioned(token, () =>
      updateScreenApi(token, screenId, patch),
    );
    upsertScreen(screen);
    return screen;
  }
  return updateScreenMock(screenId, patch);
}

export async function deleteScreen(
  screenId: string,
  token?: Token | null,
): Promise<void> {
  if (useLiveApi() && token) {
    await withProvisioned(token, () => deleteScreenApi(token, screenId));
    removeScreenLocal(screenId);
    return;
  }
  deleteScreenMock(screenId);
}

export async function startPairingSession(input?: {
  organizationId?: string;
  resolution?: string;
  orientation?: ScreenOrientation;
}): Promise<{ screen: Screen; pairing: PendingPairing }> {
  if (useLiveApi()) {
    const result = await startPairingSessionApi({
      organizationId: input?.organizationId ?? DEFAULT_ORGANIZATION_ID,
      resolution: input?.resolution,
      orientation: input?.orientation,
    });
    upsertScreen(result.screen);
    return result;
  }
  return startPairingSessionMock(input);
}

export async function completePairing(
  input: {
    code: string;
    locationId: string;
    name: string;
    organizationId: string;
    resolution?: string;
    orientation?: ScreenOrientation;
  },
  token?: Token | null,
): Promise<Screen> {
  if (useLiveApi() && token) {
    const screen = await withProvisioned(token, () =>
      completePairingApi(token, input),
    );
    upsertScreen(screen);
    return screen;
  }
  return completePairingMock(input);
}
