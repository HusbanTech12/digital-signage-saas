/**
 * In-memory media library for mock / offline dashboard mode.
 */

import type { MediaAsset, MediaFolder, MediaKind } from "@/lib/types/schema";

type Listener = () => void;

const listeners = new Set<Listener>();

let folders: MediaFolder[] = [
  {
    id: "mfold_logos",
    organizationId: "org_demo_001",
    parentId: null,
    name: "Logos",
    createdByUserId: "user_super",
    createdAt: "2026-08-01T10:00:00.000Z",
    updatedAt: "2026-08-01T10:00:00.000Z",
  },
];

let assets: MediaAsset[] = [
  {
    id: "media_demo_hero",
    organizationId: "org_demo_001",
    folderId: null,
    name: "Menu board hero",
    originalFilename: "hero-placeholder.svg",
    kind: "image",
    mimeType: "image/svg+xml",
    sizeBytes: 420,
    storageKey: "org_demo_001/media_demo_hero/hero-placeholder.svg",
    url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='640' height='360'%3E%3Crect fill='%231c2533' width='640' height='360'/%3E%3Ctext x='50%25' y='50%25' fill='%23e8a54b' font-family='sans-serif' font-size='28' text-anchor='middle' dy='.3em'%3EDemo Image%3C/text%3E%3C/svg%3E",
    width: 640,
    height: 360,
    durationSeconds: null,
    tags: ["demo", "promo"],
    usageCount: 0,
    uploadedByUserId: "user_super",
    notes: "Sample asset for the Media Library",
    createdAt: "2026-08-10T12:00:00.000Z",
    updatedAt: "2026-08-10T12:00:00.000Z",
  },
];

function emit() {
  for (const l of listeners) l();
}

function id(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function inferKind(file: File, explicit?: MediaKind): MediaKind {
  if (explicit) return explicit;
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  return "other";
}

export function subscribeMediaStore(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function listMediaMock(params?: {
  q?: string;
  kind?: string;
  folderId?: string;
  tag?: string;
}) {
  let list = assets.map((a) => ({ ...a, tags: [...a.tags] }));
  let folderList = folders.map((f) => ({ ...f }));

  if (params?.folderId === "__root__") {
    list = list.filter((a) => a.folderId === null);
    folderList = folderList.filter((f) => f.parentId === null);
  } else if (params?.folderId) {
    list = list.filter((a) => a.folderId === params.folderId);
    folderList = folderList.filter((f) => f.parentId === params.folderId);
  }

  const q = params?.q?.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.originalFilename.toLowerCase().includes(q),
    );
  }
  if (params?.kind) list = list.filter((a) => a.kind === params.kind);
  if (params?.tag) list = list.filter((a) => a.tags.includes(params.tag!));

  return { assets: list, folders: folderList, total: list.length };
}

export async function uploadMediaMock(
  file: File,
  meta: {
    organizationId: string;
    uploadedByUserId: string;
    name?: string;
    kind?: MediaKind;
    folderId?: string | null;
    tags?: string[];
    notes?: string;
  },
): Promise<MediaAsset> {
  if (file.size > 50 * 1024 * 1024) throw new Error("File exceeds 50MB limit");
  const objectUrl = URL.createObjectURL(file);
  const asset: MediaAsset = {
    id: id("media"),
    organizationId: meta.organizationId,
    folderId: meta.folderId ?? null,
    name: meta.name?.trim() || file.name.replace(/\.[^.]+$/, ""),
    originalFilename: file.name,
    kind: inferKind(file, meta.kind),
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
    storageKey: `${meta.organizationId}/mock/${file.name}`,
    url: objectUrl,
    width: null,
    height: null,
    durationSeconds: null,
    tags: meta.tags ?? [],
    usageCount: 0,
    uploadedByUserId: meta.uploadedByUserId,
    notes: meta.notes ?? null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  assets = [asset, ...assets];
  emit();
  return { ...asset, tags: [...asset.tags] };
}

export function updateMediaMock(
  assetId: string,
  body: {
    name?: string;
    kind?: MediaKind;
    folderId?: string | null;
    clearFolder?: boolean;
    tags?: string[];
    notes?: string | null;
  },
) {
  const asset = assets.find((a) => a.id === assetId);
  if (!asset) throw new Error("Media asset not found");
  if (body.name !== undefined) asset.name = body.name.trim();
  if (body.kind !== undefined) asset.kind = body.kind;
  if (body.clearFolder) asset.folderId = null;
  else if (body.folderId !== undefined) asset.folderId = body.folderId;
  if (body.tags !== undefined) asset.tags = [...body.tags];
  if (body.notes !== undefined) asset.notes = body.notes;
  asset.updatedAt = nowIso();
  emit();
  return { ...asset, tags: [...asset.tags] };
}

export async function replaceMediaMock(assetId: string, file: File) {
  const asset = assets.find((a) => a.id === assetId);
  if (!asset) throw new Error("Media asset not found");
  if (asset.url.startsWith("blob:")) URL.revokeObjectURL(asset.url);
  asset.url = URL.createObjectURL(file);
  asset.originalFilename = file.name;
  asset.mimeType = file.type || asset.mimeType;
  asset.sizeBytes = file.size;
  asset.kind = inferKind(file, asset.kind === "logo" || asset.kind === "promo" ? asset.kind : undefined);
  asset.updatedAt = nowIso();
  emit();
  return { ...asset, tags: [...asset.tags] };
}

export function deleteMediaMock(assetId: string, force = false) {
  const asset = assets.find((a) => a.id === assetId);
  if (!asset) throw new Error("Media asset not found");
  if (asset.usageCount > 0 && !force) {
    throw new Error(`Asset is in use (${asset.usageCount}). Pass force to delete.`);
  }
  if (asset.url.startsWith("blob:")) URL.revokeObjectURL(asset.url);
  assets = assets.filter((a) => a.id !== assetId);
  emit();
}

export function downloadMediaMock(assetId: string) {
  const asset = assets.find((a) => a.id === assetId);
  if (!asset) throw new Error("Media asset not found");
  return { url: asset.url, expiresIn: null };
}

export function createMediaFolderMock(input: {
  organizationId: string;
  name: string;
  parentId?: string | null;
  createdByUserId: string;
}) {
  const folder: MediaFolder = {
    id: id("mfold"),
    organizationId: input.organizationId,
    parentId: input.parentId ?? null,
    name: input.name.trim(),
    createdByUserId: input.createdByUserId,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  folders = [...folders, folder];
  emit();
  return { ...folder };
}

export function deleteMediaFolderMock(folderId: string) {
  const hasChildren = folders.some((f) => f.parentId === folderId);
  const hasAssets = assets.some((a) => a.folderId === folderId);
  if (hasChildren || hasAssets) {
    throw new Error("Move or delete folder contents before deleting the folder");
  }
  folders = folders.filter((f) => f.id !== folderId);
  emit();
}
