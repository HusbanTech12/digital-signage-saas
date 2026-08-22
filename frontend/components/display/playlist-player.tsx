"use client";

import { useEffect, useState } from "react";
import { CanvasBoard } from "@/components/display/canvas-board";
import { MenuFallbackBoard } from "@/components/display/menu-fallback-board";
import { PremiumMenuBoard } from "@/components/display/premium-menu-board";
import type {
  PlaylistPlayback,
  PlaylistSlide,
  WallInfo,
} from "@/lib/display/types";
import { mergeDisplayConfig } from "@/lib/display/menu-board-theme";
import { useDisplayMediaSrc } from "@/lib/display/use-display-media-src";
import type { DesignerCanvasJson } from "@/lib/designer/canvas-io";

function SlideView({
  slide,
  statusLabel,
  contentKey,
  onVideoEnded,
}: {
  slide: PlaylistSlide;
  statusLabel?: string;
  contentKey: string;
  onVideoEnded?: () => void;
}) {
  const mediaSrc = useDisplayMediaSrc(slide.mediaUrl);

  if (slide.contentType === "image" && (mediaSrc || slide.mediaUrl)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={mediaSrc ?? slide.mediaUrl!}
          alt={slide.mediaName ?? slide.label ?? "Slide"}
          className="max-h-screen max-w-full object-contain"
        />
      </div>
    );
  }

  if (slide.contentType === "video" && (mediaSrc || slide.mediaUrl)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <video
          key={`${slide.id}-${mediaSrc ?? slide.mediaUrl}`}
          src={mediaSrc ?? slide.mediaUrl!}
          className="max-h-screen max-w-full"
          autoPlay
          muted
          playsInline
          onEnded={onVideoEnded}
        />
      </div>
    );
  }

  if (slide.contentType === "menu") {
    const usePremium = slide.displayConfig?.layout === "premium";
    if (usePremium) {
      return (
        <PremiumMenuBoard
          items={slide.items}
          config={mergeDisplayConfig(slide.displayConfig)}
          statusLabel={statusLabel}
          contentKey={contentKey}
        />
      );
    }
    const canvas = slide.canvasJson as DesignerCanvasJson | null;
    if (canvas && Array.isArray(canvas.objects) && canvas.objects.length > 0) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-950">
          <CanvasBoard
            canvasJson={canvas}
            className="h-auto w-full max-w-[100vw]"
            animations={mergeDisplayConfig(slide.displayConfig).animations}
            contentKey={contentKey}
          />
        </div>
      );
    }
    return (
      <MenuFallbackBoard
        title={slide.menuName ?? slide.label ?? "Menu"}
        items={slide.items}
        animations={mergeDisplayConfig(slide.displayConfig).animations}
        contentKey={contentKey}
      />
    );
  }

  if (slide.contentType === "template") {
    const canvas = slide.canvasJson as DesignerCanvasJson | null;
    const usePremium = slide.displayConfig?.layout === "premium";
    if (usePremium) {
      return (
        <PremiumMenuBoard
          items={slide.items}
          config={mergeDisplayConfig(slide.displayConfig)}
          statusLabel={statusLabel}
          contentKey={contentKey}
        />
      );
    }
    if (canvas && Array.isArray(canvas.objects) && canvas.objects.length > 0) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-950">
          <CanvasBoard
            canvasJson={canvas}
            className="h-auto w-full max-w-[100vw]"
            animations={mergeDisplayConfig(slide.displayConfig).animations}
            contentKey={contentKey}
          />
        </div>
      );
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400">
      Unable to render slide
    </div>
  );
}

function slideDurationMs(slide: PlaylistSlide): number {
  const baseMs = Math.max(1, slide.durationSeconds) * 1000;
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
  statusLabel,
  wall,
}: {
  playlist: PlaylistPlayback;
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
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400">
        Playlist has no playable slides
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      <SlideView
        slide={slide}
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
