/**
 * Isolated Fabric.js save/load helpers for the menu designer.
 * Swap the persistence calls in the UI for real API endpoints later —
 * keep this module as the only place that talks to Fabric serialization.
 */

import type { Canvas, FabricObject } from "fabric";
import type { MenuItem } from "@/lib/types/schema";

export type DesignerCanvasJson = Record<string, unknown>;

export const DESIGNER_WIDTH = 1280;
export const DESIGNER_HEIGHT = 720;

/** Empty board with a dark background — used for new templates. */
export function createBlankCanvasJson(
  width = DESIGNER_WIDTH,
  height = DESIGNER_HEIGHT,
): DesignerCanvasJson {
  return {
    version: "6.0.0",
    background: "#1a1a1a",
    objects: [
      {
        type: "textbox",
        version: "6.0.0",
        left: 48,
        top: 40,
        width: 600,
        fill: "#f5f5f5",
        fontSize: 42,
        fontFamily: "Georgia, serif",
        fontWeight: "600",
        text: "Menu Board",
        editable: true,
      },
      {
        type: "textbox",
        version: "6.0.0",
        left: 48,
        top: 100,
        width: 480,
        fill: "#a3a3a3",
        fontSize: 18,
        fontFamily: "system-ui, sans-serif",
        text: "Drag items from the panel or add text/shapes.",
        editable: true,
      },
    ],
    width,
    height,
  };
}

/** Classic two-column starter layout. */
export function createClassicBoardJson(): DesignerCanvasJson {
  return {
    version: "6.0.0",
    background: "#111827",
    objects: [
      {
        type: "rect",
        left: 0,
        top: 0,
        width: DESIGNER_WIDTH,
        height: 96,
        fill: "#0f172a",
        selectable: true,
      },
      {
        type: "textbox",
        left: 48,
        top: 28,
        width: 700,
        fill: "#f8fafc",
        fontSize: 40,
        fontFamily: "Georgia, serif",
        fontWeight: "600",
        text: "Harbor & Hearth",
        editable: true,
      },
      {
        type: "textbox",
        left: 48,
        top: 140,
        width: 520,
        fill: "#e2e8f0",
        fontSize: 22,
        fontFamily: "Georgia, serif",
        fontWeight: "600",
        text: "Drinks",
        editable: true,
      },
      {
        type: "textbox",
        left: 680,
        top: 140,
        width: 520,
        fill: "#e2e8f0",
        fontSize: 22,
        fontFamily: "Georgia, serif",
        fontWeight: "600",
        text: "Mains",
        editable: true,
      },
    ],
    width: DESIGNER_WIDTH,
    height: DESIGNER_HEIGHT,
  };
}

export function createPortraitPromoJson(): DesignerCanvasJson {
  return {
    version: "6.0.0",
    background: "#18181b",
    objects: [
      {
        type: "textbox",
        left: 40,
        top: 60,
        width: 1000,
        fill: "#fafafa",
        fontSize: 48,
        fontFamily: "Georgia, serif",
        fontWeight: "700",
        text: "Today's Special",
        editable: true,
      },
      {
        type: "textbox",
        left: 40,
        top: 160,
        width: 1000,
        fill: "#a1a1aa",
        fontSize: 24,
        fontFamily: "system-ui, sans-serif",
        text: "Portrait-friendly promo layout",
        editable: true,
      },
    ],
    width: DESIGNER_WIDTH,
    height: DESIGNER_HEIGHT,
  };
}

/** Serialize canvas state for persistence (mock store / future API). */
export function saveCanvasToJson(canvas: Canvas): DesignerCanvasJson {
  const json = canvas.toJSON() as DesignerCanvasJson;
  return {
    ...json,
    width: canvas.getWidth(),
    height: canvas.getHeight(),
  };
}

/** Hydrate a Fabric canvas from stored JSON. */
export async function loadCanvasFromJson(
  canvas: Canvas,
  json: DesignerCanvasJson | null | undefined,
): Promise<void> {
  const payload =
    json && Array.isArray(json.objects) && json.objects.length > 0
      ? json
      : createBlankCanvasJson();

  const width =
    typeof payload.width === "number" ? payload.width : DESIGNER_WIDTH;
  const height =
    typeof payload.height === "number" ? payload.height : DESIGNER_HEIGHT;
  canvas.setDimensions({ width, height });

  await canvas.loadFromJSON(payload);
  if (typeof payload.background === "string") {
    canvas.backgroundColor = payload.background;
  }
  canvas.requestRenderAll();
}

/** Drop a menu item as a labeled price row onto the canvas. */
export async function addMenuItemObject(
  canvas: Canvas,
  item: MenuItem,
  position?: { left: number; top: number },
): Promise<FabricObject> {
  const { Textbox } = await import("fabric");
  const left = position?.left ?? 80;
  const top = position?.top ?? 200 + Math.random() * 40;
  const price = item.price.toFixed(2);
  const label = item.available
    ? `${item.name}  ·  $${price}`
    : `${item.name}  ·  Sold out`;

  const textbox = new Textbox(label, {
    left,
    top,
    width: 420,
    fill: item.available ? "#f4f4f5" : "#71717a",
    fontSize: 22,
    fontFamily: "system-ui, sans-serif",
    editable: true,
  });
  // Custom metadata for future sync with menu_items
  (textbox as FabricObject & { menuItemId?: string }).menuItemId = item.id;
  canvas.add(textbox);
  canvas.setActiveObject(textbox);
  canvas.requestRenderAll();
  return textbox;
}

export async function addHeading(
  canvas: Canvas,
  text = "Section",
): Promise<void> {
  const { Textbox } = await import("fabric");
  const box = new Textbox(text, {
    left: 80,
    top: 160,
    width: 400,
    fill: "#fafafa",
    fontSize: 28,
    fontFamily: "Georgia, serif",
    fontWeight: "600",
    editable: true,
  });
  canvas.add(box);
  canvas.setActiveObject(box);
  canvas.requestRenderAll();
}

export async function addPriceBox(canvas: Canvas): Promise<void> {
  const { Rect, Textbox, Group } = await import("fabric");
  const rect = new Rect({
    width: 280,
    height: 72,
    fill: "#27272a",
    rx: 8,
    ry: 8,
  });
  const label = new Textbox("Item name — $0.00", {
    left: 16,
    top: 22,
    width: 248,
    fill: "#fafafa",
    fontSize: 18,
    fontFamily: "system-ui, sans-serif",
  });
  const group = new Group([rect, label], { left: 100, top: 220 });
  canvas.add(group);
  canvas.setActiveObject(group);
  canvas.requestRenderAll();
}

export function deleteActiveObject(canvas: Canvas) {
  const active = canvas.getActiveObjects();
  if (active.length === 0) return;
  active.forEach((obj) => canvas.remove(obj));
  canvas.discardActiveObject();
  canvas.requestRenderAll();
}
