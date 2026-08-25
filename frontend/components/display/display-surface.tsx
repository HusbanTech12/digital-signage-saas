"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

// SSR renders these components too; layout effects only matter in the browser.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Shrink floor. Deliberately low: on a menu board an item the customer cannot
 * see at all is worse than one rendered small, so completeness wins over size.
 */
const MIN_CONTENT_SCALE = 0.2;
/** Let a short menu grow to fill the board, but not grotesquely. */
const MAX_CONTENT_SCALE = 1.9;
/** Growing is damped so wrapping changes cannot ping-pong the scale. */
const GROW_DAMPING = 0.6;
/** Stop once successive passes agree this closely. */
const SCALE_EPSILON = 0.004;
const MAX_PASSES = 12;

/**
 * CSS length expressed in board units.
 *
 * One unit is 1% of the board's shorter side, so every size on a menu board is
 * proportional to the panel rather than to a hardcoded pixel value. The `vmin`
 * fallback keeps server-rendered markup close to final before measurement.
 */
export function bu(units: number): string {
  return `calc(var(--board-unit, 1vmin) * ${units})`;
}

/**
 * Full-bleed board surface.
 *
 * Fills its container edge to edge at any aspect ratio — no letterboxing, so a
 * 16:9 TV, an ultrawide panel and a laptop window all get a board that reaches
 * every edge. It publishes `--board-unit` (1% of the shorter side) so type and
 * spacing scale with the panel instead of being fixed in pixels. Because the
 * unit comes from the container and not the viewport, the same component also
 * renders correctly inside a small dashboard preview box.
 */
export function DisplaySurface({
  className,
  style,
  children,
}: {
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [unit, setUnit] = useState(0);

  useIsomorphicLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const measure = () => {
      const { clientWidth, clientHeight } = element;
      if (!clientWidth || !clientHeight) return;
      setUnit(Math.min(clientWidth, clientHeight) / 100);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn("relative h-full w-full overflow-hidden", className)}
      style={
        {
          ...style,
          ...(unit ? { "--board-unit": `${unit}px` } : null),
        } as CSSProperties
      }
    >
      {children}
    </div>
  );
}

/**
 * Centers a fixed-aspect design inside the container without cropping it.
 *
 * Used for artwork whose shape cannot be stretched — a landscape canvas that
 * ended up on a portrait screen gets bars rather than distorted typography.
 * Boards whose shape already agrees with the screen should fill instead.
 */
export function AspectFitBox({
  width,
  height,
  className,
  children,
}: {
  width: number;
  height: number;
  className?: string;
  children: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(0);

  useIsomorphicLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const measure = () => {
      const { clientWidth, clientHeight } = element;
      if (!clientWidth || !clientHeight) return;
      setFit(Math.min(clientWidth / width, clientHeight / height));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [width, height]);

  return (
    <div
      ref={containerRef}
      className={cn("relative h-full w-full overflow-hidden", className)}
    >
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width,
          height,
          transform: `translate(-50%, -50%) scale(${fit || 1})`,
          // Avoid a flash at the unscaled size before the first measurement.
          visibility: fit ? "visible" : "hidden",
        }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Scales its children so they exactly fill the available box.
 *
 * Content is laid out at its natural height in a virtual box of `1/scale` the
 * real width, then transformed back down. A long menu shrinks to fit instead of
 * overflowing into a scrollable page; a short one grows to fill the board.
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
  const [fit, setFit] = useState({ scale: 1, offsetTop: 0 });
  const [, bumpResizeTick] = useState(0);
  const passRef = useRef(0);
  const { scale, offsetTop } = fit;

  useIsomorphicLayoutEffect(() => {
    passRef.current = 0;
    setFit({ scale: 1, offsetTop: 0 });
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
    const box = boxRef.current;
    const inner = innerRef.current;
    if (!box || !inner || passRef.current >= MAX_PASSES) return;

    const boxHeight = box.clientHeight;
    // Natural height of the content inside the virtual box, in virtual px.
    const naturalHeight = inner.offsetHeight;
    if (!boxHeight || !naturalHeight) return;

    // Height that exactly fills the box, plus a guard against sideways spill.
    let target = boxHeight / naturalHeight;
    const widthOverflow = inner.scrollWidth / Math.max(inner.clientWidth, 1);
    if (widthOverflow > 1) target = Math.min(target, scale / widthOverflow);

    target = Math.min(MAX_CONTENT_SCALE, Math.max(MIN_CONTENT_SCALE, target));
    const next =
      target > scale ? scale + (target - scale) * GROW_DAMPING : target;

    // Content that cannot grow enough to fill (a very short menu) is centred
    // rather than left stranded against the top edge.
    const nextOffset = Math.max(0, (boxHeight - naturalHeight * next) / 2);

    if (
      Math.abs(next - scale) <= SCALE_EPSILON &&
      Math.abs(nextOffset - offsetTop) <= 0.5
    ) {
      return;
    }
    passRef.current += 1;
    setFit({ scale: next, offsetTop: nextOffset });
  });

  return (
    <div ref={boxRef} className={cn("relative overflow-hidden", className)}>
      <div
        ref={innerRef}
        style={{
          position: "absolute",
          top: offsetTop,
          left: 0,
          width: `${100 / scale}%`,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {children}
      </div>
    </div>
  );
}
