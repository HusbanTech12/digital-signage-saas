"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { useMockSession } from "@/components/providers/mock-session-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApiAuthToken } from "@/lib/api/auth-token";
import { canManageAudio } from "@/lib/access";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import {
  createAudioPlaylist,
  deleteAudioPlaylist,
  listAudioPlaylists,
} from "@/lib/data/audio-playlists";
import type { AudioPlaylist } from "@/lib/api/audio-playlists";

export default function AudioPlaylistsPage() {
  const { role } = useMockSession();
  const { getApiToken } = useApiAuthToken();
  const [playlists, setPlaylists] = useState<AudioPlaylist[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const canEdit = canManageAudio(role);
  const canRead = hasPermission(role, PERMISSIONS.AUDIO_READ);

  const refresh = useCallback(async () => {
    if (!canRead) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getApiToken();
      const result = await listAudioPlaylists(token, {
        q: q || undefined,
        status: status || undefined,
      });
      setPlaylists(result.audioPlaylists);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load audio");
    } finally {
      setLoading(false);
    }
  }, [canRead, getApiToken, q, status]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const token = await getApiToken();
      const created = await createAudioPlaylist({ name: newName.trim() }, token);
      setNewName("");
      window.location.href = `/dashboard/audio/${created.id}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this audio playlist?")) return;
    try {
      const token = await getApiToken();
      await deleteAudioPlaylist(id, token);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  if (!canRead) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">
          You do not have permission to view audio playlists.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Background audio"
        description="Upload tracks in Media (Audio), build playlists, then publish to screens for ambient music."
      />

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {canEdit ? (
        <form
          onSubmit={handleCreate}
          className="flex flex-wrap items-end gap-3 rounded-xl border border-border p-4"
        >
          <div className="min-w-[12rem] flex-1 space-y-1.5">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Playlist name"
              required
            />
          </div>
          <Button type="submit" disabled={creating}>
            {creating ? "Creating…" : "Create playlist"}
          </Button>
        </form>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-xs"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Tracks</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            ) : playlists.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  No audio playlists yet. Upload audio in Media, then create a playlist.
                </td>
              </tr>
            ) : (
              playlists.map((pl) => (
                <tr key={pl.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">{pl.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {pl.status} · v{pl.version}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {pl.trackCount}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        render={<Link href={`/dashboard/audio/${pl.id}`} />}
                      >
                        Open
                      </Button>
                      {canEdit ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => void handleDelete(pl.id)}
                        >
                          Delete
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
