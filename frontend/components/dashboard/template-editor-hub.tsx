"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { orientationLabel } from "@/lib/display/orientation";
import type { AudioPlaylist } from "@/lib/api/audio-playlists";
import type { ScreenGroup } from "@/lib/api/screen-groups";
import type {
  Playlist,
  Screen,
  ScreenOrientation,
} from "@/lib/types/schema";

export type TemplateHubTab = "layout" | "audio" | "playlist" | "target";

const TABS: { id: TemplateHubTab; label: string }[] = [
  { id: "layout", label: "Layout" },
  { id: "audio", label: "Audio" },
  { id: "playlist", label: "Playlist" },
  { id: "target", label: "Target" },
];

export function TemplateHubTabBar({
  tab,
  onChange,
}: {
  tab: TemplateHubTab;
  onChange: (tab: TemplateHubTab) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg border border-border p-1">
      {TABS.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={
            tab === item.id
              ? "rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background"
              : "rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
          }
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function TemplateAudioTab({
  audioPlaylists,
  audioPlaylistId,
  audioVolume,
  audioLoop,
  audioMuted,
  onChange,
}: {
  audioPlaylists: AudioPlaylist[];
  audioPlaylistId: string;
  audioVolume: number;
  audioLoop: boolean;
  audioMuted: boolean;
  onChange: (patch: {
    audioPlaylistId?: string;
    audioVolume?: number;
    audioLoop?: boolean;
    audioMuted?: boolean;
  }) => void;
}) {
  const selected = audioPlaylists.find((p) => p.id === audioPlaylistId);
  return (
    <div className="space-y-4 rounded-xl border border-border p-4">
      <div>
        <h2 className="text-sm font-semibold">Background music</h2>
        <p className="text-xs text-muted-foreground">
          Pick a playlist from the Audio library. Tracks stay managed on the
          Audio page — this only assigns playback for this template package.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="hub-audio">Audio playlist</Label>
        <select
          id="hub-audio"
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={audioPlaylistId}
          onChange={(e) => onChange({ audioPlaylistId: e.target.value })}
        >
          <option value="">No background music</option>
          {audioPlaylists.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.trackCount} track{p.trackCount === 1 ? "" : "s"})
            </option>
          ))}
        </select>
      </div>
      {selected?.tracks?.length ? (
        <ul className="space-y-1 text-sm text-muted-foreground">
          {selected.tracks.map((t, i) => (
            <li key={t.id}>
              {i + 1}. {t.label || t.mediaName || "Track"}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-2 text-sm">
          <Label htmlFor="hub-vol">Volume</Label>
          <input
            id="hub-vol"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={audioVolume}
            onChange={(e) => onChange({ audioVolume: Number(e.target.value) })}
          />
          <span className="tabular-nums text-muted-foreground">
            {Math.round(audioVolume * 100)}%
          </span>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={audioLoop}
            onChange={(e) => onChange({ audioLoop: e.target.checked })}
          />
          Loop
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={audioMuted}
            onChange={(e) => onChange({ audioMuted: e.target.checked })}
          />
          Muted
        </label>
      </div>
      <Button variant="outline" size="sm" render={<Link href="/dashboard/audio" />}>
        Open Audio library
      </Button>
    </div>
  );
}

export function TemplatePlaylistTab({
  playlists,
  playlistId,
  durationSeconds,
  sortOrder,
  templateId,
  onChange,
}: {
  playlists: Playlist[];
  playlistId: string;
  durationSeconds: number;
  sortOrder: number | "";
  templateId: string;
  onChange: (patch: {
    playlistId?: string;
    durationSeconds?: number;
    sortOrder?: number | "";
  }) => void;
}) {
  const selected = playlists.find((p) => p.id === playlistId);
  const alreadyIn = selected?.items.some(
    (i) => i.contentType === "template" && i.templateId === templateId,
  );
  return (
    <div className="space-y-4 rounded-xl border border-border p-4">
      <div>
        <h2 className="text-sm font-semibold">Rotation sequence</h2>
        <p className="text-xs text-muted-foreground">
          Optional. If this template is part of a playlist, pick that playlist
          and set how long this slide stays on screen. Full sequences stay on
          the Playlists page.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="hub-pl">Playlist</Label>
        <select
          id="hub-pl"
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={playlistId}
          onChange={(e) => onChange({ playlistId: e.target.value })}
        >
          <option value="">Play this template only (no rotation)</option>
          {playlists.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {p.itemCount} slides
            </option>
          ))}
        </select>
      </div>
      {playlistId ? (
        <>
          <p className="text-xs text-muted-foreground">
            {alreadyIn
              ? "This template is already a slide. Publish updates its duration and republishes the playlist."
              : "Publish will add this template as a slide in the selected playlist."}
          </p>
          {selected?.items.length ? (
            <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
              {selected.items
                .slice()
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((item) => (
                  <li
                    key={item.id}
                    className={
                      item.templateId === templateId ? "font-medium text-foreground" : ""
                    }
                  >
                    {item.label || item.contentType} · {item.durationSeconds}s
                  </li>
                ))}
            </ol>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="hub-dur">This slide duration (sec)</Label>
              <Input
                id="hub-dur"
                type="number"
                min={1}
                max={3600}
                value={durationSeconds}
                onChange={(e) =>
                  onChange({
                    durationSeconds: Math.max(1, Number(e.target.value) || 1),
                  })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hub-order">Position (0 = first)</Label>
              <Input
                id="hub-order"
                type="number"
                min={0}
                value={sortOrder}
                onChange={(e) => {
                  const raw = e.target.value;
                  onChange({
                    sortOrder: raw === "" ? "" : Math.max(0, Number(raw) || 0),
                  });
                }}
              />
            </div>
          </div>
        </>
      ) : null}
      <Button
        variant="outline"
        size="sm"
        render={<Link href="/dashboard/playlists" />}
      >
        Open Playlists
      </Button>
    </div>
  );
}

export function TemplateTargetTab({
  screens,
  groups,
  selectedScreenIds,
  screenGroupId,
  templateOrientation,
  onToggleScreen,
  onGroupChange,
}: {
  screens: Screen[];
  groups: ScreenGroup[];
  selectedScreenIds: string[];
  screenGroupId: string;
  templateOrientation: ScreenOrientation;
  onToggleScreen: (id: string) => void;
  onGroupChange: (id: string) => void;
}) {
  const mismatched = screens.filter(
    (s) =>
      selectedScreenIds.includes(s.id) && s.orientation !== templateOrientation,
  );

  return (
    <div className="space-y-4 rounded-xl border border-border p-4">
      <div>
        <h2 className="text-sm font-semibold">Publish targets</h2>
        <p className="text-xs text-muted-foreground">
          Assign this package to specific screens and/or a video wall. Walls
          stay managed under Screen groups. This template is{" "}
          <span className="font-medium text-foreground">
            {orientationLabel(templateOrientation)}
          </span>
          .
        </p>
      </div>

      {mismatched.length > 0 ? (
        <div
          role="alert"
          className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300"
        >
          <p className="font-medium">
            Orientation mismatch on {mismatched.length} screen
            {mismatched.length === 1 ? "" : "s"}
          </p>
          <p className="mt-1">
            {mismatched.map((s) => s.name).join(", ")}{" "}
            {mismatched.length === 1 ? "is" : "are"} set up as{" "}
            {orientationLabel(mismatched[0]!.orientation)} but this template is{" "}
            {orientationLabel(templateOrientation)}. Publishing still works —
            the layout will stretch — but sections may look cramped. Switch the
            template’s orientation or update the screen to match.
          </p>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="hub-wall">Video wall (optional)</Label>
        <select
          id="hub-wall"
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={screenGroupId}
          onChange={(e) => onGroupChange(e.target.value)}
        >
          <option value="">No wall — screens only</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name} · {g.layout} · {g.memberCount} screens
            </option>
          ))}
        </select>
      </div>
      <ul className="max-h-56 space-y-2 overflow-y-auto text-sm">
        {screens.length === 0 ? (
          <li className="text-muted-foreground">No paired screens in scope.</li>
        ) : (
          screens.map((s) => {
            const matches = s.orientation === templateOrientation;
            return (
              <li key={s.id}>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedScreenIds.includes(s.id)}
                    onChange={() => onToggleScreen(s.id)}
                  />
                  <span className="min-w-0 truncate">{s.name}</span>
                  <span
                    className={
                      matches
                        ? "shrink-0 text-xs text-muted-foreground"
                        : "shrink-0 text-xs font-medium text-amber-600 dark:text-amber-400"
                    }
                    title={
                      matches
                        ? undefined
                        : `This screen is ${orientationLabel(s.orientation)} but the template is ${orientationLabel(templateOrientation)}`
                    }
                  >
                    {orientationLabel(s.orientation)}
                    {matches ? "" : " ⚠"}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {s.status}
                  </span>
                </label>
              </li>
            );
          })
        )}
      </ul>
      <Button
        variant="outline"
        size="sm"
        render={<Link href="/dashboard/screen-groups" />}
      >
        Open Video walls
      </Button>
    </div>
  );
}
