/**
 * Kiosk media URL resolver — prefers IndexedDB blob when offline.
 */

import { resolveMediaUrl } from "@/lib/api/media";
import { getCachedAssetObjectUrl } from "@/lib/display/cache";

/**
 * Resolve a display media URL for <img>/<video>.
 * Online: network URL (prefetch fills cache in background).
 * Offline: blob: from IndexedDB when available, else network URL as last resort.
 */
export async function resolveDisplayMediaUrl(url: string): Promise<string> {
  if (!url) return url;
  if (url.startsWith("blob:") || url.startsWith("data:")) return url;

  const absolute = resolveMediaUrl(url);
  const online =
    typeof navigator === "undefined" ? true : navigator.onLine;

  if (!online) {
    const cached = await getCachedAssetObjectUrl(absolute);
    if (cached) return cached;
  }

  // Prefer cache even when online to reduce CDN hits on looped playlists
  const cached = await getCachedAssetObjectUrl(absolute);
  if (cached) return cached;

  return absolute;
}
