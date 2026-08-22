import {
  createMediaFolderApi,
  deleteMediaApi,
  deleteMediaFolderApi,
  downloadMediaApi,
  listMediaApi,
  probeMediaApi,
  replaceMediaApi,
  setMediaPosterApi,
  updateMediaApi,
  uploadMediaApi,
  type MediaListDto,
} from "@/lib/api/media";
import { apiFetch } from "@/lib/api/client";
import { useLiveApi } from "@/lib/api/config";
import { withProvisioned } from "@/lib/data/tenant";
import { probeMediaFile } from "@/lib/media/probe";
import {
  createMediaFolderMock,
  deleteMediaFolderMock,
  deleteMediaMock,
  downloadMediaMock,
  listMediaMock,
  replaceMediaMock,
  updateMediaMock,
  uploadMediaMock,
} from "@/lib/mock-api/media-store";
import type { MediaAsset, MediaKind } from "@/lib/types/schema";

type Token = string | null;

function requireToken(token: Token): string {
  if (!token) throw new Error("Missing API auth token");
  return token;
}

export async function listMedia(
  token: Token,
  params?: {
    q?: string;
    kind?: string;
    folderId?: string;
    tag?: string;
  },
): Promise<MediaListDto> {
  if (!useLiveApi()) return listMediaMock(params);
  const t = requireToken(token);
  return withProvisioned(t, () => listMediaApi(t, params));
}

export async function getMediaAsset(
  token: Token,
  assetId: string,
): Promise<MediaAsset> {
  if (!useLiveApi()) {
    const list = listMediaMock();
    const found = list.assets.find((a) => a.id === assetId);
    if (!found) throw new Error("Media not found");
    return found;
  }
  const t = requireToken(token);
  return withProvisioned(t, () =>
    apiFetch<MediaAsset>(`/api/v1/media/assets/${assetId}`, { token: t }),
  );
}

export async function uploadMedia(
  token: Token,
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
  if (!useLiveApi()) return uploadMediaMock(file, meta);
  const t = requireToken(token);
  const probe = await probeMediaFile(file);
  return withProvisioned(t, () =>
    uploadMediaApi(t, file, {
      name: meta.name,
      kind: meta.kind,
      folderId: meta.folderId,
      tags: meta.tags,
      notes: meta.notes,
      width: probe.width,
      height: probe.height,
      durationSeconds: probe.durationSeconds,
    }),
  );
}

export async function updateMedia(
  token: Token,
  assetId: string,
  body: {
    name?: string;
    kind?: MediaKind;
    folderId?: string | null;
    clearFolder?: boolean;
    tags?: string[];
    notes?: string | null;
    width?: number | null;
    height?: number | null;
    durationSeconds?: number | null;
    trimStartSeconds?: number | null;
    trimEndSeconds?: number | null;
    clearTrim?: boolean;
    cropX?: number | null;
    cropY?: number | null;
    cropW?: number | null;
    cropH?: number | null;
    clearCrop?: boolean;
    muted?: boolean;
    loop?: boolean;
  },
): Promise<MediaAsset> {
  if (!useLiveApi()) return updateMediaMock(assetId, body);
  const t = requireToken(token);
  return withProvisioned(t, () => updateMediaApi(t, assetId, body));
}

export async function probeMedia(
  token: Token,
  assetId: string,
  body: {
    width?: number;
    height?: number;
    durationSeconds?: number;
  },
): Promise<MediaAsset> {
  if (!useLiveApi()) throw new Error("Probe requires live API");
  const t = requireToken(token);
  return withProvisioned(t, () => probeMediaApi(t, assetId, body));
}

export async function setMediaPoster(
  token: Token,
  assetId: string,
  blob: Blob,
): Promise<MediaAsset> {
  if (!useLiveApi()) throw new Error("Poster requires live API");
  const t = requireToken(token);
  return withProvisioned(t, () => setMediaPosterApi(t, assetId, blob));
}

export async function replaceMedia(
  token: Token,
  assetId: string,
  file: File,
): Promise<MediaAsset> {
  if (!useLiveApi()) return replaceMediaMock(assetId, file);
  const t = requireToken(token);
  return withProvisioned(t, () => replaceMediaApi(t, assetId, file));
}

export async function deleteMedia(
  token: Token,
  assetId: string,
  force = false,
): Promise<void> {
  if (!useLiveApi()) {
    deleteMediaMock(assetId);
    return;
  }
  const t = requireToken(token);
  await withProvisioned(t, () => deleteMediaApi(t, assetId, force));
}

export async function downloadMedia(
  token: Token,
  assetId: string,
): Promise<{ url: string; expiresIn: number | null }> {
  if (!useLiveApi()) return downloadMediaMock(assetId);
  const t = requireToken(token);
  return withProvisioned(t, () => downloadMediaApi(t, assetId));
}

export async function createMediaFolder(
  token: Token,
  input: {
    name: string;
    parentId?: string | null;
    organizationId?: string;
    createdByUserId?: string;
  },
) {
  if (!useLiveApi()) {
    if (!input.organizationId || !input.createdByUserId) {
      throw new Error("organizationId and createdByUserId required in mock mode");
    }
    return createMediaFolderMock({
      organizationId: input.organizationId,
      name: input.name,
      parentId: input.parentId,
      createdByUserId: input.createdByUserId,
    });
  }
  const t = requireToken(token);
  return withProvisioned(t, () =>
    createMediaFolderApi(t, { name: input.name, parentId: input.parentId }),
  );
}
export async function deleteMediaFolder(
  token: Token,
  folderId: string,
): Promise<void> {
  if (!useLiveApi()) {
    deleteMediaFolderMock(folderId);
    return;
  }
  const t = requireToken(token);
  await withProvisioned(t, () => deleteMediaFolderApi(t, folderId));
}
