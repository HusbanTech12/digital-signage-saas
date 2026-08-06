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
