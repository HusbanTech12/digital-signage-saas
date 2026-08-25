/**
 * Orientation reflow for designer boards.
 *
 * A board is read as a stack of full-width bands (headers, dividers, footers)
 * interleaved with groups of columns (menu sections). Landscape lays the
 * columns of a group out side by side; portrait stacks them vertically. Either
 * way the content is scaled to fill the whole board, so a layout survives the
 * switch instead of being squashed into the new aspect ratio.
 */

import type { Canvas, FabricObject } from "fabric";
import { boardSizeFor, type BoardSize } from "@/lib/display/orientation";
import type { ScreenOrientation } from "@/lib/types/schema";

/** Objects at least this wide (fraction of board) are treated as full-width bands. */
const BAND_WIDTH_RATIO = 0.7;
/** Horizontal overlap (fraction of the narrower box) that merges two columns. */
const COLUMN_MERGE_OVERLAP = 0.35;

type Box = { left: number; top: number; width: number; height: number };

type Entry = { object: FabricObject; box: Box };

type Column = { left: number; right: number; entries: Entry[] };

function boxOf(object: FabricObject): Box {
  const rect = object.getBoundingRect();
  return {
    left: rect.left,
    top: rect.top,
    width: Math.max(rect.width, 1),
    height: Math.max(rect.height, 1),
  };
}

/**
 * Move and scale an object so its bounding box lands on `target`.
 * Works for text, shapes, images and groups because it adjusts scale factors
 * rather than intrinsic width/height.
 */
function placeObject(object: FabricObject, from: Box, target: Box): void {
  const scaleX = target.width / from.width;
  const scaleY = target.height / from.height;

  object.set({
    scaleX: (object.scaleX ?? 1) * scaleX,
    scaleY: (object.scaleY ?? 1) * scaleY,
  });

  // Re-measure: scaling moves the bounding box when the origin isn't top-left.
  const scaled = boxOf(object);
  object.set({
    left: (object.left ?? 0) + (target.left - scaled.left),
    top: (object.top ?? 0) + (target.top - scaled.top),
  });
  object.setCoords();
}

/** Text scales by a single factor so glyphs stay proportional. */
function placeTextObject(
  object: FabricObject,
  from: Box,
  target: Box,
  factor: number,
): void {
  if ("fontSize" in object && typeof object.fontSize === "number") {
    object.set({ fontSize: Math.max(6, object.fontSize * factor) });
  }
  if ("width" in object && typeof object.width === "number") {
    object.set({ width: Math.max(20, target.width / (object.scaleX ?? 1)) });
  }
  const measured = boxOf(object);
  object.set({
    left: (object.left ?? 0) + (target.left - measured.left),
    top: (object.top ?? 0) + (target.top - measured.top),
  });
  object.setCoords();
}

function isTextObject(object: FabricObject): boolean {
  return "fontSize" in object && typeof object.fontSize === "number";
}

/** Group entries whose horizontal spans overlap into shared columns. */
function buildColumns(entries: Entry[]): Column[] {
  const sorted = [...entries].sort((a, b) => a.box.left - b.box.left);
  const columns: Column[] = [];

  for (const entry of sorted) {
    const left = entry.box.left;
    const right = entry.box.left + entry.box.width;
    const match = columns.find((column) => {
      const overlap =
        Math.min(column.right, right) - Math.max(column.left, left);
      if (overlap <= 0) return false;
      const narrower = Math.min(column.right - column.left, right - left);
      return overlap / narrower >= COLUMN_MERGE_OVERLAP;
    });

    if (match) {
      match.left = Math.min(match.left, left);
      match.right = Math.max(match.right, right);
      match.entries.push(entry);
    } else {
      columns.push({ left, right, entries: [entry] });
    }
  }

  for (const column of columns) {
    column.entries.sort((a, b) => a.box.top - b.box.top);
  }
  return columns;
}

/**
 * Lay a column's entries into `slot`, preserving their relative vertical
 * rhythm. Returns nothing; objects are mutated in place.
 */
