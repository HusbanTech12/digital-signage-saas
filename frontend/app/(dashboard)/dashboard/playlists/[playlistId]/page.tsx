"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MediaPicker } from "@/components/media/media-picker";
import { ContentVersionHistory } from "@/components/dashboard/content-version-history";
import { PageHeader } from "@/components/dashboard/page-header";
import { useMockSession } from "@/components/providers/mock-session-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApiAuthToken } from "@/lib/api/auth-token";
import { canManagePlaylists, canPublishPlaylists } from "@/lib/access";
import { listMenus, listTemplates } from "@/lib/data/menus";
import { listScreensFromApi } from "@/lib/data/tenant";
import {
  getPlaylist,
  publishPlaylist,
  updatePlaylist,
} from "@/lib/data/playlists";
import type { PlaylistItemInput } from "@/lib/api/playlists";
import type {
  Menu,
  Playlist,
  PlaylistContentType,
  Screen,
  Template,
} from "@/lib/types/schema";

type DraftSlide = {
  key: string;
  contentType: PlaylistContentType;
  durationSeconds: number;
  label: string;
  menuId: string;
  templateId: string;
  mediaAssetId: string;
  mediaLabel: string;
};

function toDraft(pl: Playlist): DraftSlide[] {
  return [...pl.items]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((item, i) => ({
      key: item.id || `new-${i}`,
      contentType: item.contentType as PlaylistContentType,
      durationSeconds: item.durationSeconds,
      label: item.label ?? "",
      menuId: item.menuId ?? "",
      templateId: item.templateId ?? "",
      mediaAssetId: item.mediaAssetId ?? "",
      mediaLabel: item.label ?? item.mediaAssetId ?? "",
    }));
}

