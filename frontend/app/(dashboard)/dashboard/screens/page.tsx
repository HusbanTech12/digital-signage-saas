"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { PairScreenDialog } from "@/components/dashboard/pair-screen-dialog";
import { useMockSession } from "@/components/providers/mock-session-provider";
import { useMockStore } from "@/components/providers/mock-data-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  canAccessLocation,
  canManageScreens,
  canPairScreens,
  filterLocationsForUser,
  filterScreensForUser,
} from "@/lib/access";
import { deleteScreen, updateScreen } from "@/lib/mock-api/store";
import type { Screen } from "@/lib/types/schema";

export default function ScreensPage() {
  const { session, role } = useMockSession();
  const { locations, screens } = useMockStore();
  const [pairOpen, setPairOpen] = useState(false);
  const [editing, setEditing] = useState<Screen | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterLocationId, setFilterLocationId] = useState<string>("all");

  const visibleLocations = useMemo(
    () => filterLocationsForUser(locations, session.user),
    [locations, session.user],
  );

  const visibleScreens = useMemo(() => {
    let list = filterScreensForUser(screens, session.user);
    // Also show unpaired (pairing) screens for admins who can pair
    if (canPairScreens(role)) {
      const unpaired = screens.filter(
        (s) =>
          s.organizationId === session.organization.id &&
          s.status === "pairing" &&
          s.locationId === null,
      );
      const ids = new Set(list.map((s) => s.id));
      for (const s of unpaired) {
        if (!ids.has(s.id)) list = [...list, s];
      }
    }
    if (filterLocationId !== "all") {
      list = list.filter((s) => s.locationId === filterLocationId);
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [screens, session, role, filterLocationId]);

  const locationName = (locationId: string | null) => {
    if (!locationId) return "Unassigned";
    return locations.find((l) => l.id === locationId)?.name ?? "Unknown";
  };

  if (!canManageScreens(role)) {
    return (
      <div className="mx-auto max-w-5xl">
        <PageHeader
          title="Screens"
          description="You do not have access to screen management."
        />
      </div>
    );
  }

  function handleDelete(screen: Screen) {
    setError(null);
    if (!confirm(`Remove screen “${screen.name}”?`)) return;
    try {
      deleteScreen(screen.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Screens"
        description="Pair devices, assign locations, and monitor online status."
        actions={
          <>
            <Button variant="outline" render={<Link href="/pair" target="_blank" />}>
              Open /pair
            </Button>
            {canPairScreens(role) ? (
              <Button onClick={() => setPairOpen(true)}>Enter code</Button>
            ) : null}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <Label htmlFor="screen-filter" className="text-xs text-muted-foreground">
          Filter by location
        </Label>
        <select
          id="screen-filter"
          value={filterLocationId}
          onChange={(e) => setFilterLocationId(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="all">All locations</option>
          {visibleLocations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.name}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Location</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="hidden px-4 py-3 font-medium lg:table-cell">
                Resolution
              </th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">
                Last heartbeat
              </th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleScreens.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No screens yet. Open /pair on a display, then click Enter code.
                </td>
              </tr>
            ) : (
              visibleScreens.map((screen) => (
                <tr
                  key={screen.id}
                  className="border-b border-border last:border-0"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium">{screen.name}</div>
                    {screen.pairingCode ? (
                      <div className="font-mono text-xs text-muted-foreground">
                        Code {screen.pairingCode}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {locationName(screen.locationId)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={screen.status} />
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                    {screen.resolution} · {screen.orientation}
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                    {screen.lastHeartbeat
                      ? new Date(screen.lastHeartbeat).toLocaleString()
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {screen.locationId ? (
                        <Button
                          size="sm"
                          variant="outline"
                          render={
                            <Link
                              href={`/display/${screen.id}`}
                              target="_blank"
                            />
                          }
                        >
                          Open
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditing(screen)}
                        disabled={
                          screen.locationId !== null &&
                          !canAccessLocation(session.user, screen.locationId)
                        }
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(screen)}
                      >
                        Remove
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <PairScreenDialog
        open={pairOpen}
        onClose={() => setPairOpen(false)}
        locations={visibleLocations}
        organizationId={session.organization.id}
      />

      {editing ? (
        <EditScreenDialog
          screen={editing}
          locations={visibleLocations}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}

function EditScreenDialog({
  screen,
  locations,
  onClose,
}: {
  screen: Screen;
  locations: LocationLike[];
  onClose: () => void;
}) {
  const [name, setName] = useState(screen.name);
  const [locationId, setLocationId] = useState(screen.locationId ?? "");
  const [orientation, setOrientation] = useState(screen.orientation);
  const [resolution, setResolution] = useState(screen.resolution);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      updateScreen(screen.id, {
        name,
        locationId: locationId || null,
        orientation,
        resolution,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-md space-y-3 rounded-xl border border-border bg-background p-5 shadow-lg"
      >
        <h2 className="text-lg font-semibold tracking-tight">Edit screen</h2>
        <div className="space-y-1.5">
          <Label htmlFor="scr-name">Name</Label>
          <Input
            id="scr-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="scr-loc">Location</Label>
          <select
            id="scr-loc"
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Unassigned</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="scr-orient">Orientation</Label>
            <select
              id="scr-orient"
              value={orientation}
              onChange={(e) =>
                setOrientation(e.target.value as Screen["orientation"])
              }
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="landscape">Landscape</option>
              <option value="portrait">Portrait</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="scr-res">Resolution</Label>
            <Input
              id="scr-res"
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              required
            />
          </div>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Save</Button>
        </div>
      </form>
    </div>
  );
}

type LocationLike = { id: string; name: string };
