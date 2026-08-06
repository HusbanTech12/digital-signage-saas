import { apiFetch } from "@/lib/api/client";
import type { Theme, ThemeRuleKind } from "@/lib/types/schema";

export type AuthToken = string;

export function listThemesApi(token: AuthToken) {
  return apiFetch<Theme[]>("/api/v1/themes", { token });
}

export function createThemeApi(
  token: AuthToken,
  input: {
    organizationId: string;
    name: string;
    kind: ThemeRuleKind;
    startTime: string | null;
    endTime: string | null;
    startDate: string | null;
    endDate: string | null;
    menuId: string;
    templateId: string;
    locationIds: string[];
    enabled: boolean;
  },
) {
  return apiFetch<Theme>("/api/v1/themes", {
    method: "POST",
    token,
    body: input,
  });
}

export function updateThemeApi(
  token: AuthToken,
  themeId: string,
  patch: Partial<{
    name: string;
    kind: ThemeRuleKind;
    startTime: string | null;
    endTime: string | null;
    startDate: string | null;
    endDate: string | null;
    menuId: string;
    templateId: string;
    locationIds: string[];
    enabled: boolean;
  }>,
) {
  return apiFetch<Theme>(`/api/v1/themes/${themeId}`, {
    method: "PATCH",
    token,
    body: patch,
  });
}

export function deleteThemeApi(token: AuthToken, themeId: string) {
  return apiFetch<void>(`/api/v1/themes/${themeId}`, {
    method: "DELETE",
    token,
  });
}

export function applyThemesNowApi(token: AuthToken) {
  return apiFetch<{
    ok: boolean;
    events: number;
    publishedViaRedis: boolean;
    offline_marked?: number;
    theme_events?: number;
  }>("/api/v1/themes/apply-now", {
    method: "POST",
    token,
  });
}
