"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { useMockSession } from "@/components/providers/mock-session-provider";
import { useMockStore } from "@/components/providers/mock-data-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApiAuthToken } from "@/lib/api/auth-token";
import { canManageScreens, filterLocationsForUser } from "@/lib/access";
import {
  createScreenGroup,
  deleteScreenGroup,
  listScreenGroups,
} from "@/lib/data/screen-groups";
import type { ScreenGroup } from "@/lib/api/screen-groups";

export default function ScreenGroupsPage() {
  const { session, role } = useMockSession();
  const { locations } = useMockStore();
  const { getApiToken } = useApiAuthToken();
  const [groups, setGroups] = useState<ScreenGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [locationId, setLocationId] = useState("");
  const [layout, setLayout] = useState<"2x2" | "3x3" | "4x4">("2x2");

  const visibleLocations = filterLocationsForUser(locations, session.user);
  const canEdit = canManageScreens(role);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getApiToken();
      const result = await listScreenGroups(token);
      setGroups(result.screenGroups);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load walls");
    } finally {
      setLoading(false);
    }
  }, [getApiToken]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!locationId && visibleLocations[0]) {
      setLocationId(visibleLocations[0].id);
    }
  }, [locationId, visibleLocations]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !locationId) return;
    setCreating(true);
    setError(null);
    try {
      const token = await getApiToken();
      const created = await createScreenGroup(
        {
          name: name.trim(),
          locationId,
          layout,
          contentMode: "shared",
        },
        token,
      );
      window.location.href = `/dashboard/screen-groups/${created.id}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this video wall?")) return;
    try {
      const token = await getApiToken();
      await deleteScreenGroup(id, token);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  const locationName = (id: string) =>
    locations.find((l) => l.id === id)?.name ?? id;

  if (!canManageScreens(role) && role === "content_manager") {
    return (
      <div className="mx-auto max-w-5xl">
        <PageHeader
          title="Video walls"
          description="You do not have access to screen group management."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Video walls"
        description="Group screens into 2×2, 3×3, or 4×4 layouts with synchronized playback."
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
          <div className="space-y-1.5">
            <Label htmlFor="wall-name">Name</Label>
            <Input
              id="wall-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Lobby wall"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wall-loc">Location</Label>
            <select
              id="wall-loc"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              required
            >
              {visibleLocations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wall-layout">Layout</Label>
            <select
              id="wall-layout"
              value={layout}
              onChange={(e) =>
                setLayout(e.target.value as "2x2" | "3x3" | "4x4")
              }
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="2x2">2×2</option>
              <option value="3x3">3×3</option>
              <option value="4x4">4×4</option>
            </select>
          </div>
          <Button type="submit" disabled={creating || !visibleLocations.length}>
            {creating ? "Creating…" : "Create wall"}
          </Button>
        </form>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Location</th>
              <th className="px-4 py-3 font-medium">Layout</th>
              <th className="px-4 py-3 font-medium">Screens</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            ) : groups.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  No video walls yet. Create one to sync multiple screens.
                </td>
              </tr>
            ) : (
              groups.map((g) => (
                <tr key={g.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">{g.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {locationName(g.locationId)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {g.layout} · {g.contentMode}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {g.onlineMemberCount}/{g.memberCount} online
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        render={
                          <Link href={`/dashboard/screen-groups/${g.id}`} />
                        }
                      >
                        Open
                      </Button>
                      {canEdit ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => void handleDelete(g.id)}
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
