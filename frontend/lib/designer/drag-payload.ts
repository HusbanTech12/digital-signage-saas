/**
 * Drag-and-drop contract between the designer library panels and the canvas.
 * Payloads stay serializable so they survive the HTML5 dataTransfer round trip.
 */

export const DESIGNER_DND_MIME = "application/x-signage-element";

export type DesignerDragPayload =
  | { kind: "text"; style: "heading" | "subheading" | "body" }
  | { kind: "shape"; shape: "rect" | "circle" | "line"; fill: string }
  | { kind: "priceBox" }
  | { kind: "menuItem"; itemId: string }
  | { kind: "image"; url: string }
  | { kind: "template"; templateId: string };

export function setDragPayload(
  event: React.DragEvent,
  payload: DesignerDragPayload,
): void {
  event.dataTransfer.setData(DESIGNER_DND_MIME, JSON.stringify(payload));
  event.dataTransfer.effectAllowed = "copy";
}

export function readDragPayload(
  event: React.DragEvent,
): DesignerDragPayload | null {
  const raw = event.dataTransfer.getData(DESIGNER_DND_MIME);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DesignerDragPayload;
  } catch {
    return null;
  }
}
