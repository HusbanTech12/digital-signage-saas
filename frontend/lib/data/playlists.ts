/**
 * Playlist mutations — live FastAPI when enabled.
 */

import {
  createPlaylistApi,
  deletePlaylistApi,
  getPlaylistApi,
  listPlaylistsApi,
  publishPlaylistApi,
  updatePlaylistApi,
  type PlaylistCreateInput,
  type PlaylistUpdateInput,
} from "@/lib/api/playlists";
import { useLiveApi } from "@/lib/api/config";
import { withProvisioned } from "@/lib/data/tenant";
import type { Playlist } from "@/lib/types/schema";

type Token = string | null | undefined;

function requireToken(token: Token): string {
  if (!token) throw new Error("Missing API auth token");
  return token;
}

export async function listPlaylists(
  token: Token,
  params?: { status?: string; q?: string },
): Promise<{ playlists: Playlist[]; total: number }> {
  if (!useLiveApi()) {
    return { playlists: [], total: 0 };
  }
  const t = requireToken(token);
  return withProvisioned(t, () => listPlaylistsApi(t, params));
}

export async function getPlaylist(
  token: Token,
  playlistId: string,
): Promise<Playlist> {
  if (!useLiveApi()) {
    throw new Error("Playlists require live API");
  }
  const t = requireToken(token);
  return withProvisioned(t, () => getPlaylistApi(t, playlistId));
}

export async function createPlaylist(
  input: PlaylistCreateInput,
  token: Token,
): Promise<Playlist> {
  if (!useLiveApi()) {
    throw new Error("Playlists require live API");
  }
  const t = requireToken(token);
  return withProvisioned(t, () => createPlaylistApi(t, input));
}

export async function updatePlaylist(
  playlistId: string,
  input: PlaylistUpdateInput,
  token: Token,
): Promise<Playlist> {
  if (!useLiveApi()) {
    throw new Error("Playlists require live API");
  }
  const t = requireToken(token);
  return withProvisioned(t, () => updatePlaylistApi(t, playlistId, input));
}

export async function deletePlaylist(
  playlistId: string,
  token: Token,
): Promise<void> {
  if (!useLiveApi()) {
    throw new Error("Playlists require live API");
  }
  const t = requireToken(token);
  return withProvisioned(t, () => deletePlaylistApi(t, playlistId));
}

export async function publishPlaylist(
  playlistId: string,
  screenIds: string[],
  token: Token,
  changeSummary?: string | null,
): Promise<Playlist> {
  if (!useLiveApi()) {
    throw new Error("Playlists require live API");
  }
  const t = requireToken(token);
  return withProvisioned(t, () =>
    publishPlaylistApi(t, playlistId, {
      screenIds,
      bumpVersion: true,
      changeSummary,
    }),
  );
}
