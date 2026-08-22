"use client";

import { useEffect, useRef, useState } from "react";
import { resolveMediaUrl } from "@/lib/api/media";
import type { AudioPlayback } from "@/lib/display/types";

/**
 * Silent background music for the kiosk — sequential tracks, loop, volume/mute.
 * Starts muted then unmutes after first play gesture if autoplay is blocked.
 */
export function BackgroundAudioPlayer({ audio }: { audio: AudioPlayback }) {
  const ref = useRef<HTMLAudioElement | null>(null);
  const [index, setIndex] = useState(0);
  const [blocked, setBlocked] = useState(false);

  const tracks = audio.tracks.filter((t) => Boolean(t.url));
  const track = tracks[index] ?? null;
  const src = track ? resolveMediaUrl(track.url) : null;

  useEffect(() => {
    setIndex(0);
  }, [audio.playlistId, audio.version, tracks.length]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !src) return;
    el.volume = Math.max(0, Math.min(1, audio.volume));
    el.muted = audio.muted;
    void el.play().then(
      () => setBlocked(false),
      () => setBlocked(true),
    );
  }, [src, audio.volume, audio.muted, index]);

  useEffect(() => {
    if (!blocked) return;
    const unlock = () => {
      const el = ref.current;
      if (!el) return;
      el.muted = audio.muted;
      void el.play().then(
        () => setBlocked(false),
        () => undefined,
      );
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [blocked, audio.muted]);

  function advance() {
    if (tracks.length === 0) return;
    setIndex((prev) => {
      const next = prev + 1;
      if (next < tracks.length) return next;
      return audio.loop ? 0 : prev;
    });
  }

  if (!src) return null;

  return (
    <>
      <audio
        ref={ref}
        key={`${audio.playlistId}-${track?.id}-${src}`}
        src={src}
        preload="auto"
        onEnded={advance}
        style={{ display: "none" }}
      />
      {blocked ? (
        <button
          type="button"
          className="pointer-events-auto absolute bottom-14 left-3 z-40 rounded bg-black/60 px-3 py-1.5 text-xs text-zinc-200"
          onClick={() => {
            const el = ref.current;
            if (!el) return;
            el.muted = audio.muted;
            void el.play().then(() => setBlocked(false));
          }}
        >
          Tap to enable audio · {audio.name}
        </button>
      ) : null}
    </>
  );
}
