import { apiFetch } from "@/lib/api/client";
import type {
  Playlist,
  PlaylistContentType,
  PlaylistStatus,
} from "@/lib/types/schema";

type Token = string;

export type PlaylistListDto = {
  playlists: Playlist[];
  total: number;
};

export type PlaylistItemInput = {
  contentType: PlaylistContentType;
  durationSeconds?: number;
  label?: string | null;
  menuId?: string | null;
  templateId?: string | null;
  mediaAssetId?: string | null;
  transition?: string | null;
  sortOrder?: number | null;
};

export type PlaylistCreateInput = {
  name: string;
  description?: string;
  loop?: boolean;
  priority?: number;
  items?: PlaylistItemInput[];
};

export type PlaylistUpdateInput = {
  name?: string;
  description?: string;
  loop?: boolean;
  priority?: number;
  status?: PlaylistStatus;
  items?: PlaylistItemInput[];
};

export function listPlaylistsApi(
  token: Token,
  params?: { status?: string; q?: string },
) {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  if (params?.q) search.set("q", params.q);
  const qs = search.toString();
  return apiFetch<PlaylistListDto>(
    `/api/v1/playlists${qs ? `?${qs}` : ""}`,
    { token },
  );
}

export function getPlaylistApi(token: Token, playlistId: string) {
  return apiFetch<Playlist>(`/api/v1/playlists/${playlistId}`, { token });
}

export function createPlaylistApi(token: Token, body: PlaylistCreateInput) {
  return apiFetch<Playlist>("/api/v1/playlists", {
    token,
    method: "POST",
    body,
  });
}

export function updatePlaylistApi(
  token: Token,
  playlistId: string,
  body: PlaylistUpdateInput,
) {
  return apiFetch<Playlist>(`/api/v1/playlists/${playlistId}`, {
    token,
    method: "PATCH",
    body,
  });
}

export function deletePlaylistApi(token: Token, playlistId: string) {
  return apiFetch<void>(`/api/v1/playlists/${playlistId}`, {
    token,
    method: "DELETE",
  });
}

export function publishPlaylistApi(
  token: Token,
  playlistId: string,
  body: {
    screenIds: string[];
    bumpVersion?: boolean;
    changeSummary?: string | null;
  },
) {
  return apiFetch<Playlist>(`/api/v1/playlists/${playlistId}/publish`, {
    token,
    method: "POST",
    body,
  });
}
