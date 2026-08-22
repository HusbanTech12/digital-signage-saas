"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApiAuthToken } from "@/lib/api/auth-token";
import { resolveMediaUrl } from "@/lib/api/media";
import { useMockSession } from "@/components/providers/mock-session-provider";
import { canManageMedia } from "@/lib/access";
import {
  getMediaAsset,
  probeMedia,
  setMediaPoster,
  updateMedia,
} from "@/lib/data/media";
import { captureVideoPoster } from "@/lib/media/probe";
import type { MediaAsset } from "@/lib/types/schema";

function formatTime(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function MediaAssetEditorPage() {
  const params = useParams();
  const assetId = String(params.assetId ?? "");
  const { role } = useMockSession();
  const { getApiToken } = useApiAuthToken();
  const videoRef = useRef<HTMLVideoElement>(null);

  const [asset, setAsset] = useState<MediaAsset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [muted, setMuted] = useState(true);
  const [loop, setLoop] = useState(false);
  const [cropX, setCropX] = useState(0);
  const [cropY, setCropY] = useState(0);
  const [cropW, setCropW] = useState(1);
  const [cropH, setCropH] = useState(1);
  const canEdit = canManageMedia(role);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const token = await getApiToken();
      const next = await getMediaAsset(token, assetId);
      setAsset(next);
      setTrimStart(next.trimStartSeconds ?? 0);
      setTrimEnd(
        next.trimEndSeconds ??
          next.durationSeconds ??
          0,
      );
      setMuted(next.muted ?? true);
      setLoop(next.loop ?? false);
      setCropX(next.cropX ?? 0);
      setCropY(next.cropY ?? 0);
      setCropW(next.cropW ?? 1);
      setCropH(next.cropH ?? 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load media");
    }
  }, [assetId, getApiToken]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleLoadedMetadata() {
    const video = videoRef.current;
    if (!video || !asset || !canEdit) return;
    const duration = video.duration;
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (
      (!asset.durationSeconds || !asset.width) &&
      Number.isFinite(duration) &&
      duration > 0
    ) {
      try {
        const token = await getApiToken();
        const updated = await probeMedia(token, asset.id, {
          width: width || undefined,
          height: height || undefined,
          durationSeconds: duration,
        });
        setAsset(updated);
        if (!trimEnd) setTrimEnd(duration);
      } catch {
        /* ignore probe failures */
      }
    }
    if (asset.trimStartSeconds != null) {
      video.currentTime = asset.trimStartSeconds;
    }
  }

  async function handleSave() {
    if (!asset || !canEdit) return;
    setSaving(true);
    setError(null);
    try {
      const token = await getApiToken();
      const updated = await updateMedia(token, asset.id, {
        trimStartSeconds: trimStart,
        trimEndSeconds: trimEnd > trimStart ? trimEnd : null,
        muted,
        loop,
        cropX,
        cropY,
        cropW,
        cropH,
      });
      setAsset(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleCapturePoster() {
    const video = videoRef.current;
    if (!video || !asset || !canEdit) return;
    setSaving(true);
    setError(null);
    try {
      const blob = await captureVideoPoster(video);
      if (!blob) throw new Error("Could not capture frame");
      const token = await getApiToken();
      const updated = await setMediaPoster(token, asset.id, blob);
      setAsset(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Poster failed");
    } finally {
      setSaving(false);
    }
  }

  function markIn() {
    const t = videoRef.current?.currentTime ?? 0;
    setTrimStart(t);
    if (trimEnd <= t) setTrimEnd(t + 1);
  }

  function markOut() {
    const t = videoRef.current?.currentTime ?? 0;
    setTrimEnd(Math.max(t, trimStart + 0.1));
  }

  if (!asset) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <Button variant="outline" size="sm" render={<Link href="/dashboard/media" />}>
          Back
        </Button>
        {error ? <p className="text-sm text-destructive">{error}</p> : <p>Loading…</p>}
      </div>
    );
  }

  const isVideo =
    asset.kind === "video" || asset.mimeType.startsWith("video/");
  const src = resolveMediaUrl(asset.url);
  const poster = asset.posterUrl
    ? resolveMediaUrl(asset.posterUrl)
    : undefined;
  const duration = asset.durationSeconds ?? trimEnd;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title={asset.name}
          description={
            isVideo
              ? "Video editor — trim, poster, mute/loop, and crop for kiosk playback."
              : "Media detail"
          }
        />
        <Button variant="outline" size="sm" render={<Link href="/dashboard/media" />}>
          Library
        </Button>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {!isVideo ? (
        <p className="text-sm text-muted-foreground">
          This asset is not a video. Open a video from the media library to edit.
        </p>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-border bg-black">
            <div
              className="relative mx-auto aspect-video max-h-[70vh] w-full overflow-hidden"
              style={
                cropW < 0.999 || cropH < 0.999
                  ? {
                      // Preview crop via object-position-ish scaling
                    }
                  : undefined
              }
            >
              <video
                ref={videoRef}
                src={src}
                poster={poster}
                className="h-full w-full object-contain"
                style={
                  cropW < 0.999 || cropH < 0.999
                    ? {
                        transform: `scale(${1 / cropW}, ${1 / cropH})`,
                        transformOrigin: `${(cropX / (1 - cropW || 0.01)) * 100}% ${(cropY / (1 - cropH || 0.01)) * 100}%`,
                      }
                    : undefined
                }
                controls
                playsInline
                muted={muted}
                loop={loop}
                onLoadedMetadata={() => void handleLoadedMetadata()}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3 rounded-xl border border-border p-4">
              <h2 className="text-sm font-semibold">Trim</h2>
              <p className="text-xs text-muted-foreground">
                Duration {formatTime(duration)} · In {formatTime(trimStart)} · Out{" "}
                {formatTime(trimEnd)}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={markIn} disabled={!canEdit}>
                  Mark in
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={markOut} disabled={!canEdit}>
                  Mark out
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={!canEdit}
                  onClick={() => {
                    setTrimStart(0);
                    setTrimEnd(asset.durationSeconds ?? 0);
                  }}
                >
                  Clear trim
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="trim-in">Start (sec)</Label>
                  <Input
                    id="trim-in"
                    type="number"
                    min={0}
                    step={0.1}
                    value={trimStart}
                    disabled={!canEdit}
                    onChange={(e) => setTrimStart(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="trim-out">End (sec)</Label>
                  <Input
                    id="trim-out"
                    type="number"
                    min={0}
                    step={0.1}
                    value={trimEnd}
                    disabled={!canEdit}
                    onChange={(e) => setTrimEnd(Number(e.target.value))}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-border p-4">
              <h2 className="text-sm font-semibold">Playback</h2>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={muted}
                  disabled={!canEdit}
                  onChange={(e) => setMuted(e.target.checked)}
                />
                Muted by default
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={loop}
                  disabled={!canEdit}
                  onChange={(e) => setLoop(e.target.checked)}
                />
                Loop video
              </label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!canEdit || saving}
                onClick={() => void handleCapturePoster()}
              >
                Capture poster at playhead
              </Button>
              {poster ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={poster}
                  alt="Poster"
                  className="mt-2 h-24 w-auto rounded-md border border-border object-cover"
                />
              ) : null}
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-border p-4">
            <h2 className="text-sm font-semibold">Crop (normalized 0–1)</h2>
            <p className="text-xs text-muted-foreground">
              Optional viewport crop applied on the kiosk. Leave at full frame (0,0,1,1) for no crop.
            </p>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {(
                [
                  ["X", cropX, setCropX],
                  ["Y", cropY, setCropY],
                  ["W", cropW, setCropW],
                  ["H", cropH, setCropH],
                ] as const
              ).map(([label, value, setter]) => (
                <div key={label} className="space-y-1.5">
                  <Label>{label}</Label>
                  <Input
                    type="number"
                    min={0}
                    max={1}
                    step={0.01}
                    value={value}
                    disabled={!canEdit}
                    onChange={(e) => setter(Number(e.target.value))}
                  />
                </div>
              ))}
            </div>
          </div>

          {canEdit ? (
            <div className="flex gap-2">
              <Button onClick={() => void handleSave()} disabled={saving}>
                {saving ? "Saving…" : "Save video settings"}
              </Button>
              <p className="self-center text-xs text-muted-foreground">
                {asset.width && asset.height
                  ? `${asset.width}×${asset.height}`
                  : "Dimensions pending"}
                {asset.durationSeconds
                  ? ` · ${formatTime(asset.durationSeconds)}`
                  : ""}
              </p>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
