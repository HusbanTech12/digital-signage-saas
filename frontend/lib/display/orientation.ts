/**
 * Orientation is the only screen-shape setting the product exposes.
 *
 * Templates and screens are tagged Landscape or Portrait; nothing in the
 * rendering path depends on a physical pixel size. The designer works in a
 * fixed design-space board per orientation and the kiosk stretches that board
 * to fill whatever resolution the TV actually reports.
 */

import type { ScreenOrientation } from "@/lib/types/schema";

export const ORIENTATIONS: readonly ScreenOrientation[] = [
  "landscape",
  "portrait",
] as const;

export type BoardSize = { width: number; height: number };

/** Design-space board per orientation — a 16:9 / 9:16 coordinate system. */
export const LANDSCAPE_BOARD: BoardSize = { width: 1280, height: 720 };
export const PORTRAIT_BOARD: BoardSize = { width: 720, height: 1280 };

export function boardSizeFor(orientation: ScreenOrientation): BoardSize {
  return orientation === "portrait" ? PORTRAIT_BOARD : LANDSCAPE_BOARD;
}

/** Infer orientation from a board's own dimensions. */
export function orientationOfBoard(
  width: number,
  height: number,
): ScreenOrientation {
  return height > width ? "portrait" : "landscape";
}

/**
 * Nominal resolution stored alongside orientation so existing records and
 * device reports keep a sensible value. Layout never reads it.
 */
export function nominalResolution(orientation: ScreenOrientation): string {
  return orientation === "portrait" ? "1080x1920" : "1920x1080";
}

export function orientationLabel(orientation: ScreenOrientation): string {
  return orientation === "portrait" ? "Portrait" : "Landscape";
}

export function orientationHint(orientation: ScreenOrientation): string {
  return orientation === "portrait"
    ? "Tall 9:16 display — sections stack vertically and fill the screen."
    : "Wide 16:9 display — sections sit side by side and fill the screen.";
}

/**
 * Whether a saved board's own dimensions agree with a screen's orientation.
 * A board that disagrees (e.g. a legacy 16:9 layout on a portrait screen)
 * must not be stretched to fill — it gets letterboxed instead.
 */
export function boardMatchesOrientation(
  board: { width?: unknown; height?: unknown } | null | undefined,
  orientation: ScreenOrientation,
): boolean {
  const width =
    typeof board?.width === "number" ? board.width : LANDSCAPE_BOARD.width;
  const height =
    typeof board?.height === "number" ? board.height : LANDSCAPE_BOARD.height;
  return orientationOfBoard(width, height) === orientation;
}

/** Aspect ratio as a CSS `aspect-ratio` value. */
export function orientationAspectRatio(orientation: ScreenOrientation): string {
  const { width, height } = boardSizeFor(orientation);
  return `${width} / ${height}`;
}
