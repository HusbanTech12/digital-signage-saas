"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { AnimatedBoard } from "@/components/display/animated-board";
import {
  animationStyleVars,
  DEFAULT_DISPLAY_ANIMATIONS,
  itemAnimationClass,
  itemDelayMs,
  mergeAnimations,
  type DisplayAnimationConfig,
} from "@/lib/display/animations";
import { useDisplayMediaSrc } from "@/lib/display/use-display-media-src";
import type { DesignerCanvasJson } from "@/lib/designer/canvas-io";
import { cn } from "@/lib/utils";

// SSR renders this component too; layout effects only matter in the browser.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * 1% of the board's own width, so text scales with the board rather than the
 * browser window. Matters for video-wall tiles and dashboard previews, where
 * the board is deliberately not the same size as the viewport.
 */
function useBoardUnit(ref: React.RefObject<HTMLDivElement | null>) {
  const [unit, setUnit] = useState(0);

  useIsomorphicLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    const measure = () => {
      const { clientWidth } = element;
      if (clientWidth) setUnit(clientWidth / 100);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return unit;
}

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
  src?: string;
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
  /**
   * Stretch to fill the parent instead of preserving the design aspect ratio.
   * The board's own aspect ratio already matches its orientation, so filling
   * makes content cover any TV resolution without letterboxing.
   */
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
  const boardRef = useRef<HTMLDivElement>(null);
  const unit = useBoardUnit(boardRef);

  return (
    <AnimatedBoard
      ref={boardRef}
      animations={animations}
      contentKey={contentKey}
      className={className}
      style={
        {
          position: "relative",
          width: "100%",
          height: fillViewport ? "100%" : undefined,
          minHeight: fillViewport ? "100%" : undefined,
          aspectRatio: fillViewport ? undefined : `${width} / ${height}`,
          background,
          overflow: "hidden",
          ...(unit ? { "--canvas-unit": `${unit}px` } : null),
        } as CSSProperties
      }
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
  const imageSrc = useDisplayMediaSrc(obj.src);
  const leftPct = ((obj.left ?? 0) / canvasWidth) * 100;
  const topPct = ((obj.top ?? 0) / canvasHeight) * 100;
  const widthPct =
    (((obj.width ?? 100) * (obj.scaleX ?? 1)) / canvasWidth) * 100;
  const heightPct =
    (((obj.height ?? 40) * (obj.scaleY ?? 1)) / canvasHeight) * 100;
  const fontSizeUnits = ((obj.fontSize ?? 18) / canvasWidth) * 100;
  const transform = obj.angle ? `rotate(${obj.angle}deg)` : undefined;
  const delay = itemDelayMs(index, animations.staggerMs);
  const animClass = itemAnimationClass(
    animations.itemAnimation,
    animations.enabled,
  );
  const animStyle = {
    ...animationStyleVars(animations),
    ["--dss-item-delay"]: `${delay}ms`,
  } as CSSProperties;

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

  // Fabric images, including QR codes dropped onto the canvas.
  if ((type === "image" || type === "fabricimage") && imageSrc) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageSrc}
        alt=""
        className={cn(animClass)}
        style={{
          position: "absolute",
          left: `${leftPct}%`,
          top: `${topPct}%`,
          width: `${widthPct}%`,
          height: `${heightPct}%`,
          objectFit: "contain",
          opacity: obj.opacity ?? 1,
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
          fontSize: `calc(var(--canvas-unit, 1vw) * ${fontSizeUnits})`,
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
