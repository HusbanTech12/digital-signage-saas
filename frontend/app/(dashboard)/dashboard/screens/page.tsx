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
import { useApiAuthToken } from "@/lib/api/auth-token";
import {
  canAccessLocation,
  canManageScreens,
  canPairScreens,
  filterLocationsForUser,
  filterScreensForUser,
} from "@/lib/access";
import { deleteScreen, requestScreenRefresh, updateScreen } from "@/lib/data/tenant";
import {
  CUSTOM_LCD_PRESET_ID,
  LCD_PRESETS,
  lcdPresetLabel,
  lcdPresetSelectValue,
} from "@/lib/display/lcd-presets";
import type { Screen, ScreenOrientation } from "@/lib/types/schema";

export default function ScreensPage() {
  const { session, role } = useMockSession();
  const { locations, screens } = useMockStore();
  const { getApiToken } = useApiAuthToken();
  const [pairOpen, setPairOpen] = useState(false);
  const [editing, setEditing] = useState<Screen | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterLocationId, setFilterLocationId] = useState<string>("all");
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  const visibleLocations = useMemo(
    () => filterLocationsForUser(locations, session.user),
    [locations, session.user],
  );

  const visibleScreens = useMemo(() => {
    let list = filterScreensForUser(screens, session.user);
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

  async function handleDelete(screen: Screen) {
    setError(null);
    if (!confirm(`Remove screen “${screen.name}”?`)) return;
    try {
      const token = await getApiToken();
      await deleteScreen(screen.id, token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    }
  }

  async function handleRefresh(screen: Screen) {
    setError(null);
    setRefreshingId(screen.id);
    try {
      const token = await getApiToken();
      await requestScreenRefresh(screen.id, token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refresh failed.");
    } finally {
      setRefreshingId(null);
    }
  }

  function formatRelative(iso: string | null | undefined) {
    if (!iso) return "—";
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return "—";
    const diff = Date.now() - t;
    if (diff < 60_000) return "Just now";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    return new Date(iso).toLocaleString();
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Screens"
        description="Pair devices, monitor health and sync, and remotely refresh kiosks."
        actions={
          <>
            <Button variant="outline" render={<Link href="/dashboard/setup" />}>
              Stick setup
            </Button>
            <Button
              variant="outline"
              render={<Link href="/dashboard/screen-groups" />}
            >
              Video walls
            </Button>
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
              <th className="hidden px-4 py-3 font-medium xl:table-cell">
                Content
              </th>
              <th className="hidden px-4 py-3 font-medium lg:table-cell">
                Sync
              </th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">
                Heartbeat
              </th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleScreens.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
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
                        {screen.pairingExpiresAt ? (
                          <span>
                            {" "}
                            · expires{" "}
                            {new Date(screen.pairingExpiresAt).toLocaleTimeString()}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                    {screen.lastError ? (
                      <div
                        className="mt-1 max-w-[14rem] truncate text-xs text-destructive"
                        title={screen.lastError}
                      >
                        {screen.lastError}
                      </div>
                    ) : null}
                    {screen.clientAppVersion ? (
                      <div className="text-xs text-muted-foreground">
                        Client {screen.clientAppVersion}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {locationName(screen.locationId)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={screen.status} />
                    {screen.pendingCommand === "refresh" ? (
                      <div className="mt-1 text-xs text-amber-600">
                        Refresh pending
                      </div>
                    ) : null}
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground xl:table-cell">
                    <div className="max-w-[12rem] truncate">
                      {screen.currentContentSummary ??
                        lcdPresetLabel(screen.resolution, screen.orientation)}
                    </div>
                    <div className="text-xs">
                      {screen.resolution} · {screen.orientation}
                      {screen.contentVersion != null
                        ? ` · v${screen.contentVersion}`
                        : ""}
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                    {formatRelative(screen.lastSyncAt)}
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                    {formatRelative(screen.lastHeartbeat)}
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
                      {screen.locationId && screen.status !== "pairing" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={
                            refreshingId === screen.id ||
                            !canAccessLocation(session.user, screen.locationId)
                          }
                          onClick={() => void handleRefresh(screen)}
                        >
                          {refreshingId === screen.id ? "…" : "Refresh"}
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
                        onClick={() => void handleDelete(screen)}
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
          getApiToken={getApiToken}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}

function EditScreenDialog({
  screen,
  locations,
  getApiToken,
  onClose,
}: {
  screen: Screen;
  locations: LocationLike[];
  getApiToken: () => Promise<string | null>;
  onClose: () => void;
}) {
  const [name, setName] = useState(screen.name);
  const [locationId, setLocationId] = useState(screen.locationId ?? "");
  const [orientation, setOrientation] = useState(screen.orientation);
  const [resolution, setResolution] = useState(screen.resolution);
  const [presetId, setPresetId] = useState(
    lcdPresetSelectValue(screen.resolution, screen.orientation),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const activePreset =
    presetId === CUSTOM_LCD_PRESET_ID
      ? null
      : (LCD_PRESETS.find((p) => p.id === presetId) ?? null);

  function applyPreset(nextPresetId: string) {
    setPresetId(nextPresetId);
    if (nextPresetId === CUSTOM_LCD_PRESET_ID) return;
    const preset = LCD_PRESETS.find((p) => p.id === nextPresetId);
    if (!preset) return;
    setResolution(preset.resolution);
    setOrientation(preset.orientation);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      if (!/^\d{3,5}x\d{3,5}$/i.test(resolution.trim())) {
        throw new Error("Resolution must look like 1920x1080.");
      }
      const token = await getApiToken();
      await updateScreen(
        screen.id,
        {
          name,
          locationId: locationId || null,
          orientation,
          resolution: resolution.trim(),
        },
        token,
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setSaving(false);
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
        <div className="space-y-1.5">
          <Label htmlFor="scr-lcd">LCD type</Label>
          <select
            id="scr-lcd"
            value={presetId}
            onChange={(e) => applyPreset(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {LCD_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label} ({preset.resolution})
              </option>
            ))}
            <option value={CUSTOM_LCD_PRESET_ID}>Custom…</option>
          </select>
          <p className="text-xs text-muted-foreground">
            {activePreset?.hint ??
              "Enter the exact pixel size of your physical LCD."}
          </p>
        </div>
        {presetId === CUSTOM_LCD_PRESET_ID ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="scr-orient">Orientation</Label>
              <select
                id="scr-orient"
                value={orientation}
                onChange={(e) =>
                  setOrientation(e.target.value as ScreenOrientation)
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
                placeholder="1920x1080"
                required
              />
            </div>
          </div>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </div>
  );
}

type LocationLike = { id: string; name: string };
