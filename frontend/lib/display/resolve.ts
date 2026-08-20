import { getScreenContentApi } from "@/lib/api/display";
import { getScreenPublicApi } from "@/lib/api/tenant";
import { ApiError } from "@/lib/api/client";
import { useLiveApi } from "@/lib/api/config";
import { readDeviceToken } from "@/lib/display/device-token";
import type { DisplayPayload } from "@/lib/display/types";
import { getMockStoreSnapshot } from "@/lib/mock-api/store";

function resolveDeviceToken(screenId: string): string | null {
  const stored = readDeviceToken(screenId);
  if (stored) return stored;
  const screen = getMockStoreSnapshot().screens.find((s) => s.id === screenId);
  return screen?.deviceToken ?? null;
}

/** Build a display payload from the in-memory mock store. */
export function resolveDisplayPayloadMock(
  screenId: string,
): DisplayPayload | null {
  const { screens, menus, menuItems, templates } = getMockStoreSnapshot();
  const screen = screens.find((s) => s.id === screenId);
  if (!screen) return null;

  if (screen.status === "pairing" || screen.locationId === null) {
    return null;
  }

  const menu = screen.activeMenuId
    ? menus.find((m) => m.id === screen.activeMenuId)
    : null;
  const template = screen.activeTemplateId
    ? templates.find((t) => t.id === screen.activeTemplateId)
    : null;

  const items = menu
    ? menuItems
        .filter((i) => i.menuId === menu.id)
        .sort((a, b) => a.sortOrder - b.sortOrder)
    : [];

  return {
    screenId: screen.id,
    screenName: screen.name,
    organizationId: screen.organizationId,
    orientation: screen.orientation,
    resolution: screen.resolution,
    menuId: menu?.id ?? null,
    menuName: menu?.name ?? null,
    menuVersion: menu?.version ?? null,
    templateId: template?.id ?? null,
    templateName: template?.name ?? null,
    canvasJson: template
      ? (structuredClone(template.canvasJson) as DisplayPayload["canvasJson"])
      : null,
    displayConfig: template?.displayConfig ?? null,
    items,
    updatedAt: new Date().toISOString(),
  };
}

export type ResolveResult =
  | { kind: "payload"; payload: DisplayPayload }
  | { kind: "pairing" }
  | { kind: "missing" }
  | { kind: "empty" };

/** Live API or mock resolve for the kiosk player. */
export async function resolveDisplayPayload(
  screenId: string,
): Promise<ResolveResult> {
  if (!useLiveApi()) {
    if (isScreenPairingMock(screenId)) return { kind: "pairing" };
    const payload = resolveDisplayPayloadMock(screenId);
    if (payload) return { kind: "payload", payload };
    if (!screenExistsMock(screenId)) return { kind: "missing" };
    return { kind: "empty" };
  }

  const deviceToken = resolveDeviceToken(screenId);
  if (!deviceToken) return { kind: "missing" };

  try {
    const payload = await getScreenContentApi(screenId, deviceToken);
    return { kind: "payload", payload };
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      return { kind: "pairing" };
    }
    if (err instanceof ApiError && err.status === 404) {
      return { kind: "missing" };
    }
    // Network / 5xx — try public meta, else let caller use cache
    try {
      const screen = await getScreenPublicApi(screenId, deviceToken);
      if (screen.status === "pairing" || screen.locationId === null) {
        return { kind: "pairing" };
      }
      return { kind: "empty" };
    } catch {
      throw err;
    }
  }
}

function isScreenPairingMock(screenId: string): boolean {
  const screen = getMockStoreSnapshot().screens.find((s) => s.id === screenId);
  if (!screen) return false;
  return screen.status === "pairing" || screen.locationId === null;
}

function screenExistsMock(screenId: string): boolean {
  return getMockStoreSnapshot().screens.some((s) => s.id === screenId);
}

/** @deprecated use resolveDisplayPayload — kept for sync mock callers */
export function isScreenPairing(screenId: string): boolean {
  return isScreenPairingMock(screenId);
}

export function screenExists(screenId: string): boolean {
  return screenExistsMock(screenId);
}

export function getScreenDeviceToken(screenId: string): string | null {
  return resolveDeviceToken(screenId);
}
