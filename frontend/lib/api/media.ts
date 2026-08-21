import { apiFetch } from "@/lib/api/client";
import { getApiBaseUrl } from "@/lib/api/config";
import type { MediaAsset, MediaFolder, MediaKind } from "@/lib/types/schema";

type Token = string;

export type MediaListDto = {
  assets: MediaAsset[];
  folders: MediaFolder[];
  total: number;
};

export type MediaDownloadDto = {
  url: string;
  expiresIn: number | null;
};

/** Resolve media URL for <img>/<video> (prefix API base for local content paths). */
export function resolveMediaUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("blob:")) {
    return url;
  }
  const base = getApiBaseUrl();
  if (url.startsWith("/") && base) return `${base}${url}`;
  return url;
}

export function listMediaApi(
  token: Token,
  params?: {
    q?: string;
    kind?: string;
    folderId?: string;
    tag?: string;
    limit?: number;
    offset?: number;
  },
) {
  const search = new URLSearchParams();
  if (params?.q) search.set("q", params.q);
  if (params?.kind) search.set("kind", params.kind);
  if (params?.folderId) search.set("folderId", params.folderId);
  if (params?.tag) search.set("tag", params.tag);
  if (params?.limit) search.set("limit", String(params.limit));
  if (params?.offset) search.set("offset", String(params.offset));
  const qs = search.toString();
  return apiFetch<MediaListDto>(`/api/v1/media${qs ? `?${qs}` : ""}`, { token });
}

export async function uploadMediaApi(
  token: Token,
  file: File,
  meta?: {
    name?: string;
    kind?: MediaKind;
    folderId?: string | null;
    tags?: string[];
    notes?: string;
  },
) {
  const base = getApiBaseUrl();
  if (!base) throw new Error("NEXT_PUBLIC_API_URL is not configured");
  const form = new FormData();
  form.append("file", file);
  if (meta?.name) form.append("name", meta.name);
  if (meta?.kind) form.append("kind", meta.kind);
  if (meta?.folderId) form.append("folder_id", meta.folderId);
  if (meta?.tags?.length) form.append("tags", meta.tags.join(","));
  if (meta?.notes) form.append("notes", meta.notes);

  const res = await fetch(`${base}/api/v1/media/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    body: form,
  });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const data = (await res.json()) as { detail?: string };
      if (typeof data.detail === "string") message = data.detail;
    } catch {
      /* ignore */
    }
    throw new Error(message || `Upload failed (${res.status})`);
  }
  return (await res.json()) as MediaAsset;
}

export function updateMediaApi(
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
  return apiFetch<MediaAsset>(`/api/v1/media/assets/${assetId}`, {
    method: "PATCH",
    token,
    body,
  });
}

export async function replaceMediaApi(token: Token, assetId: string, file: File) {
  const base = getApiBaseUrl();
  if (!base) throw new Error("NEXT_PUBLIC_API_URL is not configured");
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${base}/api/v1/media/assets/${assetId}/content`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    body: form,
  });
  if (!res.ok) {
    throw new Error(`Replace failed (${res.status})`);
  }
  return (await res.json()) as MediaAsset;
}

export function deleteMediaApi(
  token: Token,
  assetId: string,
  force = false,
) {
  return apiFetch<void>(
    `/api/v1/media/assets/${assetId}${force ? "?force=true" : ""}`,
    { method: "DELETE", token },
  );
}

export function downloadMediaApi(token: Token, assetId: string) {
  return apiFetch<MediaDownloadDto>(
    `/api/v1/media/assets/${assetId}/download`,
    { token },
  );
}

export function createMediaFolderApi(
  token: Token,
  body: { name: string; parentId?: string | null },
) {
  return apiFetch<MediaFolder>("/api/v1/media/folders", {
    method: "POST",
    token,
    body,
  });
}

export function deleteMediaFolderApi(token: Token, folderId: string) {
  return apiFetch<void>(`/api/v1/media/folders/${folderId}`, {
    method: "DELETE",
    token,
  });
}
