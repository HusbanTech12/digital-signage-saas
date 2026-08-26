"use client";

import { useEffect, useRef, useState } from "react";
import { PremiumMenuBoard } from "@/components/display/premium-menu-board";
import type {
  PlaylistPlayback,
  PlaylistSlide,
  WallInfo,
} from "@/lib/display/types";
import { mergeDisplayConfig } from "@/lib/display/menu-board-theme";
import { useDisplayMediaSrc } from "@/lib/display/use-display-media-src";
import { resolveMediaUrl } from "@/lib/api/media";
import type { ScreenOrientation } from "@/lib/types/schema";

function VideoSlide({
  slide,
  mediaSrc,
  onVideoEnded,
}: {
  slide: PlaylistSlide;
  mediaSrc: string | null;
  onVideoEnded?: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const muted = slide.muted !== false;
  const loop = Boolean(slide.loop);
  const trimStart = slide.trimStartSeconds ?? 0;
  const trimEnd = slide.trimEndSeconds ?? null;
  const poster = slide.posterUrl ? resolveMediaUrl(slide.posterUrl) : undefined;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const start = Math.max(0, trimStart);
    const onMeta = () => {
      if (Math.abs(el.currentTime - start) > 0.25) {
        el.currentTime = start;
      }
      void el.play().catch(() => undefined);
    };
    el.addEventListener("loadedmetadata", onMeta);
    if (el.readyState >= 1) onMeta();
    return () => el.removeEventListener("loadedmetadata", onMeta);
  }, [trimStart, mediaSrc, slide.id]);

  useEffect(() => {
    const el = ref.current;
    if (!el || trimEnd == null) return;
    const onTime = () => {
      if (el.currentTime >= trimEnd) {
        if (loop) {
          el.currentTime = Math.max(0, trimStart);
          void el.play().catch(() => undefined);
        } else {
          el.pause();
          onVideoEnded?.();
        }
      }
    };
    el.addEventListener("timeupdate", onTime);
    return () => el.removeEventListener("timeupdate", onTime);
  }, [trimEnd, trimStart, loop, onVideoEnded]);

  const crop =
    slide.cropW != null &&
    slide.cropH != null &&
    (slide.cropW < 0.999 || slide.cropH < 0.999);
  const cx = slide.cropX ?? 0;
  const cy = slide.cropY ?? 0;
  const cw = Math.max(0.05, slide.cropW ?? 1);
  const ch = Math.max(0.05, slide.cropH ?? 1);

  return (
    <div className="flex h-dvh w-screen items-center justify-center overflow-hidden bg-black">
      <video
        ref={ref}
        key={`${slide.id}-${mediaSrc ?? slide.mediaUrl}`}
        src={mediaSrc ?? slide.mediaUrl!}
        poster={poster}
        className="max-h-full max-w-full"
        style={
          crop
            ? {
                transform: `scale(${1 / cw}, ${1 / ch})`,
                transformOrigin: `${(cx / Math.max(0.05, 1 - cw)) * 100}% ${(cy / Math.max(0.05, 1 - ch)) * 100}%`,
              }
            : undefined
        }
        autoPlay
        muted={muted}
        loop={loop && trimEnd == null}
        playsInline
        onEnded={trimEnd != null ? undefined : onVideoEnded}
      />
    </div>
  );
}

function SlideView({
  slide,
  orientation,
  statusLabel,
  contentKey,
  onVideoEnded,
}: {
  slide: PlaylistSlide;
  orientation: ScreenOrientation;
  statusLabel?: string;
  contentKey: string;
  onVideoEnded?: () => void;
}) {
  const mediaSrc = useDisplayMediaSrc(slide.mediaUrl);

  if (slide.contentType === "image" && (mediaSrc || slide.mediaUrl)) {
    return (
      <div className="flex h-dvh w-screen items-center justify-center overflow-hidden bg-black">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={mediaSrc ?? slide.mediaUrl!}
          alt={slide.mediaName ?? slide.label ?? "Slide"}
          className="max-h-full max-w-full object-contain"
        />
      </div>
    );
  }

  if (slide.contentType === "video" && (mediaSrc || slide.mediaUrl)) {
    return (
      <VideoSlide
        slide={slide}
        mediaSrc={mediaSrc}
        onVideoEnded={onVideoEnded}
      />
    );
  }

  if (slide.contentType === "menu" || slide.contentType === "template") {
    return (
      <PremiumMenuBoard
        items={slide.items}
        config={mergeDisplayConfig(slide.displayConfig)}
        orientation={orientation}
        statusLabel={statusLabel}
        contentKey={contentKey}
      />
    );
  }

  return (
    <div className="flex h-dvh w-screen items-center justify-center overflow-hidden bg-zinc-950 text-zinc-400">
      Unable to render slide
    </div>
  );
}