function layoutColumn(column: Column, slot: Box): void {
  const spanTop = Math.min(...column.entries.map((e) => e.box.top));
  const spanBottom = Math.max(
    ...column.entries.map((e) => e.box.top + e.box.height),
  );
  const spanHeight = Math.max(spanBottom - spanTop, 1);
  const spanWidth = Math.max(column.right - column.left, 1);

  const widthFactor = slot.width / spanWidth;
  const heightFactor = slot.height / spanHeight;
  // Uniform factor keeps text legible; the looser axis just gets more air.
  const textFactor = Math.min(widthFactor, heightFactor);

  for (const entry of column.entries) {
    const relLeft = (entry.box.left - column.left) / spanWidth;
    const relWidth = entry.box.width / spanWidth;
    const relTop = (entry.box.top - spanTop) / spanHeight;
    const relHeight = entry.box.height / spanHeight;

    const target: Box = {
      left: slot.left + relLeft * slot.width,
      top: slot.top + relTop * slot.height,
      width: relWidth * slot.width,
      height: relHeight * slot.height,
    };

    if (isTextObject(entry.object)) {
      placeTextObject(entry.object, entry.box, target, textFactor);
    } else {
      placeObject(entry.object, entry.box, target);
    }
  }
}

/**
 * Reflow every object on the canvas for `orientation` and resize the board.
 * Safe to call when the board already matches — it still normalises the fit.
 */
export function reflowCanvasForOrientation(
  canvas: Canvas,
  orientation: ScreenOrientation,
): void {
  const objects = canvas.getObjects();
  const target: BoardSize = boardSizeFor(orientation);

  const fromWidth = Math.max(canvas.getWidth(), 1);
  const fromHeight = Math.max(canvas.getHeight(), 1);

  canvas.discardActiveObject();

  if (objects.length === 0) {
    canvas.setDimensions(target);
    canvas.requestRenderAll();
    return;
  }

  const entries: Entry[] = objects.map((object) => ({
    object,
    box: boxOf(object),
  }));

  const bands = entries.filter(
    (entry) => entry.box.width >= fromWidth * BAND_WIDTH_RATIO,
  );
  const columnEntries = entries.filter((entry) => !bands.includes(entry));
  const columns = buildColumns(columnEntries);

  // Vertical budget: bands keep their share of the board, columns take the rest.
  const bandHeight = bands.reduce((total, entry) => total + entry.box.height, 0);
  const bandShare = Math.min(0.45, bandHeight / fromHeight);
  const gutter = target.width * 0.03;
  const margin = target.width * 0.04;

  const contentLeft = margin;
  const contentWidth = target.width - margin * 2;
  const contentTop = margin;
  const contentHeight = target.height - margin * 2;

  const bandsBlockHeight = columns.length
    ? contentHeight * bandShare
    : contentHeight;
  const columnsBlockHeight = contentHeight - bandsBlockHeight;

  // Bands: full content width, stacked in their original vertical order.
  const orderedBands = [...bands].sort((a, b) => a.box.top - b.box.top);
  const bandTotal = orderedBands.reduce(
    (total, entry) => total + entry.box.height,
    0,
  );
  let bandCursor = contentTop;
  for (const entry of orderedBands) {
    const share = bandTotal > 0 ? entry.box.height / bandTotal : 1;
    const slotHeight = bandsBlockHeight * share;
    const slot: Box = {
      left: contentLeft,
      top: bandCursor,
      width: contentWidth,
      height: slotHeight,
    };
    const factor = Math.min(
      contentWidth / Math.max(entry.box.width, 1),
      slotHeight / Math.max(entry.box.height, 1),
    );
    if (isTextObject(entry.object)) {
      placeTextObject(entry.object, entry.box, slot, factor);
    } else {
      placeObject(entry.object, entry.box, slot);
    }
    bandCursor += slotHeight;
  }

  if (columns.length === 0) {
    canvas.setDimensions(target);
    canvas.requestRenderAll();
    return;
  }

  const columnsTop = contentTop + bandsBlockHeight;

  if (orientation === "portrait") {
    // Stack columns vertically, full width, in original left-to-right order.
    const totalGutter = gutter * (columns.length - 1);
    const slotHeight = (columnsBlockHeight - totalGutter) / columns.length;
    columns.forEach((column, index) => {
      layoutColumn(column, {
        left: contentLeft,
        top: columnsTop + index * (slotHeight + gutter),
        width: contentWidth,
        height: slotHeight,
      });
    });
  } else {
    // Side by side, sharing the content width.
    const totalGutter = gutter * (columns.length - 1);
    const slotWidth = (contentWidth - totalGutter) / columns.length;
    columns.forEach((column, index) => {
      layoutColumn(column, {
        left: contentLeft + index * (slotWidth + gutter),
        top: columnsTop,
        width: slotWidth,
        height: columnsBlockHeight,
      });
    });
  }

  canvas.setDimensions(target);
  canvas.requestRenderAll();
}