export default function PlaylistDetailPage() {
  const params = useParams();
  const playlistId = String(params.playlistId ?? "");
  const { role } = useMockSession();
  const { getApiToken } = useApiAuthToken();

  const canEdit = canManagePlaylists(role);
  const canPublish = canPublishPlaylists(role);

  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loop, setLoop] = useState(true);
  const [priority, setPriority] = useState(0);
  const [slides, setSlides] = useState<DraftSlide[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [screens, setScreens] = useState<Screen[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [selectedScreens, setSelectedScreens] = useState<string[]>([]);
  const [changeSummary, setChangeSummary] = useState("");
  const [mediaPickerFor, setMediaPickerFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getApiToken();
      if (!token) throw new Error("Missing API auth token");
      const [pl, menuList, tplList, screenList] = await Promise.all([
        getPlaylist(token, playlistId),
        listMenus(token).catch(() => [] as Menu[]),
        listTemplates(token).catch(() => [] as Template[]),
        listScreensFromApi(token).catch(() => [] as Screen[]),
      ]);
      setPlaylist(pl);
      setName(pl.name);
      setDescription(pl.description ?? "");
      setLoop(pl.loop);
      setPriority(pl.priority);
      setSlides(toDraft(pl));
      setMenus(menuList);
      setTemplates(tplList);
      setScreens(screenList.filter((s) => s.locationId));
      setSelectedScreens(
        screenList.filter((s) => s.status === "online" && s.locationId).map((s) => s.id),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load playlist");
    } finally {
      setLoading(false);
    }
  }, [getApiToken, playlistId]);

  useEffect(() => {
    void load();
  }, [load]);

  const itemsPayload: PlaylistItemInput[] = useMemo(
    () =>
      slides.map((s, index) => ({
        contentType: s.contentType,
        durationSeconds: s.durationSeconds,
        label: s.label || null,
        menuId: s.contentType === "menu" ? s.menuId || null : null,
        templateId:
          s.contentType === "menu" || s.contentType === "template"
            ? s.templateId || null
            : null,
        mediaAssetId:
          s.contentType === "image" || s.contentType === "video"
            ? s.mediaAssetId || null
            : null,
        sortOrder: index,
      })),
    [slides],
  );

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const token = await getApiToken();
      const updated = await updatePlaylist(
        playlistId,
        {
          name: name.trim(),
          description,
          loop,
          priority,
          items: itemsPayload,
        },
        token,
      );
      setPlaylist(updated);
      setSlides(toDraft(updated));
      setSuccess("Playlist saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const token = await getApiToken();
      await updatePlaylist(
        playlistId,
        {
          name: name.trim(),
          description,
          loop,
          priority,
          items: itemsPayload,
        },
        token,
      );
      const published = await publishPlaylist(
        playlistId,
        selectedScreens,
        token,
        changeSummary.trim() || undefined,
      );
      setPlaylist(published);
      setSlides(toDraft(published));
      setSuccess(
        `Published v${published.version} to ${selectedScreens.length} screen${selectedScreens.length === 1 ? "" : "s"}.`,
      );
      setPublishOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setSaving(false);
    }
  }

  function addSlide(type: PlaylistContentType) {
    setSlides((prev) => [
      ...prev,
      {
        key: `draft-${Date.now()}-${prev.length}`,
        contentType: type,
        durationSeconds: type === "video" ? 30 : 12,
        label: "",
        menuId: menus[0]?.id ?? "",
        templateId: templates[0]?.id ?? "",
        mediaAssetId: "",
        mediaLabel: "",
      },
    ]);
  }

  function moveSlide(index: number, dir: -1 | 1) {
    setSlides((prev) => {
      const next = [...prev];
      const j = index + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  }

  if (loading) {
    return (
      <div className="p-6 text-sm text-muted-foreground">Loading playlist…</div>
    );
  }

  if (!playlist) {
    return (
      <div className="space-y-3 p-6">
        <p className="text-sm text-destructive">{error ?? "Not found"}</p>
        <Button variant="outline" size="sm" render={<Link href="/dashboard/playlists" />}>
          Back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title={playlist.name}
          description={`${playlist.status} · v${playlist.version} · ${slides.length} slides`}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            render={<Link href="/dashboard/playlists" />}
          >
            All playlists
          </Button>
          {canEdit ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={saving}
              onClick={() => void handleSave()}
            >
              {saving ? "Saving…" : "Save draft"}
            </Button>
          ) : null}
          {canPublish ? (
            <Button
              type="button"
              size="sm"
              disabled={saving || slides.length === 0}
              onClick={() => setPublishOpen(true)}
            >
              Publish to screens
            </Button>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="text-sm text-emerald-700" role="status">
          {success}
        </p>
      ) : null}

      <ContentVersionHistory
        entityType="playlist"
        entityId={playlist.id}
        canRestore={canEdit}
        onRestored={() => void load()}
      />

      <div className="grid gap-4 rounded-lg border border-border p-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="pl-name">Name</Label>
          <Input
            id="pl-name"
            value={name}
            disabled={!canEdit}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pl-priority">Priority</Label>
          <Input
            id="pl-priority"
            type="number"
            min={0}
            max={1000}
            value={priority}
            disabled={!canEdit}
            onChange={(e) => setPriority(Number(e.target.value) || 0)}
          />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="pl-desc">Description</Label>
          <Input
            id="pl-desc"
            value={description}
            disabled={!canEdit}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={loop}
            disabled={!canEdit}
            onChange={(e) => setLoop(e.target.checked)}
          />
          Loop playlist on screen
        </label>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Slides</h2>
          {canEdit ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => addSlide("menu")}>
                + Menu
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => addSlide("template")}
              >
                + Template
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => addSlide("image")}
              >
                + Image
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => addSlide("video")}
              >
                + Video
              </Button>
            </div>
          ) : null}
        </div>

        {slides.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Add ordered slides. Each slide has its own duration on the TV.
          </p>
        ) : (
          <ul className="space-y-3">
            {slides.map((slide, index) => (
              <li
                key={slide.key}
                className="rounded-lg border border-border p-3 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    #{index + 1} · {slide.contentType}
                  </p>
                  {canEdit ? (
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => moveSlide(index, -1)}
                      >
                        ↑
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => moveSlide(index, 1)}
                      >
                        ↓
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setSlides((prev) => prev.filter((_, i) => i !== index))
                        }
                      >
                        Remove
                      </Button>
                    </div>
                  ) : null}
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1">
                    <Label>Duration (sec)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={3600}
                      value={slide.durationSeconds}
                      disabled={!canEdit}
                      onChange={(e) =>
                        setSlides((prev) =>
                          prev.map((s, i) =>
                            i === index
                              ? {
                                  ...s,
                                  durationSeconds: Math.max(
                                    1,
                                    Number(e.target.value) || 1,
                                  ),
                                }
                              : s,
                          ),
                        )
                      }
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label>Label (optional)</Label>
                    <Input
                      value={slide.label}
                      disabled={!canEdit}
                      onChange={(e) =>
                        setSlides((prev) =>
                          prev.map((s, i) =>
                            i === index ? { ...s, label: e.target.value } : s,
                          ),
                        )
                      }
                    />
                  </div>
                </div>

                {slide.contentType === "menu" ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label>Menu</Label>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                        value={slide.menuId}
                        disabled={!canEdit}
                        onChange={(e) =>
                          setSlides((prev) =>
                            prev.map((s, i) =>
                              i === index ? { ...s, menuId: e.target.value } : s,
                            ),
                          )
                        }
                      >
                        <option value="">Select menu…</option>
                        {menus.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label>Template (optional)</Label>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                        value={slide.templateId}
                        disabled={!canEdit}
                        onChange={(e) =>
                          setSlides((prev) =>
                            prev.map((s, i) =>
                              i === index
                                ? { ...s, templateId: e.target.value }
                                : s,
                            ),
                          )
                        }
                      >
                        <option value="">Default / none</option>
                        {templates.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : null}

                {slide.contentType === "template" ? (
                  <div className="space-y-1">
                    <Label>Template</Label>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={slide.templateId}
                      disabled={!canEdit}
                      onChange={(e) =>
                        setSlides((prev) =>
                          prev.map((s, i) =>
                            i === index
                              ? { ...s, templateId: e.target.value }
                              : s,
                          ),
                        )
                      }
                    >
                      <option value="">Select template…</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                {slide.contentType === "image" ||
                slide.contentType === "video" ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-sm text-muted-foreground">
                      {slide.mediaAssetId
                        ? `Media: ${slide.mediaLabel || slide.mediaAssetId}`
                        : "No media selected"}
                    </p>
                    {canEdit ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setMediaPickerFor(slide.key)}
                      >
                        Choose from library
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <MediaPicker
        open={mediaPickerFor !== null}
        onClose={() => setMediaPickerFor(null)}
        kinds={
          slides.find((s) => s.key === mediaPickerFor)?.contentType === "video"
            ? ["video"]
            : ["image", "logo", "promo"]
        }
        onSelect={(asset) => {
          setSlides((prev) =>
            prev.map((s) =>
              s.key === mediaPickerFor
                ? {
                    ...s,
                    mediaAssetId: asset.id,
                    mediaLabel: asset.name,
                    label: s.label || asset.name,
                    durationSeconds:
                      asset.kind === "video" && asset.durationSeconds
                        ? Math.max(1, Math.round(asset.durationSeconds))
                        : s.durationSeconds,
                  }
                : s,
            ),
          );
          setMediaPickerFor(null);
        }}
      />

      {publishOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close"
            onClick={() => setPublishOpen(false)}
          />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-background p-5 shadow-lg space-y-4">
            <h3 className="font-semibold">Publish playlist</h3>
            <p className="text-sm text-muted-foreground">
              Snapshots slides for TVs and bumps the version. Theme/menu publish
              clears playlist assignment on those screens.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="pl-change-summary">Change summary (optional)</Label>
              <Input
                id="pl-change-summary"
                value={changeSummary}
                onChange={(e) => setChangeSummary(e.target.value)}
                placeholder="e.g. Added promo video"
              />
            </div>
            <ul className="max-h-48 space-y-2 overflow-y-auto text-sm">
              {screens.map((s) => (
                <li key={s.id}>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedScreens.includes(s.id)}
                      onChange={() =>
                        setSelectedScreens((prev) =>
                          prev.includes(s.id)
                            ? prev.filter((id) => id !== s.id)
                            : [...prev, s.id],
                        )
                      }
                    />
                    {s.name}{" "}
                    <span className="text-muted-foreground">({s.status})</span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPublishOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={saving}
                onClick={() => void handlePublish()}
              >
                {saving ? "Publishing…" : "Publish"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
