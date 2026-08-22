/** Domain types for playlist playback on the kiosk. */

import type { DesignerCanvasJson } from "@/lib/designer/canvas-io";
import type { MenuDisplayConfig } from "@/lib/display/menu-board-theme";
import type { MenuItem, ScreenOrientation } from "@/lib/types/schema";

export interface PlaylistSlide {
  id: string;
  sortOrder: number;
  contentType: "menu" | "template" | "image" | "video" | string;
  durationSeconds: number;
  label: string | null;
  transition: string | null;
  menuId: string | null;
  menuName: string | null;
  menuVersion: number | null;
  items: MenuItem[];
  templateId: string | null;
  templateName: string | null;
  canvasJson: DesignerCanvasJson | Record<string, unknown> | null;
  displayConfig: Partial<MenuDisplayConfig> | null;
  mediaUrl: string | null;
  mediaMimeType: string | null;
  mediaKind: string | null;
  mediaName: string | null;
}

export interface PlaylistPlayback {
  id: string;
  name: string;
  version: number;
  loop: boolean;
  priority: number;
  slides: PlaylistSlide[];
}

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
  playlist?: PlaylistPlayback | null;
  wall?: WallInfo | null;
}

export interface WallInfo {
  groupId: string;
  groupName: string;
  layout: string;
  rows: number;
  cols: number;
  row: number;
  col: number;
  contentMode: "shared" | "tiled" | string;
  syncEpochMs: number | null;
  bezelCompensationPct?: number;
}

export type DisplaySource = "live" | "cache" | "none";
