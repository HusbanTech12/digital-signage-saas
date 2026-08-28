import { apiFetch } from "@/lib/api/client";
import type {
  PosIntegration,
  PosProvider,
  PosSyncEvent,
  PosSyncStatus,
} from "@/lib/types/schema";

export type AuthToken = string;

export function listPosIntegrationsApi(token: AuthToken) {
  return apiFetch<PosIntegration[]>("/api/v1/pos/integrations", { token });
}

export function createPosIntegrationApi(
  token: AuthToken,
  input: {
    organizationId: string;
    locationId: string;
    provider: PosProvider;
    credentials?: Record<string, unknown>;
    config?: Record<string, unknown>;
    status?: "inactive" | "active";
  },
) {
  return apiFetch<PosIntegration>("/api/v1/pos/integrations", {
    method: "POST",
    token,
    body: input,
  });
}

export function updatePosIntegrationApi(
  token: AuthToken,
  integrationId: string,
  patch: Partial<{
    credentials: Record<string, unknown>;
    config: Record<string, unknown>;
    status: "inactive" | "active" | "error";
  }>,
) {
  return apiFetch<PosIntegration>(`/api/v1/pos/integrations/${integrationId}`, {
    method: "PATCH",
    token,
    body: patch,
  });
}

export function deletePosIntegrationApi(
  token: AuthToken,
  integrationId: string,
) {
  return apiFetch<void>(`/api/v1/pos/integrations/${integrationId}`, {
    method: "DELETE",
    token,
  });
}

export function listPosEventsApi(
  token: AuthToken,
  integrationId: string,
  limit = 50,
) {
  return apiFetch<PosSyncEvent[]>(
    `/api/v1/pos/integrations/${integrationId}/events`,
    { token, query: { limit: String(limit) } },
  );
}

export function getPosSyncStatusApi(token: AuthToken) {
  return apiFetch<PosSyncStatus>("/api/v1/pos/sync-status", { token });
}

export function startPosOAuthApi(token: AuthToken, integrationId: string) {
  return apiFetch<{ authorizeUrl: string; provider: string }>(
    `/api/v1/pos/integrations/${integrationId}/oauth/start`,
    { token },
  );
}

export function listPosCatalogApi(token: AuthToken, integrationId: string) {
  return apiFetch<{
    items: Array<{
      externalSku: string;
      name: string;
      price: number | null;
      available: boolean | null;
      externalId: string | null;
    }>;
    oauthConnected: boolean;
  }>(`/api/v1/pos/integrations/${integrationId}/catalog`, { token });
}

export function getCloverVerificationCodeApi(token: AuthToken) {
  return apiFetch<{ verificationCode: string | null }>(
    "/api/v1/pos/clover/verification-code",
    { token },
  );
}

export function simulatePosUpdatesApi(
  token: AuthToken,
  integrationId: string,
  updates: Array<Record<string, unknown>>,
) {
  return apiFetch<{
    accepted: boolean;
    eventId: string;
    queued: boolean;
    inline: boolean;
  }>(`/api/v1/pos/integrations/${integrationId}/simulate`, {
    method: "POST",
    token,
    body: { updates },
  });
}
