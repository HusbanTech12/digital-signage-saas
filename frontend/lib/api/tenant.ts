import { apiFetch } from "@/lib/api/client";
import type {
  Location,
  Organization,
  PendingPairing,
  Screen,
  ScreenOrientation,
  User,
} from "@/lib/types/schema";

export type AuthToken = string;

export function listLocations(token: AuthToken) {
  return apiFetch<Location[]>("/api/v1/locations", { token });
}

export function createLocationApi(
  token: AuthToken,
  input: {
    organizationId: string;
    name: string;
    address: string;
    timezone: string;
  },
) {
  return apiFetch<Location>("/api/v1/locations", {
    method: "POST",
    token,
    body: input,
  });
}

export function updateLocationApi(
  token: AuthToken,
  locationId: string,
  patch: Partial<Pick<Location, "name" | "address" | "timezone">>,
) {
  return apiFetch<Location>(`/api/v1/locations/${locationId}`, {
    method: "PATCH",
    token,
    body: patch,
  });
}

export function deleteLocationApi(token: AuthToken, locationId: string) {
  return apiFetch<void>(`/api/v1/locations/${locationId}`, {
    method: "DELETE",
    token,
  });
}

export function getOrganizationApi(token: AuthToken, organizationId: string) {
  return apiFetch<Organization>(`/api/v1/organizations/${organizationId}`, {
    token,
  });
}

export function getMyOrganizationApi(token: AuthToken) {
  return apiFetch<Organization>("/api/v1/organizations/me", { token });
}

export function listOrganizationsApi(token: AuthToken) {
  return apiFetch<Organization[]>("/api/v1/organizations", { token });
}

export function createOrganizationApi(
  token: AuthToken,
  input: { name: string; slug: string },
) {
  return apiFetch<Organization>("/api/v1/organizations", {
    method: "POST",
    token,
    body: input,
  });
}

export function updateOrganizationApi(
  token: AuthToken,
  organizationId: string,
  patch: Partial<Pick<Organization, "name" | "slug">>,
) {
  return apiFetch<Organization>(`/api/v1/organizations/${organizationId}`, {
    method: "PATCH",
    token,
    body: patch,
  });
}

export function listScreens(token: AuthToken) {
  return apiFetch<Screen[]>("/api/v1/screens", { token });
}

export function updateScreenApi(
  token: AuthToken,
  screenId: string,
  patch: Partial<
    Pick<Screen, "name" | "locationId" | "orientation" | "resolution">
  >,
) {
  return apiFetch<Screen>(`/api/v1/screens/${screenId}`, {
    method: "PATCH",
    token,
    body: patch,
  });
}

export function deleteScreenApi(token: AuthToken, screenId: string) {
  return apiFetch<void>(`/api/v1/screens/${screenId}`, {
    method: "DELETE",
    token,
  });
}

export function getScreenPublicApi(screenId: string, deviceToken: string) {
  return apiFetch<Screen>(`/api/v1/screens/${screenId}/public`, {
    auth: false,
    query: { device_token: deviceToken },
  });
}

export function touchScreenHeartbeatApi(
  screenId: string,
  deviceToken: string,
  body?: {
    lastSyncAt?: string | null;
    lastSyncError?: string | null;
    contentVersion?: number | null;
    contentUpdatedAt?: string | null;
    currentContentSummary?: string | null;
    clientAppVersion?: string | null;
    ackedCommandId?: string | null;
  },
) {
  return apiFetch<Screen>(`/api/v1/screens/${screenId}/heartbeat`, {
    method: "POST",
    auth: false,
    body: {
      deviceToken,
      lastSyncAt: body?.lastSyncAt ?? undefined,
      lastSyncError: body?.lastSyncError ?? undefined,
      contentVersion: body?.contentVersion ?? undefined,
      contentUpdatedAt: body?.contentUpdatedAt ?? undefined,
      currentContentSummary: body?.currentContentSummary ?? undefined,
      clientAppVersion: body?.clientAppVersion ?? undefined,
      ackedCommandId: body?.ackedCommandId ?? undefined,
    },
  });
}

export function requestScreenRefreshApi(token: AuthToken, screenId: string) {
  return apiFetch<{
    screenId: string;
    command: string;
    commandId: string;
    createdAt: string;
  }>(`/api/v1/screens/${screenId}/commands/refresh`, {
    method: "POST",
    token,
  });
}

export function clearScreenErrorApi(token: AuthToken, screenId: string) {
  return apiFetch<Screen>(`/api/v1/screens/${screenId}/commands/clear-error`, {
    method: "POST",
    token,
  });
}

export function startPairingSessionApi(input: {
  organizationId: string;
  resolution?: string;
  orientation?: ScreenOrientation;
}) {
  return apiFetch<{ screen: Screen; pairing: PendingPairing }>(
    "/api/v1/pairing/sessions",
    {
      method: "POST",
      auth: false,
      body: input,
    },
  );
}

export function completePairingApi(
  token: AuthToken,
  input: {
    code: string;
    locationId: string;
    name: string;
    organizationId: string;
    resolution?: string;
    orientation?: ScreenOrientation;
  },
) {
  return apiFetch<Screen>("/api/v1/pairing/complete", {
    method: "POST",
    token,
    body: input,
  });
}

export function getMeBootstrapApi(token: AuthToken) {
  return apiFetch<{ user: User; organization: Organization }>(
    "/api/v1/me/bootstrap",
    { token },
  );
}

export function onboardMeApi(token: AuthToken) {
  return apiFetch<{ user: User; organization: Organization; created: boolean }>(
    "/api/v1/me/onboard",
    { method: "POST", token },
  );
}
