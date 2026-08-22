/**
 * IndexedDB cache for last-known display state + media blobs.
 * Keeps kiosk screens from going blank when connectivity drops.
 */

import { resolveMediaUrl } from "@/lib/api/media";
import { collectRawAssetUrls } from "@/lib/display/asset-urls";
import type { DisplayPayload } from "@/lib/display/types";

const DB_NAME = "signage-display-cache";
const STORE_PAYLOADS = "payloads";
const STORE_ASSETS = "assets";
const STORE_META = "meta";
const DB_VERSION = 2;

/** Soft budget for cached media on low-end kiosk hardware (~64MB). */
const MAX_CACHE_BYTES = 64 * 1024 * 1024;
const PREFETCH_CONCURRENCY = 2;
/** Skip individual files larger than this (e.g. huge videos). */
const MAX_ASSET_BYTES = 40 * 1024 * 1024;

export type CachedAsset = {
  url: string;
  blob: Blob;
  mimeType: string;
  sizeBytes: number;
  cachedAt: string;
  lastAccessedAt: string;
};

export type DisplayCacheMeta = {
  screenId: string;
  payloadUpdatedAt: string;
  assetUrls: string[];
  lastSyncAt: string | null;
  lastSyncError: string | null;
  totalAssetBytes: number;
};

const objectUrlByResolved = new Map<string, string>();

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_PAYLOADS)) {
        db.createObjectStore(STORE_PAYLOADS, { keyPath: "screenId" });
      }
      if (!db.objectStoreNames.contains(STORE_ASSETS)) {
        db.createObjectStore(STORE_ASSETS, { keyPath: "url" });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: "screenId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
  });
}

function idbGet<T>(
  db: IDBDatabase,
  store: string,
  key: string,
): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(db: IDBDatabase, store: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function idbDelete(db: IDBDatabase, store: string, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function idbGetAll<T>(db: IDBDatabase, store: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve((req.result as T[]) ?? []);
    req.onerror = () => reject(req.error);
  });
}

export async function readDisplayCache(
  screenId: string,
): Promise<DisplayPayload | null> {
  try {
    const db = await openDb();
    return (await idbGet<DisplayPayload>(db, STORE_PAYLOADS, screenId)) ?? null;
  } catch {
    return null;
  }
}

export async function writeDisplayCache(payload: DisplayPayload): Promise<void> {
  try {
    const db = await openDb();
    await idbPut(db, STORE_PAYLOADS, payload);
  } catch {
    // Cache write failures must never blank the screen.
  }
}

export async function readDisplayCacheMeta(
  screenId: string,
): Promise<DisplayCacheMeta | null> {
  try {
    const db = await openDb();
    return (await idbGet<DisplayCacheMeta>(db, STORE_META, screenId)) ?? null;
  } catch {
    return null;
  }
}

export async function writeDisplayCacheMeta(
  meta: DisplayCacheMeta,
): Promise<void> {
  try {
    const db = await openDb();
    await idbPut(db, STORE_META, meta);
  } catch {
    /* ignore */
  }
}

/** Collect absolute media URLs referenced by a display payload. */
export function extractDisplayAssetUrls(payload: DisplayPayload): string[] {
  const urls = new Set<string>();
  for (const raw of collectRawAssetUrls(payload)) {
    try {
      urls.add(resolveMediaUrl(raw));
    } catch {
      urls.add(raw);
    }
  }
  return [...urls];
}

