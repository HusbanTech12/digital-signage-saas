"use client";

import type { CSSProperties } from "react";
import { AnimatedBoard } from "@/components/display/animated-board";
import {
  animationStyleVars,
  DEFAULT_DISPLAY_ANIMATIONS,
  itemAnimationClass,
  itemDelayMs,
  mergeAnimations,
  type DisplayAnimationConfig,
} from "@/lib/display/animations";
import type { DesignerCanvasJson } from "@/lib/designer/canvas-io";
import { cn } from "@/lib/utils";

type CanvasObject = {
  type?: string;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  fill?: string;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string | number;
  opacity?: number;
  rx?: number;
  ry?: number;
  scaleX?: number;
  scaleY?: number;
  angle?: number;
};

/**
 * Lightweight DOM renderer for Fabric-like canvas JSON.
 * Intentionally avoids loading Fabric.js on the kiosk route.
 */
export function CanvasBoard({
  canvasJson,
  className,
  animations: animationsIn,
  contentKey,
  fillViewport = false,
}: {
  canvasJson: DesignerCanvasJson;
  className?: string;
  animations?: Partial<DisplayAnimationConfig> | null;
  contentKey?: string;
  /** Stretch to parent (video-wall tile). Default keeps design aspect ratio. */
  fillViewport?: boolean;
}) {
  const animations = mergeAnimations(
    animationsIn ?? DEFAULT_DISPLAY_ANIMATIONS,
  );
  const width =
    typeof canvasJson.width === "number" ? canvasJson.width : 1280;
  const height =
    typeof canvasJson.height === "number" ? canvasJson.height : 720;
  const background =
    typeof canvasJson.background === "string" ? canvasJson.background : "#111";
  const objects = Array.isArray(canvasJson.objects)
    ? (canvasJson.objects as CanvasObject[])
    : [];

  return (
    <AnimatedBoard
      animations={animations}
      contentKey={contentKey}
      className={className}
      style={{
        position: "relative",
        width: "100%",
        height: fillViewport ? "100%" : undefined,
        minHeight: fillViewport ? "100%" : undefined,
        aspectRatio: fillViewport ? undefined : `${width} / ${height}`,
        background,
        overflow: "hidden",
      }}
    >
      {objects.map((obj, index) => (
        <CanvasObjectView
          key={index}
          obj={obj}
          canvasWidth={width}
          canvasHeight={height}
          animations={animations}
          index={index}
        />
      ))}
    </AnimatedBoard>
  );
}

function CanvasObjectView({
  obj,
  canvasWidth,
  canvasHeight,
  animations,
  index,
}: {
  obj: CanvasObject;
  canvasWidth: number;
  canvasHeight: number;
  animations: DisplayAnimationConfig;
  index: number;
}) {
  const type = (obj.type ?? "").toLowerCase();
  const leftPct = ((obj.left ?? 0) / canvasWidth) * 100;
  const topPct = ((obj.top ?? 0) / canvasHeight) * 100;
  const widthPct =
    (((obj.width ?? 100) * (obj.scaleX ?? 1)) / canvasWidth) * 100;
  const heightPct =
    (((obj.height ?? 40) * (obj.scaleY ?? 1)) / canvasHeight) * 100;
  const fontSizeVw = ((obj.fontSize ?? 18) / canvasWidth) * 100;
  const transform = obj.angle ? `rotate(${obj.angle}deg)` : undefined;
  const delay = itemDelayMs(index, animations.staggerMs);
  const animClass = itemAnimationClass(
    animations.itemAnimation,
    animations.enabled,
  );
  const animStyle: CSSProperties = {
    ...animationStyleVars(animations),
    ["--dss-item-delay" as string]: `${delay}ms`,
  };

  if (type === "rect") {
    return (
      <div
        className={cn(animClass)}
        style={{
          position: "absolute",
          left: `${leftPct}%`,
          top: `${topPct}%`,
          width: `${widthPct}%`,
          height: `${heightPct}%`,
          background: obj.fill ?? "#333",
          opacity: obj.opacity ?? 1,
          borderRadius: obj.rx ?? obj.ry ?? 0,
          transform,
          ...animStyle,
        }}
      />
    );
  }

  if (
    type === "textbox" ||
    type === "text" ||
    type === "i-text" ||
    type === "fabrictext"
  ) {
    return (
      <div
        className={cn(animClass)}
        style={{
          position: "absolute",
          left: `${leftPct}%`,
          top: `${topPct}%`,
          width: `${widthPct}%`,
          color: obj.fill ?? "#fff",
          fontSize: `${fontSizeVw}vw`,
          fontFamily: obj.fontFamily ?? "system-ui, sans-serif",
          fontWeight: obj.fontWeight ?? 400,
          opacity: obj.opacity ?? 1,
          whiteSpace: "pre-wrap",
          lineHeight: 1.25,
          transform,
          ...animStyle,
        }}
      >
        {obj.text ?? ""}
      </div>
    );
  }

  return null;
}
