/**
 * Display / kiosk animations — CSS-only, transform+opacity for low-end TVs.
 * Config lives on template.displayConfig.animations (JSON, no migration).
 */

export type BoardTransition =
  | "none"
  | "fade"
  | "slide"
  | "slide-up"
  | "slide-down"
  | "zoom"
  | "scale"
  | "wipe"
  | "dissolve"
  | "pan";

export type ItemAnimation =
  | "none"
  | "fade-in"
  | "slide-up"
  | "slide-left"
  | "zoom-in"
  | "scale-in";

export interface DisplayAnimationConfig {
  enabled: boolean;
  /** Whole-board entrance when content mounts / refreshes */
  boardTransition: BoardTransition;
  /** Staggered entrance for menu rows / canvas objects */
  itemAnimation: ItemAnimation;
  /** 150–900ms; default 400 */
  durationMs: number;
  /** Delay between items; default 45 */
  staggerMs: number;
  /** Re-animate when published content changes */
  animateOnUpdate: boolean;
}

export const DEFAULT_DISPLAY_ANIMATIONS: DisplayAnimationConfig = {
  enabled: true,
  boardTransition: "fade",
  itemAnimation: "fade-in",
  durationMs: 400,
  staggerMs: 45,
  animateOnUpdate: true,
};

export const BOARD_TRANSITION_OPTIONS: {
  id: BoardTransition;
  label: string;
}[] = [
  { id: "none", label: "None" },
  { id: "fade", label: "Fade" },
  { id: "slide", label: "Slide (left)" },
  { id: "slide-up", label: "Slide up" },
  { id: "slide-down", label: "Slide down" },
  { id: "zoom", label: "Zoom" },
  { id: "scale", label: "Scale" },
  { id: "wipe", label: "Wipe" },
  { id: "dissolve", label: "Dissolve" },
  { id: "pan", label: "Pan" },
];

export const ITEM_ANIMATION_OPTIONS: { id: ItemAnimation; label: string }[] = [
  { id: "none", label: "None" },
  { id: "fade-in", label: "Fade in" },
  { id: "slide-up", label: "Slide up" },
  { id: "slide-left", label: "Slide left" },
  { id: "zoom-in", label: "Zoom in" },
  { id: "scale-in", label: "Scale in" },
];

const BOARD_SET = new Set(BOARD_TRANSITION_OPTIONS.map((o) => o.id));
const ITEM_SET = new Set(ITEM_ANIMATION_OPTIONS.map((o) => o.id));

export function mergeAnimations(
  partial?: Partial<DisplayAnimationConfig> | null,
): DisplayAnimationConfig {
  if (!partial) return { ...DEFAULT_DISPLAY_ANIMATIONS };
  const durationMs = clamp(
    Number(partial.durationMs ?? DEFAULT_DISPLAY_ANIMATIONS.durationMs),
    150,
    900,
  );
  const staggerMs = clamp(
    Number(partial.staggerMs ?? DEFAULT_DISPLAY_ANIMATIONS.staggerMs),
    0,
    200,
  );
  const boardTransition = BOARD_SET.has(partial.boardTransition as BoardTransition)
    ? (partial.boardTransition as BoardTransition)
    : DEFAULT_DISPLAY_ANIMATIONS.boardTransition;
  const itemAnimation = ITEM_SET.has(partial.itemAnimation as ItemAnimation)
    ? (partial.itemAnimation as ItemAnimation)
    : DEFAULT_DISPLAY_ANIMATIONS.itemAnimation;

  return {
    enabled: partial.enabled ?? DEFAULT_DISPLAY_ANIMATIONS.enabled,
    boardTransition,
    itemAnimation,
    durationMs,
    staggerMs,
    animateOnUpdate:
      partial.animateOnUpdate ?? DEFAULT_DISPLAY_ANIMATIONS.animateOnUpdate,
  };
}

function clamp(n: number, min: number, max: number) {
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}

/** Cap stagger so long menus don't delay forever on kiosk hardware. */
export function itemDelayMs(
  index: number,
  staggerMs: number,
  maxIndex = 16,
): number {
  return Math.min(index, maxIndex) * staggerMs;
}

export function boardTransitionClass(
  effect: BoardTransition,
  enabled: boolean,
): string {
  if (!enabled || effect === "none") return "";
  return `dss-board dss-board--${effect}`;
}

export function itemAnimationClass(
  effect: ItemAnimation,
  enabled: boolean,
): string {
  if (!enabled || effect === "none") return "";
  return `dss-item dss-item--${effect}`;
}

export function animationStyleVars(config: DisplayAnimationConfig): {
  ["--dss-duration"]: string;
  ["--dss-stagger"]: string;
} {
  return {
    "--dss-duration": `${config.durationMs}ms`,
    "--dss-stagger": `${config.staggerMs}ms`,
  };
}
