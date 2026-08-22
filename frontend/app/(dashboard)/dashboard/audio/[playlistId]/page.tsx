"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { MediaPicker } from "@/components/media/media-picker";
import { PageHeader } from "@/components/dashboard/page-header";
import { useMockSession } from "@/components/providers/mock-session-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApiAuthToken } from "@/lib/api/auth-token";
import { canManageAudio, canPublishAudio } from "@/lib/access";
import { listScreens } from "@/lib/api/tenant";
import {
  getAudioPlaylist,
  publishAudioPlaylist,
  updateAudioPlaylist,
} from "@/lib/data/audio-playlists";
import type { AudioPlaylist } from "@/lib/api/audio-playlists";
import type { Screen } from "@/lib/types/schema";

type DraftTrack = {
  key: string;
  mediaAssetId: string;
  label: string;
};

export default function AudioPlaylistDetailPage() {
  const params = useParams();
  const playlistId = String(params.playlistId ?? "");
  const { role } = useMockSession();
  const { getApiToken } = useApiAuthToken();

  const [playlist, setPlaylist] = useState<AudioPlaylist | null>(null);
  const [name, setName] = useState("");
  const [loop, setLoop] = useState(true);
  const [volume, setVolume] = useState(0.5);
  const [tracks, setTracks] = useState<DraftTrack[]>([]);
  const [screens, setScreens] = useState<Screen[]>([]);
  const [selectedScreens, setSelectedScreens] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const canEdit = canManageAudio(role);
  const canPublish = canPublishAudio(role);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const token = await getApiToken();
      const pl = await getAudioPlaylist(token, playlistId);
      setPlaylist(pl);
      setName(pl.name);
      setLoop(pl.loop);
      setVolume(pl.volume);
      setTracks(
        pl.tracks.map((t) => ({
          key: t.id,
          mediaAssetId: t.mediaAssetId,
          label: t.label || t.mediaName || "Track",
        })),
      );
      const scr = await listScreens(token);
      setScreens(
        scr.filter((s) => s.locationId && s.status !== "pairing"),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, [getApiToken, playlistId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleSave() {
    if (!canEdit) return;
    setSaving(true);
    setError(null);
    try {
      const token = await getApiToken();
      const updated = await updateAudioPlaylist(
        playlistId,
        {
          name: name.trim(),
          loop,
          volume,
          tracks: tracks.map((t, i) => ({
            mediaAssetId: t.mediaAssetId,
            label: t.label,
            sortOrder: i,
          })),
        },
        token,
      );
      setPlaylist(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (!canPublish) return;
    setSaving(true);
    setError(null);
    try {
      const token = await getApiToken();
      await updateAudioPlaylist(
        playlistId,
        {
          name: name.trim(),
          loop,
          volume,
          tracks: tracks.map((t, i) => ({
            mediaAssetId: t.mediaAssetId,
            label: t.label,
            sortOrder: i,
          })),
        },
        token,
      );
      const published = await publishAudioPlaylist(
        playlistId,
        { screenIds: selectedScreens, bumpVersion: true },
        token,
      );
      setPlaylist(published);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setSaving(false);
    }
  }

  if (!playlist) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Button variant="outline" size="sm" render={<Link href="/dashboard/audio" />}>
          Back
        </Button>
        {error ? <p className="text-sm text-destructive">{error}</p> : <p>Loading…</p>}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title={playlist.name}
          description={`${playlist.status} · v${playlist.version} · ${tracks.length} tracks`}
        />
        <Button variant="outline" size="sm" render={<Link href="/dashboard/audio" />}>
          All audio
        </Button>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="space-y-3 rounded-xl border border-border p-4">
        <div className="space-y-1.5">
          <Label htmlFor="apl-name">Name</Label>
          <Input
            id="apl-name"
            value={name}
            disabled={!canEdit}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={loop}
              disabled={!canEdit}
              onChange={(e) => setLoop(e.target.checked)}
            />
            Loop playlist
          </label>
          <div className="flex items-center gap-2 text-sm">
            <Label htmlFor="apl-vol">Volume</Label>
            <input
              id="apl-vol"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              disabled={!canEdit}
              onChange={(e) => setVolume(Number(e.target.value))}
            />
            <span className="tabular-nums text-muted-foreground">
              {Math.round(volume * 100)}%
            </span>
          </div>
        </div>
        {canEdit ? (
          <Button onClick={() => void handleSave()} disabled={saving}>
            Save
          </Button>
        ) : null}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Tracks</h2>
          {canEdit ? (
            <Button size="sm" variant="outline" onClick={() => setPickerOpen(true)}>
              Add audio
            </Button>
          ) : null}
        </div>
        {tracks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No tracks yet. Upload audio files under Media → Audio, then add them here.
          </p>
        ) : (
          <ul className="space-y-2">
            {tracks.map((t, i) => (
              <li
                key={t.key}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
              >
                <span>
                  {i + 1}. {t.label}
                </span>
                {canEdit ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setTracks((prev) => prev.filter((x) => x.key !== t.key))
                    }
                  >
                    Remove
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      {canPublish ? (
        <div className="space-y-3 rounded-xl border border-border p-4">
          <h2 className="text-sm font-semibold">Publish to screens</h2>
          <p className="text-sm text-muted-foreground">
            Assign this playlist as background music. Screens keep their visual
            menu/playlist independently.
          </p>
          <div className="max-h-48 space-y-2 overflow-y-auto">
            {screens.map((s) => (
              <label key={s.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedScreens.includes(s.id)}
                  onChange={(e) => {
                    setSelectedScreens((prev) =>
                      e.target.checked
                        ? [...prev, s.id]
                        : prev.filter((id) => id !== s.id),
                    );
                  }}
                />
                {s.name}
              </label>
            ))}
          </div>
          <Button
            onClick={() => void handlePublish()}
            disabled={saving || tracks.length === 0}
          >
            Publish & sync
          </Button>
        </div>
      ) : null}

      <MediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        kinds={["audio"]}
        onSelect={(asset) => {
          setTracks((prev) => [
            ...prev,
            {
              key: `new-${asset.id}-${Date.now()}`,
              mediaAssetId: asset.id,
              label: asset.name,
            },
          ]);
          setPickerOpen(false);
        }}
      />
    </div>
  );
}
