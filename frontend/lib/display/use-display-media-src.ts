"use client";

import { useEffect, useState } from "react";
import { resolveDisplayMediaUrl } from "@/lib/display/media-resolve";

/** Loads a media src preferring IndexedDB blob cache (offline-safe). */
export function useDisplayMediaSrc(url: string | null | undefined): string | null {
  const [src, setSrc] = useState<string | null>(url ?? null);

  useEffect(() => {
    if (!url) {
      setSrc(null);
      return;
    }
    let cancelled = false;
    setSrc(url);
    void resolveDisplayMediaUrl(url).then((resolved) => {
      if (!cancelled) setSrc(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return src;
}