async function putAsset(asset: CachedAsset): Promise<boolean> {
  try {
    const db = await openDb();
    await idbPut(db, STORE_ASSETS, asset);
    return true;
  } catch (err) {
    if (err instanceof DOMException && err.name === "QuotaExceededError") {
      await pruneOldestAssets(1);
      try {
        const db = await openDb();
        await idbPut(db, STORE_ASSETS, asset);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}

async function pruneOldestAssets(count: number): Promise<void> {
  try {
    const db = await openDb();
    const all = await idbGetAll<CachedAsset>(db, STORE_ASSETS);
    all.sort(
      (a, b) =>
        new Date(a.lastAccessedAt).getTime() -
        new Date(b.lastAccessedAt).getTime(),
    );
    for (const asset of all.slice(0, count)) {
      await idbDelete(db, STORE_ASSETS, asset.url);
      const existing = objectUrlByResolved.get(asset.url);
      if (existing) {
        URL.revokeObjectURL(existing);
        objectUrlByResolved.delete(asset.url);
      }
    }
  } catch {
    /* ignore */
  }
}

export async function pruneDisplayAssets(keepUrls: string[]): Promise<void> {
  try {
    const keep = new Set(keepUrls);
    const db = await openDb();
    const all = await idbGetAll<CachedAsset>(db, STORE_ASSETS);
    for (const asset of all) {
      if (!keep.has(asset.url)) {
        await idbDelete(db, STORE_ASSETS, asset.url);
        const existing = objectUrlByResolved.get(asset.url);
        if (existing) {
          URL.revokeObjectURL(existing);
          objectUrlByResolved.delete(asset.url);
        }
      }
    }
  } catch {
    /* ignore */
  }
}

async function totalCachedBytes(): Promise<number> {
  try {
    const db = await openDb();
    const all = await idbGetAll<CachedAsset>(db, STORE_ASSETS);
    return all.reduce((sum, a) => sum + (a.sizeBytes || 0), 0);
  } catch {
    return 0;
  }
}

async function fetchAndStoreAsset(url: string): Promise<boolean> {
  try {
    const db = await openDb();
    const existing = await idbGet<CachedAsset>(db, STORE_ASSETS, url);
    if (existing?.blob) {
      existing.lastAccessedAt = new Date().toISOString();
      await idbPut(db, STORE_ASSETS, existing);
      return true;
    }

    const res = await fetch(url, { mode: "cors", credentials: "omit" });
    if (!res.ok) return false;

    const lenHeader = res.headers.get("content-length");
    if (lenHeader) {
      const len = Number(lenHeader);
      if (Number.isFinite(len) && len > MAX_ASSET_BYTES) return false;
    }

    const blob = await res.blob();
    if (blob.size > MAX_ASSET_BYTES) return false;

    const used = await totalCachedBytes();
    if (used + blob.size > MAX_CACHE_BYTES) {
      await pruneOldestAssets(3);
    }

    const now = new Date().toISOString();
    return putAsset({
      url,
      blob,
      mimeType: blob.type || res.headers.get("content-type") || "application/octet-stream",
      sizeBytes: blob.size,
      cachedAt: now,
      lastAccessedAt: now,
    });
  } catch {
    return false;
  }
}

export async function prefetchDisplayAssets(
  urls: string[],
  opts?: { concurrency?: number },
): Promise<{ ok: string[]; failed: string[] }> {
  const concurrency = opts?.concurrency ?? PREFETCH_CONCURRENCY;
  const ok: string[] = [];
  const failed: string[] = [];
  let index = 0;

  async function worker() {
    while (index < urls.length) {
      const i = index++;
      const url = urls[i];
      const success = await fetchAndStoreAsset(url);
      if (success) ok.push(url);
      else failed.push(url);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, Math.max(1, urls.length)) },
    () => worker(),
  );
  await Promise.all(workers);
  return { ok, failed };
}

/** Resolve a media URL to a blob: object URL when cached offline. */
export async function getCachedAssetObjectUrl(
  url: string,
): Promise<string | null> {
  try {
    const resolved = resolveMediaUrl(url);
    const cachedObj = objectUrlByResolved.get(resolved);
    if (cachedObj) return cachedObj;

    const db = await openDb();
    const asset = await idbGet<CachedAsset>(db, STORE_ASSETS, resolved);
    if (!asset?.blob) return null;

    asset.lastAccessedAt = new Date().toISOString();
    void idbPut(db, STORE_ASSETS, asset);

    const objUrl = URL.createObjectURL(asset.blob);
    objectUrlByResolved.set(resolved, objUrl);
    return objUrl;
  } catch {
    return null;
  }
}

export function revokeCachedObjectUrls(): void {
  for (const [key, url] of objectUrlByResolved) {
    URL.revokeObjectURL(url);
    objectUrlByResolved.delete(key);
  }
}

/**
 * Persist payload immediately, then prefetch media in the background.
 * Never blocks first paint on large video downloads.
 */
export async function syncDisplayCache(payload: DisplayPayload): Promise<void> {
  await writeDisplayCache(payload);
  const urls = extractDisplayAssetUrls(payload);
  const meta: DisplayCacheMeta = {
    screenId: payload.screenId,
    payloadUpdatedAt: payload.updatedAt,
    assetUrls: urls,
    lastSyncAt: new Date().toISOString(),
    lastSyncError: null,
    totalAssetBytes: await totalCachedBytes(),
  };
  await writeDisplayCacheMeta(meta);

  // Fire-and-forget prefetch so kiosk paints from JSON immediately
  void (async () => {
    try {
      const result = await prefetchDisplayAssets(urls);
      await pruneDisplayAssets(urls);
      await writeDisplayCacheMeta({
        ...meta,
        lastSyncAt: new Date().toISOString(),
        lastSyncError:
          result.failed.length > 0
            ? `Failed ${result.failed.length} asset(s)`
            : null,
        totalAssetBytes: await totalCachedBytes(),
        assetUrls: urls,
      });
    } catch (err) {
      await writeDisplayCacheMeta({
        ...meta,
        lastSyncError:
          err instanceof Error ? err.message : "Asset prefetch failed",
      });
    }
  })();
}