function slideDurationMs(slide: PlaylistSlide): number {
  let seconds = slide.durationSeconds;
  if (
    slide.contentType === "video" &&
    slide.trimStartSeconds != null &&
    slide.trimEndSeconds != null &&
    slide.trimEndSeconds > slide.trimStartSeconds
  ) {
    seconds = slide.trimEndSeconds - slide.trimStartSeconds;
  }
  const baseMs = Math.max(1, seconds) * 1000;
  return slide.contentType === "video" ? baseMs + 2000 : baseMs;
}

function indexFromEpoch(
  slides: PlaylistSlide[],
  syncEpochMs: number,
  loop: boolean,
): number {
  if (slides.length === 0) return 0;
  const elapsed = Math.max(0, Date.now() - syncEpochMs);
  let remaining = elapsed;
  let cycles = 0;
  while (true) {
    for (let i = 0; i < slides.length; i++) {
      const dur = slideDurationMs(slides[i]!);
      if (remaining < dur) return i;
      remaining -= dur;
    }
    cycles += 1;
    if (!loop) return slides.length - 1;
    if (cycles > 10_000) return 0;
  }
}

/**
 * Ordered playlist playback for kiosk — CSS timers + video end events.
 * When wall.syncEpochMs is set, all tiles share the same wall-clock index.
 */
export function PlaylistPlayer({
  playlist,
  orientation = "landscape",
  statusLabel,
  wall,
}: {
  playlist: PlaylistPlayback;
  /** Landscape puts menu sections side by side; portrait stacks them. */
  orientation?: ScreenOrientation;
  statusLabel?: string;
  wall?: WallInfo | null;
}) {
  const slides = playlist.slides;
  const syncEpochMs = wall?.syncEpochMs ?? null;
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (syncEpochMs != null) {
      setIndex(indexFromEpoch(slides, syncEpochMs, playlist.loop));
      return;
    }
    setIndex(0);
  }, [playlist.id, playlist.version, slides.length, syncEpochMs, playlist.loop]);

  const slide = slides[index];

  useEffect(() => {
    if (!slide || slides.length === 0) return;

    if (syncEpochMs != null) {
      const tick = () => {
        setIndex(indexFromEpoch(slides, syncEpochMs, playlist.loop));
      };
      tick();
      const id = window.setInterval(tick, 250);
      return () => window.clearInterval(id);
    }

    const ms = slideDurationMs(slide);
    const id = window.setTimeout(() => advance(), ms);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    index,
    slide?.id,
    slide?.durationSeconds,
    slide?.contentType,
    slides.length,
    syncEpochMs,
    playlist.loop,
  ]);

  function advance() {
    setIndex((prev) => {
      const next = prev + 1;
      if (next < slides.length) return next;
      return playlist.loop ? 0 : prev;
    });
  }

  if (!slide) {
    return (
      <div className="flex h-dvh w-screen items-center justify-center overflow-hidden bg-zinc-950 text-zinc-400">
        Playlist has no playable slides
      </div>
    );
  }

  return (
    <div className="relative h-dvh w-screen overflow-hidden">
      <SlideView
        slide={slide}
        orientation={orientation}
        statusLabel={statusLabel}
        contentKey={`${playlist.id}-${playlist.version}-${slide.id}-${index}-${syncEpochMs ?? "local"}`}
        onVideoEnded={syncEpochMs != null ? undefined : advance}
      />
      {slides.length > 1 ? (
        <div className="pointer-events-none absolute bottom-3 left-3 z-20 font-mono text-[10px] tracking-wide text-zinc-500 uppercase">
          {playlist.name} · {index + 1}/{slides.length}
          {syncEpochMs != null ? " · wall sync" : ""}
        </div>
      ) : null}
    </div>
  );
}
