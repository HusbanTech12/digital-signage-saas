"use client";

import { bu } from "@/components/display/display-surface";
import { useDisplayMediaSrc } from "@/lib/display/use-display-media-src";
import type { BoardQrConfig } from "@/lib/display/menu-board-theme";

const CORNERS: Record<BoardQrConfig["position"], React.CSSProperties> = {
  "top-left": { top: bu(3), left: bu(3) },
  "top-right": { top: bu(3), right: bu(3) },
  "bottom-left": { bottom: bu(3), left: bu(3) },
  "bottom-right": { bottom: bu(3), right: bu(3) },
};

/**
 * QR badge overlaid on a menu board.
 *
 * The code is rendered by the API and cached with the rest of the payload's
 * assets, so a screen that loses connectivity keeps showing a scannable code.
 */
export function BoardQrBadge({
  config,
  textColor,
}: {
  config: BoardQrConfig;
  textColor: string;
}) {
  const src = useDisplayMediaSrc(config.imageUrl);

  if (!config.enabled || !src) return null;

  return (
    <div
      className="absolute flex flex-col items-center"
      style={{
        ...CORNERS[config.position],
        width: bu(config.sizePct),
        gap: bu(0.6),
      }}
    >
      <div
        className="w-full overflow-hidden bg-white"
        style={{ borderRadius: bu(1), padding: bu(0.8) }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className="block h-auto w-full" />
      </div>
      {config.label ? (
        <p
          className="text-center font-semibold tracking-[0.15em] uppercase"
          style={{ color: textColor, fontSize: bu(config.sizePct * 0.11) }}
        >
          {config.label}
        </p>
      ) : null}
    </div>
  );
}
