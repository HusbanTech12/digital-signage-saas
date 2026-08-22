"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { useMockSession } from "@/components/providers/mock-session-provider";
import { useMockStore } from "@/components/providers/mock-data-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import { useApiAuthToken } from "@/lib/api/auth-token";
import { canManageScreens, canPublishMenus } from "@/lib/access";
import { listPlaylists } from "@/lib/data/playlists";
import {
  getScreenGroup,
  publishScreenGroup,
  replaceScreenGroupMembers,
  syncScreenGroup,
  updateScreenGroup,
} from "@/lib/data/screen-groups";
import type { ScreenGroup } from "@/lib/api/screen-groups";
import type { Playlist, Screen } from "@/lib/types/schema";

export default function ScreenGroupDetailPage() {
  const params = useParams();
  const groupId = String(params.groupId ?? "");
  const { role } = useMockSession();
  const { screens, menus } = useMockStore();
  const { getApiToken } = useApiAuthToken();

  const [group, setGroup] = useState<ScreenGroup | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [playlistId, setPlaylistId] = useState("");
  const [menuId, setMenuId] = useState("");
  const [contentMode, setContentMode] = useState<"shared" | "tiled">("shared");

  const canEdit = canManageScreens(role);
  const canPublish = canPublishMenus(role);

  const locationScreens = useMemo(() => {
    if (!group) return [] as Screen[];
    return screens.filter(
      (s) =>
        s.locationId === group.locationId &&
        s.status !== "pairing" &&
        s.locationId !== null,
    );
  }, [group, screens]);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const token = await getApiToken();
      const g = await getScreenGroup(token, groupId);
      setGroup(g);
      setContentMode(g.contentMode === "tiled" ? "tiled" : "shared");
      setPlaylistId(g.activePlaylistId ?? "");
      setMenuId(g.activeMenuId ?? "");
      const pl = await listPlaylists(token);
      setPlaylists(pl.playlists);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load wall");
    }
  }, [getApiToken, groupId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function memberAt(row: number, col: number) {
    return group?.members.find((m) => m.rowIndex === row && m.colIndex === col);
  }

  async function assignCell(row: number, col: number, screenId: string) {
    if (!group || !canEdit) return;
    setSaving(true);
    setError(null);
    try {
      const token = await getApiToken();
      const next = group.members
        .filter((m) => !(m.rowIndex === row && m.colIndex === col))
        .filter((m) => m.screenId !== screenId)
        .map((m) => ({
          screenId: m.screenId,
          rowIndex: m.rowIndex,
          colIndex: m.colIndex,
        }));
      if (screenId) {
        next.push({ screenId, rowIndex: row, colIndex: col });
      }
      const updated = await replaceScreenGroupMembers(group.id, next, token);
      setGroup(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Assign failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveMeta() {
    if (!group || !canEdit) return;
    setSaving(true);
    setError(null);
    try {
      const token = await getApiToken();
      const updated = await updateScreenGroup(
        group.id,
        {
          name: group.name,
          contentMode,
          layout: group.layout as "2x2" | "3x3" | "4x4" | "custom",
        },
        token,
      );
      setGroup(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (!group || !canPublish) return;
    setSaving(true);
    setError(null);
    try {
      const token = await getApiToken();
      const updated = await publishScreenGroup(
        group.id,
        {
          playlistId: playlistId || null,
          menuId: menuId || null,
          contentMode,
        },
        token,
      );
      setGroup(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleSync() {
    if (!group || !canEdit) return;
    setSaving(true);
    setError(null);
    try {
      const token = await getApiToken();
      await syncScreenGroup(group.id, token);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSaving(false);
    }
  }

  if (!group) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <Button variant="outline" size="sm" render={<Link href="/dashboard/screen-groups" />}>
          Back
        </Button>
        {error ? <p className="text-sm text-destructive">{error}</p> : <p>Loading…</p>}
      </div>
    );
  }

  const assignedIds = new Set(group.members.map((m) => m.screenId));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title={group.name}
          description={`${group.layout} wall · ${group.onlineMemberCount}/${group.memberCount} online · mode ${group.contentMode}`}
        />
        <Button variant="outline" size="sm" render={<Link href="/dashboard/screen-groups" />}>
          All walls
        </Button>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3 rounded-xl border border-border p-4">
          <h2 className="text-sm font-semibold">Settings</h2>
          <div className="space-y-1.5">
            <Label htmlFor="g-name">Name</Label>
            <Input
              id="g-name"
              value={group.name}
              disabled={!canEdit}
              onChange={(e) => setGroup({ ...group, name: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="g-mode">Content mode</Label>
            <select
              id="g-mode"
              value={contentMode}
              disabled={!canEdit}
              onChange={(e) =>
                setContentMode(e.target.value as "shared" | "tiled")
              }
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="shared">Shared (same content, synced)</option>
              <option value="tiled">Tiled (crop one canvas across panels)</option>
            </select>
          </div>
          {canEdit ? (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void handleSaveMeta()} disabled={saving}>
                Save
              </Button>
              <Button
                variant="outline"
                onClick={() => void handleSync()}
                disabled={saving || group.memberCount === 0}
              >
                Sync now
              </Button>
            </div>
          ) : null}
          {group.syncEpochMs ? (
            <p className="text-xs text-muted-foreground">
              Sync epoch {group.syncEpochMs}
            </p>
          ) : null}
        </div>

        <div className="space-y-3 rounded-xl border border-border p-4">
          <h2 className="text-sm font-semibold">Publish to wall</h2>
          <div className="space-y-1.5">
            <Label htmlFor="g-pl">Playlist</Label>
            <select
              id="g-pl"
              value={playlistId}
              onChange={(e) => setPlaylistId(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              disabled={!canPublish}
            >
              <option value="">— None —</option>
              {playlists.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (v{p.version})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="g-menu">Or menu</Label>
            <select
              id="g-menu"
              value={menuId}
              onChange={(e) => setMenuId(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              disabled={!canPublish}
            >
              <option value="">— None —</option>
              {menus.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          {canPublish ? (
            <Button
              onClick={() => void handlePublish()}
              disabled={saving || (!playlistId && !menuId)}
            >
              Publish & sync
            </Button>
          ) : null}
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold">Grid assignment</h2>
        <p className="text-sm text-muted-foreground">
          Assign paired screens from this location to each cell. Offline panels
          keep playing from cache; Sync now realigns online panels.
        </p>
        <div
          className="grid gap-2"
          style={{
            gridTemplateColumns: `repeat(${group.cols}, minmax(0, 1fr))`,
          }}
        >
          {Array.from({ length: group.rows }).map((_, row) =>
            Array.from({ length: group.cols }).map((__, col) => {
              const member = memberAt(row, col);
              return (
                <div
                  key={`${row}-${col}`}
                  className="rounded-lg border border-border bg-muted/20 p-3"
                >
                  <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      R{row + 1} C{col + 1}
                    </span>
                    {member?.screenStatus ? (
                      <StatusBadge
                        status={
                          member.screenStatus as "online" | "offline" | "pairing"
                        }
                      />
                    ) : null}
                  </div>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                    value={member?.screenId ?? ""}
                    disabled={!canEdit || saving}
                    onChange={(e) => void assignCell(row, col, e.target.value)}
                  >
                    <option value="">Empty</option>
                    {locationScreens.map((s) => (
                      <option
                        key={s.id}
                        value={s.id}
                        disabled={assignedIds.has(s.id) && member?.screenId !== s.id}
                      >
                        {s.name}
                        {s.status === "offline" ? " (offline)" : ""}
                      </option>
                    ))}
                  </select>
                  {member?.screenName ? (
                    <p className="mt-2 truncate text-xs font-medium">
                      {member.screenName}
                    </p>
                  ) : null}
                </div>
              );
            }),
          )}
        </div>
      </div>
    </div>
  );
}
