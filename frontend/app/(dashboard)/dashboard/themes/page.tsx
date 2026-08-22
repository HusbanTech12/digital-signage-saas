"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { useMockSession } from "@/components/providers/mock-session-provider";
import { useMockStore } from "@/components/providers/mock-data-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApiAuthToken } from "@/lib/api/auth-token";
import { canManageThemes, filterLocationsForUser } from "@/lib/access";
import { listAudioPlaylists } from "@/lib/data/audio-playlists";
import {
  applyThemesNow,
  createTheme,
  deleteTheme,
  updateTheme,
} from "@/lib/data/themes";
import type { Theme, ThemeRuleKind } from "@/lib/types/schema";

type FormState = {
  name: string;
  kind: ThemeRuleKind;
  startTime: string;
  endTime: string;
  startDate: string;
  endDate: string;
  menuId: string;
  templateId: string;
  audioPlaylistId: string;
  locationIds: string[];
  enabled: boolean;
};

const emptyForm = (defaults?: Partial<FormState>): FormState => ({
  name: "",
  kind: "time_of_day",
  startTime: "06:00",
  endTime: "11:00",
  startDate: "",
  endDate: "",
  menuId: "",
  templateId: "",
  audioPlaylistId: "",
  locationIds: [],
  enabled: true,
  ...defaults,
});

