import {
  applyThemesNowApi,
  createThemeApi,
  deleteThemeApi,
  listThemesApi,
  updateThemeApi,
} from "@/lib/api/themes";
import { useLiveApi } from "@/lib/api/config";
import {
  createTheme as createThemeMock,
  deleteTheme as deleteThemeMock,
  hydrateTenantData,
  removeThemeLocal,
  updateTheme as updateThemeMock,
  upsertTheme,
} from "@/lib/mock-api/store";
import type { Theme, ThemeRuleKind } from "@/lib/types/schema";

type Token = string;

export type ThemeInput = {
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
};

export async function refreshThemesFromApi(token: Token) {
  const themes = await listThemesApi(token);
  hydrateTenantData({ themes });
  return themes;
}

export async function createTheme(input: ThemeInput, token?: Token | null) {
  if (useLiveApi() && token) {
    const theme = await createThemeApi(token, input);
    upsertTheme(theme);
    return theme;
  }
  return createThemeMock(input);
}

export async function updateTheme(
  themeId: string,
  patch: Partial<ThemeInput>,
  token?: Token | null,
) {
  if (useLiveApi() && token) {
    const theme = await updateThemeApi(token, themeId, patch);
    upsertTheme(theme);
    return theme;
  }
  return updateThemeMock(themeId, patch);
}

export async function deleteTheme(themeId: string, token?: Token | null) {
  if (useLiveApi() && token) {
    await deleteThemeApi(token, themeId);
    removeThemeLocal(themeId);
    return;
  }
  deleteThemeMock(themeId);
}

export async function applyThemesNow(token?: Token | null) {
  if (useLiveApi() && token) {
    return applyThemesNowApi(token);
  }
  return { ok: true, events: 0, publishedViaRedis: false };
}
