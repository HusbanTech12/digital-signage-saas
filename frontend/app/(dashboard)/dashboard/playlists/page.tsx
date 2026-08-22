"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { useMockSession } from "@/components/providers/mock-session-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApiAuthToken } from "@/lib/api/auth-token";
import { canManagePlaylists } from "@/lib/access";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import {
  createPlaylist,
  deletePlaylist,
  listPlaylists,
} from "@/lib/data/playlists";
import type { Playlist } from "@/lib/types/schema";

export default function PlaylistsPage() {
  const { role } = useMockSession();
  const { getApiToken } = useApiAuthToken();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const canEdit = canManagePlaylists(role);
  const canRead = hasPermission(role, PERMISSIONS.PLAYLISTS_READ);

  const refresh = useCallback(async () => {
    if (!canRead) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getApiToken();
      const result = await listPlaylists(token, {
        q: q || undefined,
        status: status || undefined,
      });
      setPlaylists(result.playlists);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load playlists");
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
      const created = await createPlaylist({ name: newName.trim() }, token);
      setNewName("");
      window.location.href = `/dashboard/playlists/${created.id}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this playlist?")) return;
    try {
      const token = await getApiToken();
      await deletePlaylist(id, token);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  if (!canRead) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">
          You do not have permission to view playlists.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Playlists"
        description="Ordered content sequences for screens — menus, templates, images, and videos with duration and looping."
      />

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground" htmlFor="pl-q">
            Search
          </label>
          <Input
            id="pl-q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name…"
            className="w-48"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground" htmlFor="pl-status">
            Status
          </label>
          <select
            id="pl-status"
            className="flex h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <Button type="button" variant="outline" onClick={() => void refresh()}>
          Refresh
        </Button>
      </div>

      {canEdit ? (
        <form
          onSubmit={(e) => void handleCreate(e)}
          className="flex flex-wrap items-end gap-2 rounded-lg border border-border p-3"
        >
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground" htmlFor="pl-new">
              New playlist
            </label>
            <Input
              id="pl-new"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Breakfast rotation"
              className="w-64"
            />
          </div>
          <Button type="submit" disabled={creating || !newName.trim()}>
            {creating ? "Creating…" : "Create"}
          </Button>
        </form>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : playlists.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No playlists yet. Create one to sequence menus, templates, and media
          on TV screens.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {playlists.map((pl) => (
            <li
              key={pl.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <Link
                  href={`/dashboard/playlists/${pl.id}`}
                  className="font-medium hover:underline"
                >
                  {pl.name}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {pl.status} · v{pl.version} · {pl.itemCount} slide
                  {pl.itemCount === 1 ? "" : "s"}
                  {pl.loop ? " · loop" : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  render={<Link href={`/dashboard/playlists/${pl.id}`} />}
                >
                  Open
                </Button>
                {canEdit ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void handleDelete(pl.id)}
                  >
                    Delete
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
