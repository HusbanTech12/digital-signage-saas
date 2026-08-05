import type { DisplayPayload } from "@/lib/display/types";
import { getMockStoreSnapshot } from "@/lib/mock-api/store";

/** Build a display payload from the in-memory mock store (stand-in for GET /screens/:id/content). */
export function resolveDisplayPayload(screenId: string): DisplayPayload | null {
  const { screens, menus, menuItems, templates } = getMockStoreSnapshot();
  const screen = screens.find((s) => s.id === screenId);
  if (!screen) return null;

  // Unpaired / still pairing — not ready for content playback
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
        .filter((i) => i.menuId === menu.id && i.available)
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
    items,
    updatedAt: new Date().toISOString(),
  };
}

export function isScreenPairing(screenId: string): boolean {
  const screen = getMockStoreSnapshot().screens.find((s) => s.id === screenId);
  if (!screen) return false;
  return screen.status === "pairing" || screen.locationId === null;
}

export function screenExists(screenId: string): boolean {
  return getMockStoreSnapshot().screens.some((s) => s.id === screenId);
}
