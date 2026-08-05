/**
 * Tenant mutations for org / location / screen / pairing.
 * Uses FastAPI when NEXT_PUBLIC_API_URL is set; otherwise the in-memory mock store.
 */

import {
  completePairingApi,
  createLocationApi,
  deleteLocationApi,
  deleteScreenApi,
  getMyOrganizationApi,
  listLocations,
  listScreens,
  startPairingSessionApi,
  updateLocationApi,
  updateOrganizationApi,
  updateScreenApi,
} from "@/lib/api/tenant";
import { DEFAULT_ORGANIZATION_ID, useLiveApi } from "@/lib/api/config";
import {
  completePairing as completePairingMock,
  createLocation as createLocationMock,
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
} from "@/lib/mock-api/store";
import type {
  Location,
  Organization,
  PendingPairing,
  Screen,
  ScreenOrientation,
} from "@/lib/types/schema";

type Token = string;

export async function refreshTenantFromApi(token: Token) {
  const [organization, locations, screens] = await Promise.all([
    getMyOrganizationApi(token),
    listLocations(token),
    listScreens(token),
  ]);
  hydrateTenantData({
    organizations: [organization],
    locations,
    screens,
  });
  return { organization, locations, screens };
}

export async function updateOrganization(
  organizationId: string,
  patch: Partial<Pick<Organization, "name" | "slug">>,
  token?: Token | null,
): Promise<Organization> {
  if (useLiveApi() && token) {
    const org = await updateOrganizationApi(token, organizationId, patch);
    upsertOrganization(org);
    return org;
  }
  return updateOrganizationMock(organizationId, patch);
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
    const location = await createLocationApi(token, input);
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
    const location = await updateLocationApi(token, locationId, patch);
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
    await deleteLocationApi(token, locationId);
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
    const screen = await updateScreenApi(token, screenId, patch);
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
    await deleteScreenApi(token, screenId);
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
  },
  token?: Token | null,
): Promise<Screen> {
  if (useLiveApi() && token) {
    const screen = await completePairingApi(token, input);
    upsertScreen(screen);
    return screen;
  }
  return completePairingMock(input);
}
