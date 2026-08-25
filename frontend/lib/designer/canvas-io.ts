/**
 * Isolated Fabric.js save/load helpers for the menu designer.
 * Swap the persistence calls in the UI for real API endpoints later —
 * keep this module as the only place that talks to Fabric serialization.
 */

import type { Canvas, FabricObject } from "fabric";
import {
  LANDSCAPE_BOARD,
  PORTRAIT_BOARD,
} from "@/lib/display/orientation";
import type { MenuItem } from "@/lib/types/schema";

export type DesignerCanvasJson = Record<string, unknown>;

export const DESIGNER_WIDTH = LANDSCAPE_BOARD.width;
export const DESIGNER_HEIGHT = LANDSCAPE_BOARD.height;

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

/** Tall starter layout — authored in the portrait design-space board. */
export function createPortraitPromoJson(): DesignerCanvasJson {
  return {
    version: "6.0.0",
    background: "#18181b",
    objects: [
      {
        type: "textbox",
        left: 40,
        top: 80,
        width: 640,
        fill: "#fafafa",
        fontSize: 56,
        fontFamily: "Georgia, serif",
        fontWeight: "700",
        text: "Today's Special",
        editable: true,
      },
      {
        type: "textbox",
        left: 40,
        top: 200,
        width: 640,
        fill: "#a1a1aa",
        fontSize: 26,
        fontFamily: "system-ui, sans-serif",
        text: "Portrait-friendly promo layout",
        editable: true,
      },
    ],
    width: PORTRAIT_BOARD.width,
    height: PORTRAIT_BOARD.height,
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

export type DesignerPoint = { left: number; top: number };

export async function addHeading(
  canvas: Canvas,
  text = "Section",
  position?: DesignerPoint,
): Promise<void> {
  const { Textbox } = await import("fabric");
  const box = new Textbox(text, {
    left: position?.left ?? 80,
    top: position?.top ?? 160,
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

export async function addStyledText(
  canvas: Canvas,
  style: "heading" | "subheading" | "body",
  position?: DesignerPoint,
): Promise<void> {
  const presets = {
    heading: {
      text: "Add a heading",
      fontSize: 48,
      fontFamily: "Georgia, serif",
      fontWeight: "700",
      width: 640,
    },
    subheading: {
      text: "Add a subheading",
      fontSize: 28,
      fontFamily: "Georgia, serif",
      fontWeight: "600",
      width: 520,
    },
    body: {
      text: "Add a little bit of body text",
      fontSize: 18,
      fontFamily: "system-ui, sans-serif",
      fontWeight: "400",
      width: 480,
    },
  } as const;
  const preset = presets[style];
  const { Textbox } = await import("fabric");
  const box = new Textbox(preset.text, {
    left: position?.left ?? 80,
    top: position?.top ?? 160,
    width: preset.width,
    fill: "#fafafa",
    fontSize: preset.fontSize,
    fontFamily: preset.fontFamily,
    fontWeight: preset.fontWeight,
    editable: true,
  });
  canvas.add(box);
  canvas.setActiveObject(box);
  canvas.requestRenderAll();
}

export async function addShape(
  canvas: Canvas,
  shape: "rect" | "circle" | "line",
  fill = "#f5c518",
  position?: DesignerPoint,
): Promise<void> {
  const fabric = await import("fabric");
  const left = position?.left ?? 120;
  const top = position?.top ?? 160;
  let obj;
  if (shape === "circle") {
    obj = new fabric.Circle({
      left,
      top,
      radius: 64,
      fill,
    });
  } else if (shape === "line") {
    obj = new fabric.Rect({
      left,
      top,
      width: 280,
      height: 8,
      fill,
      rx: 4,
      ry: 4,
    });
  } else {
    obj = new fabric.Rect({
      left,
      top,
      width: 220,
      height: 140,
      fill,
      rx: 4,
      ry: 4,
    });
  }
  canvas.add(obj);
  canvas.setActiveObject(obj);
  canvas.requestRenderAll();
}

export async function addImageFromUrl(
  canvas: Canvas,
  url: string,
  position?: DesignerPoint,
): Promise<void> {
  const { FabricImage } = await import("fabric");
  const img = await FabricImage.fromURL(url, { crossOrigin: "anonymous" });
  img.scaleToWidth(360);
  img.set({
    left: position?.left ?? 80,
    top: position?.top ?? 80,
  });
  canvas.add(img);
  canvas.setActiveObject(img);
  canvas.requestRenderAll();
}

export async function addPriceBox(
  canvas: Canvas,
  position?: DesignerPoint,
): Promise<void> {
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
  const group = new Group([rect, label], {
    left: position?.left ?? 100,
    top: position?.top ?? 220,
  });
  canvas.add(group);
  canvas.setActiveObject(group);
  canvas.requestRenderAll();
}

export async function mergeCanvasJson(
  canvas: Canvas,
  json: DesignerCanvasJson,
): Promise<void> {
  const { util } = await import("fabric");
  const objects = Array.isArray(json.objects) ? json.objects : [];
  if (objects.length === 0) return;
  const enlivened = await util.enlivenObjects(objects);
  for (const obj of enlivened) {
    const current = obj as { left?: number; top?: number; set: (v: object) => void };
    current.set({
      left: (current.left ?? 0) + 24,
      top: (current.top ?? 0) + 24,
    });
    canvas.add(obj as never);
  }
  if (typeof json.background === "string") {
    canvas.backgroundColor = json.background;
  }
  canvas.requestRenderAll();
}

export async function duplicateActiveObject(canvas: Canvas): Promise<void> {
  const active = canvas.getActiveObject();
  if (!active) return;
  const cloned = await active.clone();
  cloned.set({
    left: (cloned.left ?? 0) + 24,
    top: (cloned.top ?? 0) + 24,
  });
  canvas.add(cloned);
  canvas.setActiveObject(cloned);
  canvas.requestRenderAll();
}

export function setActiveLocked(canvas: Canvas, locked: boolean): void {
  const active = canvas.getActiveObjects();
  active.forEach((obj) => {
    obj.set({
      lockMovementX: locked,
      lockMovementY: locked,
      lockScalingX: locked,
      lockScalingY: locked,
      lockRotation: locked,
      hasControls: !locked,
    });
  });
  canvas.requestRenderAll();
}

export function setActiveFill(canvas: Canvas, fill: string): void {
  const active = canvas.getActiveObjects();
  active.forEach((obj) => {
    obj.set({ fill });
  });
  canvas.requestRenderAll();
}

export function setActiveFontSize(canvas: Canvas, fontSize: number): void {
  const active = canvas.getActiveObjects();
  active.forEach((obj) => {
    if ("fontSize" in obj) {
      obj.set({ fontSize });
    }
  });
  canvas.requestRenderAll();
}

export function setActiveOpacity(canvas: Canvas, opacity: number): void {
  canvas.getActiveObjects().forEach((obj) => {
    obj.set({ opacity });
  });
  canvas.requestRenderAll();
}

export function setCanvasBackground(canvas: Canvas, color: string): void {
  canvas.backgroundColor = color;
  canvas.requestRenderAll();
}

export function moveActiveLayer(canvas: Canvas, direction: "up" | "down"): void {
  const active = canvas.getActiveObject();
  if (!active) return;
  if (direction === "up") {
    canvas.bringObjectForward(active);
  } else {
    canvas.sendObjectBackwards(active);
  }
  canvas.requestRenderAll();
}

export type DesignerAlignment =
  | "left"
  | "center-h"
  | "right"
  | "top"
  | "center-v"
  | "bottom";

/** Align the selection against the board edges/centre. */
export function alignActiveObject(
  canvas: Canvas,
  alignment: DesignerAlignment,
): void {
  const active = canvas.getActiveObject();
  if (!active) return;
  const boardWidth = canvas.getWidth();
  const boardHeight = canvas.getHeight();
  const bounds = active.getBoundingRect();

  switch (alignment) {
    case "left":
      active.set({ left: (active.left ?? 0) - bounds.left });
      break;
    case "center-h":
      active.set({
        left: (active.left ?? 0) + (boardWidth - bounds.width) / 2 - bounds.left,
      });
      break;
    case "right":
      active.set({
        left: (active.left ?? 0) + boardWidth - bounds.width - bounds.left,
      });
      break;
    case "top":
      active.set({ top: (active.top ?? 0) - bounds.top });
      break;
    case "center-v":
      active.set({
        top: (active.top ?? 0) + (boardHeight - bounds.height) / 2 - bounds.top,
      });
      break;
    case "bottom":
      active.set({
        top: (active.top ?? 0) + boardHeight - bounds.height - bounds.top,
      });
      break;
  }
  active.setCoords();
  canvas.requestRenderAll();
}

export function deleteActiveObject(canvas: Canvas) {
  const active = canvas.getActiveObjects();
  if (active.length === 0) return;
  active.forEach((obj) => canvas.remove(obj));
  canvas.discardActiveObject();
  canvas.requestRenderAll();
}
