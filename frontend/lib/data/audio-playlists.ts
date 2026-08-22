import {
  createAudioPlaylistApi,
  deleteAudioPlaylistApi,
  getAudioPlaylistApi,
  listAudioPlaylistsApi,
  publishAudioPlaylistApi,
  updateAudioPlaylistApi,
  type AudioPlaylist,
  type AudioPlaylistCreateInput,
  type AudioPlaylistUpdateInput,
} from "@/lib/api/audio-playlists";
import { useLiveApi } from "@/lib/api/config";
import { withProvisioned } from "@/lib/data/tenant";

type Token = string | null | undefined;

function requireToken(token: Token): string {
  if (!token) throw new Error("Missing API auth token");
  return token;
}

export async function listAudioPlaylists(
  token: Token,
  params?: { status?: string; q?: string },
): Promise<{ audioPlaylists: AudioPlaylist[]; total: number }> {
  if (!useLiveApi()) return { audioPlaylists: [], total: 0 };
  const t = requireToken(token);
  return withProvisioned(t, () => listAudioPlaylistsApi(t, params));
}

export async function getAudioPlaylist(
  token: Token,
  playlistId: string,
): Promise<AudioPlaylist> {
  if (!useLiveApi()) throw new Error("Audio playlists require live API");
  const t = requireToken(token);
  return withProvisioned(t, () => getAudioPlaylistApi(t, playlistId));
}

export async function createAudioPlaylist(
  input: AudioPlaylistCreateInput,
  token: Token,
): Promise<AudioPlaylist> {
  if (!useLiveApi()) throw new Error("Audio playlists require live API");
  const t = requireToken(token);
  return withProvisioned(t, () => createAudioPlaylistApi(t, input));
}

export async function updateAudioPlaylist(
  playlistId: string,
  input: AudioPlaylistUpdateInput,
  token: Token,
): Promise<AudioPlaylist> {
  if (!useLiveApi()) throw new Error("Audio playlists require live API");
  const t = requireToken(token);
  return withProvisioned(t, () => updateAudioPlaylistApi(t, playlistId, input));
}

export async function deleteAudioPlaylist(
  playlistId: string,
  token: Token,
): Promise<void> {
  if (!useLiveApi()) throw new Error("Audio playlists require live API");
  const t = requireToken(token);
  await withProvisioned(t, () => deleteAudioPlaylistApi(t, playlistId));
}

export async function publishAudioPlaylist(
  playlistId: string,
  body: { screenIds?: string[]; bumpVersion?: boolean },
  token: Token,
): Promise<AudioPlaylist> {
  if (!useLiveApi()) throw new Error("Audio playlists require live API");
  const t = requireToken(token);
  return withProvisioned(t, () => publishAudioPlaylistApi(t, playlistId, body));
}
