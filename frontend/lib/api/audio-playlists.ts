import { apiFetch } from "@/lib/api/client";

export type AudioPlaylist = {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  status: string;
  version: number;
  loop: boolean;
  volume: number;
  publishedAt: string | null;
  createdByUserId: string | null;
  publishedByUserId?: string | null;
  createdAt: string;
  updatedAt: string;
  tracks: AudioTrack[];
  trackCount: number;
};

export type AudioTrack = {
  id: string;
  audioPlaylistId: string;
  organizationId: string;
  sortOrder: number;
  mediaAssetId: string;
  label: string | null;
  mediaName?: string | null;
  mediaUrl?: string | null;
  mediaMimeType?: string | null;
  durationSeconds?: number | null;
  createdAt: string;
};

export type AudioTrackInput = {
  mediaAssetId: string;
  label?: string | null;
  sortOrder?: number | null;
};

export type AudioPlaylistCreateInput = {
  name: string;
  description?: string;
  loop?: boolean;
  volume?: number;
  tracks?: AudioTrackInput[];
};

export type AudioPlaylistUpdateInput = {
  name?: string;
  description?: string;
  loop?: boolean;
  volume?: number;
  status?: string;
  tracks?: AudioTrackInput[];
};

type Token = string;

export function listAudioPlaylistsApi(
  token: Token,
  params?: { status?: string; q?: string },
) {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  if (params?.q) search.set("q", params.q);
  const qs = search.toString();
  return apiFetch<{ audioPlaylists: AudioPlaylist[]; total: number }>(
    `/api/v1/audio-playlists${qs ? `?${qs}` : ""}`,
    { token },
  );
}

export function getAudioPlaylistApi(token: Token, playlistId: string) {
  return apiFetch<AudioPlaylist>(`/api/v1/audio-playlists/${playlistId}`, {
    token,
  });
}

export function createAudioPlaylistApi(
  token: Token,
  body: AudioPlaylistCreateInput,
) {
  return apiFetch<AudioPlaylist>("/api/v1/audio-playlists", {
    method: "POST",
    token,
    body,
  });
}

export function updateAudioPlaylistApi(
  token: Token,
  playlistId: string,
  body: AudioPlaylistUpdateInput,
) {
  return apiFetch<AudioPlaylist>(`/api/v1/audio-playlists/${playlistId}`, {
    method: "PATCH",
    token,
    body,
  });
}

export function deleteAudioPlaylistApi(token: Token, playlistId: string) {
  return apiFetch<void>(`/api/v1/audio-playlists/${playlistId}`, {
    method: "DELETE",
    token,
  });
}

export function publishAudioPlaylistApi(
  token: Token,
  playlistId: string,
  body: { screenIds?: string[]; bumpVersion?: boolean },
) {
  return apiFetch<AudioPlaylist>(
    `/api/v1/audio-playlists/${playlistId}/publish`,
    { method: "POST", token, body },
  );
}