export default function ThemesPage() {
  const { session, role } = useMockSession();
  const { themes, locations, menus, templates } = useMockStore();
  const { getApiToken } = useApiAuthToken();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Theme | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [audioPlaylists, setAudioPlaylists] = useState<
    { id: string; name: string }[]
  >([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const token = await getApiToken();
        if (!token) return;
        const result = await listAudioPlaylists(token);
        if (!cancelled) {
          setAudioPlaylists(
            result.audioPlaylists.map((p) => ({ id: p.id, name: p.name })),
          );
        }
      } catch {
        /* themes still work without audio list */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getApiToken]);

  const visibleLocations = useMemo(
    () => filterLocationsForUser(locations, session.user),
    [locations, session.user],
  );

  const orgThemes = useMemo(
    () =>
      themes
        .filter((t) => t.organizationId === session.organization.id)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [themes, session.organization.id],
  );

  const orgMenus = useMemo(
    () =>
      menus
        .filter((m) => m.organizationId === session.organization.id)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [menus, session.organization.id],
  );

  const orgTemplates = useMemo(
    () =>
      templates
        .filter(
          (t) =>
            t.isGlobal || t.organizationId === session.organization.id,
        )
        .sort((a, b) => a.name.localeCompare(b.name)),
    [templates, session.organization.id],
  );

  if (!canManageThemes(role)) {
    return (
      <div className="mx-auto max-w-4xl">
        <PageHeader
          title="Themes"
          description="Only Super Admins and Admins can manage theme schedules."
        />
      </div>
    );
  }

  function openCreate() {
    setEditing(null);
    setForm(
      emptyForm({
        menuId: orgMenus[0]?.id ?? "",
        templateId: orgTemplates[0]?.id ?? "",
        locationIds: visibleLocations[0] ? [visibleLocations[0].id] : [],
      }),
    );
    setFormOpen(true);
    setError(null);
  }

  function openEdit(theme: Theme) {
    setEditing(theme);
    setForm({
      name: theme.name,
      kind: theme.kind,
      startTime: theme.startTime ?? "06:00",
      endTime: theme.endTime ?? "11:00",
      startDate: theme.startDate ?? "",
      endDate: theme.endDate ?? "",
      menuId: theme.menuId,
      templateId: theme.templateId,
      audioPlaylistId: theme.audioPlaylistId ?? "",
      locationIds: [...theme.locationIds],
      enabled: theme.enabled,
    });
    setFormOpen(true);
    setError(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const token = await getApiToken();
      const payload = {
        organizationId: session.organization.id,
        name: form.name.trim(),
        kind: form.kind,
        startTime: form.kind === "time_of_day" ? form.startTime : null,
        endTime: form.kind === "time_of_day" ? form.endTime : null,
        startDate: form.kind === "date_range" ? form.startDate : null,
        endDate: form.kind === "date_range" ? form.endDate : null,
        menuId: form.menuId,
        templateId: form.templateId,
        audioPlaylistId: form.audioPlaylistId || null,
        locationIds: form.locationIds,
        enabled: form.enabled,
      };
      if (!payload.name) throw new Error("Name is required");
      if (!payload.menuId || !payload.templateId) {
        throw new Error("Choose a menu and template");
      }
      if (!payload.locationIds.length) {
        throw new Error("Select at least one location");
      }
      if (editing) {
        await updateTheme(
          editing.id,
          {
            ...payload,
            clearAudioPlaylist: !form.audioPlaylistId,
          },
          token,
        );
      } else {
        await createTheme(payload, token);
      }
      setFormOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleToggle(theme: Theme) {
    setError(null);
    try {
      const token = await getApiToken();
      await updateTheme(theme.id, { enabled: !theme.enabled }, token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function handleDelete(theme: Theme) {
    if (!confirm(`Delete theme “${theme.name}”?`)) return;
    setError(null);
    try {
      const token = await getApiToken();
      await deleteTheme(theme.id, token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  async function handleApplyNow() {
    setError(null);
    setBusy(true);
    try {
      const token = await getApiToken();
      const result = await applyThemesNow(token);
      setError(
        null,
      );
      alert(
        `Scheduler tick complete — ${result.events} screen update(s)` +
          (result.publishedViaRedis ? " (via Redis)" : " (local/in-process)"),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Apply failed");
    } finally {
      setBusy(false);
    }
  }

  function locationLabel(ids: string[]) {
    return ids
      .map((id) => locations.find((l) => l.id === id)?.name ?? id)
      .join(", ");
  }

  function menuLabel(id: string) {
    return menus.find((m) => m.id === id)?.name ?? id;
  }

  function windowLabel(theme: Theme) {
    if (theme.kind === "time_of_day") {
      return `${theme.startTime ?? "—"} – ${theme.endTime ?? "—"}`;
    }
    return `${theme.startDate ?? "—"} → ${theme.endDate ?? "—"}`;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Themes"
        description="Time-of-day and seasonal rules that auto-switch menus on screens."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => void handleApplyNow()}
              disabled={busy}
            >
              Apply now
            </Button>
            <Button onClick={openCreate}>Add theme</Button>
          </div>
        }
      />

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
              <th className="px-4 py-3 font-medium">Kind</th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">
                Window
              </th>
              <th className="hidden px-4 py-3 font-medium lg:table-cell">
                Menu
              </th>
              <th className="px-4 py-3 font-medium">Enabled</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orgThemes.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No themes yet. Add a breakfast window or seasonal rule.
                </td>
              </tr>
            ) : (
              orgThemes.map((theme) => (
                <tr
                  key={theme.id}
                  className="border-b border-border last:border-0"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium">{theme.name}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground md:hidden">
                      {windowLabel(theme)}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {locationLabel(theme.locationIds)}
                    </div>
                  </td>
                  <td className="px-4 py-3 capitalize">
                    {theme.kind.replaceAll("_", " ")}
                  </td>
                  <td className="hidden px-4 py-3 tabular-nums md:table-cell">
                    {windowLabel(theme)}
                  </td>
                  <td className="hidden px-4 py-3 lg:table-cell">
                    {menuLabel(theme.menuId)}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => void handleToggle(theme)}
                      className={
                        theme.enabled
                          ? "rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300"
                          : "rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
                      }
                    >
                      {theme.enabled ? "On" : "Off"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(theme)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleDelete(theme)}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {formOpen ? (
        <form
          onSubmit={(e) => void handleSave(e)}
          className="space-y-4 rounded-xl border border-border p-4"
        >
          <h2 className="text-base font-semibold">
            {editing ? "Edit theme" : "New theme"}
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="theme-name">Name</Label>
              <Input
                id="theme-name"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="theme-kind">Kind</Label>
              <select
                id="theme-kind"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.kind}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    kind: e.target.value as ThemeRuleKind,
                  }))
                }
              >
                <option value="time_of_day">Time of day</option>
                <option value="date_range">Date range (seasonal)</option>
              </select>
            </div>

            {form.kind === "time_of_day" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="start-time">Start time</Label>
                  <Input
                    id="start-time"
                    type="time"
                    value={form.startTime}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, startTime: e.target.value }))
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end-time">End time</Label>
                  <Input
                    id="end-time"
                    type="time"
                    value={form.endTime}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, endTime: e.target.value }))
                    }
                    required
                  />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="start-date">Start date</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={form.startDate}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, startDate: e.target.value }))
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end-date">End date</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={form.endDate}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, endDate: e.target.value }))
                    }
                    required
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="theme-menu">Menu</Label>
              <select
                id="theme-menu"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.menuId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, menuId: e.target.value }))
                }
                required
              >
                <option value="" disabled>
                  Select menu
                </option>
                {orgMenus.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="theme-template">Template</Label>
              <select
                id="theme-template"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.templateId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, templateId: e.target.value }))
                }
                required
              >
                <option value="" disabled>
                  Select template
                </option>
                {orgTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.isGlobal ? " (global)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="theme-audio">Background music (optional)</Label>
              <select
                id="theme-audio"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.audioPlaylistId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, audioPlaylistId: e.target.value }))
                }
              >
                <option value="">None</option>
                {audioPlaylists.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                When this theme is active, screens get this audio playlist.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Locations</Label>
            <div className="flex flex-wrap gap-3">
              {visibleLocations.map((loc) => {
                const checked = form.locationIds.includes(loc.id);
                return (
                  <label
                    key={loc.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setForm((f) => ({
                          ...f,
                          locationIds: checked
                            ? f.locationIds.filter((id) => id !== loc.id)
                            : [...f.locationIds, loc.id],
                        }))
                      }
                    />
                    {loc.name}
                  </label>
                );
              })}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) =>
                setForm((f) => ({ ...f, enabled: e.target.checked }))
              }
            />
            Enabled
          </label>

          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setFormOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
