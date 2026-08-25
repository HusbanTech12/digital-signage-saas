"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { boardSizeFor } from "@/lib/display/orientation";
import type { ScreenOrientation } from "@/lib/types/schema";
import { cn } from "@/lib/utils";

// SSR renders these components too; layout effects only matter in the browser.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/** Never shrink content past this — beyond it a menu is unreadable anyway. */
const MIN_CONTENT_SCALE = 0.3;
/** Stop re-measuring once successive passes agree this closely. */
const SCALE_EPSILON = 0.005;
const MAX_PASSES = 12;

/**
 * A fixed design-space stage scaled to fill its container.
 *
 * Every board renders into the same 1280x720 (or 720x1280) box regardless of
 * the TV's real resolution, then one transform maps that box onto the screen.
 * A 720p Pi and a 4K panel therefore show an identical composition, and the
 * surface never scrolls — it is a menu board, not a web page. The same scaling
 * makes the component usable as-is inside a small dashboard preview box.
 */
export function DisplaySurface({
  orientation,
  className,
  style,
  stageClassName,
  stageStyle,
  children,
}: {
  orientation: ScreenOrientation;
  className?: string;
  style?: CSSProperties;
  stageClassName?: string;
  stageStyle?: CSSProperties;
  children: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const design = boardSizeFor(orientation);
  const [fit, setFit] = useState(0);

  useIsomorphicLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const measure = () => {
      const { clientWidth, clientHeight } = element;
      if (!clientWidth || !clientHeight) return;
      setFit(
        Math.min(clientWidth / design.width, clientHeight / design.height),
      );
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [design.width, design.height]);

  return (
    <div
      ref={containerRef}
      className={cn("relative h-full w-full overflow-hidden", className)}
      style={style}
    >
      <div
        className={stageClassName}
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: design.width,
          height: design.height,
          transform: `translate(-50%, -50%) scale(${fit || 1})`,
          // Avoid a flash at the unscaled size before the first measurement.
          visibility: fit ? "visible" : "hidden",
          overflow: "hidden",
          ...stageStyle,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Shrinks its children until they fit the available box.
 *
 * Content is laid out in a virtual box that is `1/scale` the size of the real
 * one and then scaled back down, so a long menu keeps its proportions and
 * simply renders smaller instead of overflowing or scrolling.
 */
export function AutoFitContent({
  contentKey,
  className,
  children,
}: {
  /** Re-measure from scratch when this changes (new menu / new slide). */
  contentKey?: string;
  className?: string;
  children: ReactNode;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [, bumpResizeTick] = useState(0);
  const passRef = useRef(0);

  useIsomorphicLayoutEffect(() => {
    passRef.current = 0;
    setScale(1);
  }, [contentKey]);

  useIsomorphicLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const observer = new ResizeObserver(() => {
      passRef.current = 0;
      bumpResizeTick((tick) => tick + 1);
    });
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  // Runs after every commit so it always compares against the scale that was
  // actually painted; converges in a pass or two and then stops.
  useIsomorphicLayoutEffect(() => {
    const inner = innerRef.current;
    if (!inner || passRef.current >= MAX_PASSES) return;

    const { clientWidth, clientHeight } = inner;
    if (!clientWidth || !clientHeight) return;

    const overflow = Math.max(
      inner.scrollHeight / clientHeight,
      inner.scrollWidth / clientWidth,
    );
    if (!Number.isFinite(overflow) || overflow <= 0) return;

    // Growing back toward 1 needs clear headroom, otherwise shrink and grow
    // chase each other across renders.
    if (overflow <= 1 && !(overflow < 0.98 && scale < 1)) return;

    const next = Math.min(1, Math.max(MIN_CONTENT_SCALE, scale / overflow));
    if (Math.abs(next - scale) <= SCALE_EPSILON) return;
    passRef.current += 1;
    setScale(next);
  });

  return (
    <div ref={boxRef} className={cn("relative overflow-hidden", className)}>
      <div
        ref={innerRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: `${100 / scale}%`,
          height: `${100 / scale}%`,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {children}
      </div>
    </div>
  );
}
