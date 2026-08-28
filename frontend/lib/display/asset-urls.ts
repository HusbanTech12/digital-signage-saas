/**
 * Pure helpers for offline cache URL extraction (no IndexedDB).
 * Kept separate so Node unit tests can import without browser APIs.
 */

import type { DisplayPayload } from "@/lib/display/types";

/** Normalize candidate URL strings without requiring Absolute resolution. */
export function collectRawAssetUrls(payload: DisplayPayload): string[] {
  const urls = new Set<string>();

  const add = (raw: string | null | undefined) => {
    if (!raw || typeof raw !== "string") return;
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith("blob:") || trimmed.startsWith("data:")) {
      return;
    }
    urls.add(trimmed);
  };

  const walkCanvas = (canvas: unknown) => {
    if (!canvas || typeof canvas !== "object") return;
    const objects = (canvas as { objects?: unknown[] }).objects;
    if (!Array.isArray(objects)) return;
    for (const obj of objects) {
      if (!obj || typeof obj !== "object") continue;
      const o = obj as Record<string, unknown>;
      if (typeof o.src === "string") add(o.src);
      if (typeof o.fill === "string" && /^https?:\/\//i.test(o.fill)) add(o.fill);
    }
  };

  for (const item of payload.items ?? []) {
    add(item.imageUrl);
  }
  walkCanvas(payload.canvasJson);
  add(payload.displayConfig?.qr?.imageUrl);

  for (const slide of payload.playlist?.slides ?? []) {
    add(slide.mediaUrl);
    for (const item of slide.items ?? []) {
      add(item.imageUrl);
    }
    walkCanvas(slide.canvasJson);
    add(slide.displayConfig?.qr?.imageUrl);
  }

  for (const track of payload.audio?.tracks ?? []) {
    add(track.url);
  }

  return [...urls];
}
