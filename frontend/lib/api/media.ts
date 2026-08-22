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
    width?: number | null;
    height?: number | null;
    durationSeconds?: number | null;
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
  if (meta?.width != null) form.append("width", String(meta.width));
  if (meta?.height != null) form.append("height", String(meta.height));
  if (meta?.durationSeconds != null) {
    form.append("duration_seconds", String(meta.durationSeconds));
  }

  let res: Response;
  try {
    res = await fetch(`${base}/api/v1/media/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      body: form,
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : "Network error";
    throw new Error(
      `Cannot reach API at ${base} (${reason}). Check NEXT_PUBLIC_API_URL and that the backend is running.`,
    );
  }
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
) {
  return apiFetch<MediaAsset>(`/api/v1/media/assets/${assetId}`, {
    method: "PATCH",
    token,
    body,
  });
}

export function probeMediaApi(
  token: Token,
  assetId: string,
  body: {
    width?: number;
    height?: number;
    durationSeconds?: number;
  },
) {
  return apiFetch<MediaAsset>(`/api/v1/media/assets/${assetId}/probe`, {
    method: "POST",
    token,
    body,
  });
}

export async function setMediaPosterApi(
  token: Token,
  assetId: string,
  blob: Blob,
) {
  const base = getApiBaseUrl();
  if (!base) throw new Error("NEXT_PUBLIC_API_URL is not configured");
  const form = new FormData();
  form.append("file", blob, "poster.jpg");
  let res: Response;
  try {
    res = await fetch(`${base}/api/v1/media/assets/${assetId}/poster`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      body: form,
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : "Network error";
    throw new Error(
      `Cannot reach API at ${base} (${reason}). Check NEXT_PUBLIC_API_URL and that the backend is running.`,
    );
  }
  if (!res.ok) {
    let message = res.statusText;
    try {
      const data = (await res.json()) as { detail?: string };
      if (typeof data.detail === "string") message = data.detail;
    } catch {
      /* ignore */
    }
    throw new Error(message || `Poster upload failed (${res.status})`);
  }
  return (await res.json()) as MediaAsset;
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
