import type { DesignerCanvasJson } from "@/lib/designer/canvas-io";
import type { MenuDisplayConfig } from "@/lib/display/menu-board-theme";
import type { MenuItem, ScreenOrientation } from "@/lib/types/schema";

/** Snapshot pushed to the kiosk (and cached in IndexedDB). */
export interface DisplayPayload {
  screenId: string;
  screenName: string;
  organizationId: string;
  orientation: ScreenOrientation;
  resolution: string;
  menuId: string | null;
  menuName: string | null;
  menuVersion: number | null;
  templateId: string | null;
  templateName: string | null;
  canvasJson: DesignerCanvasJson | null;
  displayConfig: Partial<MenuDisplayConfig> | null;
  items: MenuItem[];
  updatedAt: string;
}

export type DisplaySource = "live" | "cache" | "none";
