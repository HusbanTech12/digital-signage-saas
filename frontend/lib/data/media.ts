import {
  createMediaFolderApi,
  deleteMediaApi,
  deleteMediaFolderApi,
  downloadMediaApi,
  listMediaApi,
  replaceMediaApi,
  updateMediaApi,
  uploadMediaApi,
  type MediaListDto,
} from "@/lib/api/media";
import { useLiveApi } from "@/lib/api/config";
import { withProvisioned } from "@/lib/data/tenant";
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
  return withProvisioned(t, () =>
    uploadMediaApi(t, file, {
      name: meta.name,
      kind: meta.kind,
      folderId: meta.folderId,
      tags: meta.tags,
      notes: meta.notes,
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
  },
) {
  if (!useLiveApi()) return updateMediaMock(assetId, body);
  const t = requireToken(token);
  return withProvisioned(t, () => updateMediaApi(t, assetId, body));
}

export async function replaceMedia(token: Token, assetId: string, file: File) {
  if (!useLiveApi()) return replaceMediaMock(assetId, file);
  const t = requireToken(token);
  return withProvisioned(t, () => replaceMediaApi(t, assetId, file));
}

export async function deleteMedia(
  token: Token,
  assetId: string,
  force = false,
) {
  if (!useLiveApi()) {
    deleteMediaMock(assetId, force);
    return;
  }
  const t = requireToken(token);
  return withProvisioned(t, () => deleteMediaApi(t, assetId, force));
}

export async function downloadMedia(token: Token, assetId: string) {
  if (!useLiveApi()) return downloadMediaMock(assetId);
  const t = requireToken(token);
  return withProvisioned(t, () => downloadMediaApi(t, assetId));
}

export async function createMediaFolder(
  token: Token,
  input: {
    organizationId: string;
    name: string;
    parentId?: string | null;
    createdByUserId: string;
  },
) {
  if (!useLiveApi()) return createMediaFolderMock(input);
  const t = requireToken(token);
  return withProvisioned(t, () =>
    createMediaFolderApi(t, { name: input.name, parentId: input.parentId }),
  );
}

export async function deleteMediaFolder(token: Token, folderId: string) {
  if (!useLiveApi()) {
    deleteMediaFolderMock(folderId);
    return;
  }
  const t = requireToken(token);
  return withProvisioned(t, () => deleteMediaFolderApi(t, folderId));
}
