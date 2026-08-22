"use client";

import { useEffect, useState } from "react";
import { CanvasBoard } from "@/components/display/canvas-board";
import { MenuFallbackBoard } from "@/components/display/menu-fallback-board";
import { PremiumMenuBoard } from "@/components/display/premium-menu-board";
import { resolveMediaUrl } from "@/lib/api/media";
import type {
  PlaylistPlayback,
  PlaylistSlide,
} from "@/lib/display/types";
import { mergeDisplayConfig } from "@/lib/display/menu-board-theme";
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
  if (slide.contentType === "image" && slide.mediaUrl) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={resolveMediaUrl(slide.mediaUrl)}
          alt={slide.mediaName ?? slide.label ?? "Slide"}
          className="max-h-screen max-w-full object-contain"
        />
      </div>
    );
  }

  if (slide.contentType === "video" && slide.mediaUrl) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <video
          key={slide.id}
          src={resolveMediaUrl(slide.mediaUrl)}
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

/**
 * Ordered playlist playback for kiosk — CSS timers + video end events.
 * Keeps logic light for Fire Stick / Pi Chromium.
 */
export function PlaylistPlayer({
  playlist,
  statusLabel,
}: {
  playlist: PlaylistPlayback;
  statusLabel?: string;
}) {
  const slides = playlist.slides;
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [playlist.id, playlist.version, slides.length]);

  const slide = slides[index];

  useEffect(() => {
    if (!slide || slides.length === 0) return;
    // Videos prefer onEnded; timer is a safety fallback (+2s).
    const baseMs = Math.max(1, slide.durationSeconds) * 1000;
    const ms =
      slide.contentType === "video" ? baseMs + 2000 : baseMs;
    const id = window.setTimeout(() => advance(), ms);
    return () => window.clearTimeout(id);
    // advance intentionally closes over latest index via setState
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, slide?.id, slide?.durationSeconds, slide?.contentType, slides.length]);

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
        contentKey={`${playlist.id}-${playlist.version}-${slide.id}-${index}`}
        onVideoEnded={advance}
      />
      {slides.length > 1 ? (
        <div className="pointer-events-none absolute bottom-3 left-3 z-20 font-mono text-[10px] tracking-wide text-zinc-500 uppercase">
          {playlist.name} · {index + 1}/{slides.length}
        </div>
      ) : null}
    </div>
  );
}
