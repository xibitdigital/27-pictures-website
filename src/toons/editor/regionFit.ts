/**
 * Pure geometry/image-fit math for Layout-mode regions. Shared by the live
 * CSS preview (`RegionShape.vue`) and the canvas flatten step
 * (`PageStudio.vue`'s `flattenNow`) so the two never visually diverge.
 *
 * All region geometry is plate-fraction points (0-1 of designWidth/Height) —
 * a rect is stored as 4 corner points too, so both shape types share one
 * bounding-box/clip-path code path.
 */
import type { RegionGeometry, RegionRecord } from "./types";

/**
 * Multiplier on top of the minimum "cover" scale (the size at which the
 * image just fully fills its shape's bbox with no gaps). 1 = cover exactly,
 * >1 = zoom in past cover, <1 = zoom OUT past cover — the image ends up
 * smaller than the box, so it's centered inside it (see coverImageRect)
 * instead of panned, with the shape's own background showing through the gap.
 */
export const MIN_IMAGE_SCALE = 0.25;
export const MAX_IMAGE_SCALE = 4;

/** Default snap-to-grid spacing: 48 divisions of the plate (double the rows/columns of the original 24), for finer panel-gutter alignment without fighting freehand drawing. */
export const DEFAULT_GRID_SIZE = 1 / 48;

/** Snaps a plate-fraction coordinate to the nearest grid line, clamped to [0,1]. */
export function snapToGrid(value: number, gridSize: number = DEFAULT_GRID_SIZE): number {
  if (!gridSize) return value;
  return Math.max(0, Math.min(1, Math.round(value / gridSize) * gridSize));
}

/** Snaps both axes of a plate-fraction point. */
export function snapPointToGrid(point: Point, gridSize: number = DEFAULT_GRID_SIZE): Point {
  return { x: snapToGrid(point.x, gridSize), y: snapToGrid(point.y, gridSize) };
}

export interface Point {
  x: number;
  y: number;
}

export interface FractionBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PxRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A rect's 4 corners, nw→ne→se→sw, so it renders through the same polygon path as a freeform shape. */
export function regionPoints(geometry: RegionGeometry): Point[] {
  if (geometry.kind === "polygon") return geometry.points;
  const { x, y, w, h } = geometry;
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ];
}

/** Bounding box of a shape's points, in plate-fraction space. */
export function regionBoundingBox(geometry: RegionGeometry): FractionBox {
  const points = regionPoints(geometry);
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** A shape's points re-expressed as a percentage of its own bbox — used for both the CSS clip-path and positioning vertex/corner handles over the shape. */
export function percentPoints(geometry: RegionGeometry, bbox: FractionBox = regionBoundingBox(geometry)): Point[] {
  const w = bbox.w || 1;
  const h = bbox.h || 1;
  return regionPoints(geometry).map((p) => ({ x: ((p.x - bbox.x) / w) * 100, y: ((p.y - bbox.y) / h) * 100 }));
}

/** CSS `clip-path: polygon(...)` value, points expressed as % of the shape's own bbox — clip-path clips relative to the element's own border box. */
export function clipPathPolygon(geometry: RegionGeometry, bbox: FractionBox = regionBoundingBox(geometry)): string {
  const pct = percentPoints(geometry, bbox)
    .map((p) => `${p.x.toFixed(2)}% ${p.y.toFixed(2)}%`)
    .join(", ");
  return `polygon(${pct})`;
}

/** Clamps a raw imageScale to [MIN_IMAGE_SCALE, MAX_IMAGE_SCALE], defaulting to 1 (cover, no zoom) for anything falsy. */
function clampImageScale(imageScale: number): number {
  return Math.max(MIN_IMAGE_SCALE, Math.min(MAX_IMAGE_SCALE, imageScale || 1));
}

/**
 * Where the assigned image renders inside its shape's bbox, in bbox-local
 * px. `imageScale` is a multiplier on the minimum "cover" size (1 = cover
 * exactly, no gaps): above 1 the image is drawn oversized and panned via
 * `offsetX/Y` (0-1, 0.5 = centered) across the resulting overflow, same as
 * `object-fit: cover`. Below 1 the image ends up smaller than the box —
 * there's no overflow left to pan, so it's centered instead, and the gap
 * around it shows whatever's behind the shape (the page's own background
 * color, typically).
 */
export function coverImageRect(
  bboxPx: { width: number; height: number },
  imageNatural: { width: number; height: number },
  imageScale: number,
  offsetX: number,
  offsetY: number
): PxRect {
  const bw = bboxPx.width || 1;
  const bh = bboxPx.height || 1;
  const iw = imageNatural.width || 1;
  const ih = imageNatural.height || 1;
  const coverScale = Math.max(bw / iw, bh / ih);
  const scale = coverScale * clampImageScale(imageScale);
  const width = iw * scale;
  const height = ih * scale;
  const overflowX = width - bw;
  const overflowY = height - bh;
  return {
    x: overflowX >= 0 ? -offsetX * overflowX : (bw - width) / 2,
    y: overflowY >= 0 ? -offsetY * overflowY : (bh - height) / 2,
    width,
    height,
  };
}

/**
 * A zoom slider's 0-100 track position, mapped to/from imageScale so that
 * scale 1 (no zoom, exact cover) always sits at position 50 — the visual
 * center of the control — no matter how asymmetric MIN/MAX_IMAGE_SCALE are
 * (0.25-4 is not symmetric around 1 in linear scale terms). Left half of the
 * track linearly covers [MIN_IMAGE_SCALE, 1], right half covers [1, MAX_IMAGE_SCALE].
 */
export function scaleFromSliderPosition(position: number): number {
  const t = Math.max(0, Math.min(100, position)) / 100;
  if (t <= 0.5) return MIN_IMAGE_SCALE + (1 - MIN_IMAGE_SCALE) * (t / 0.5);
  return 1 + (MAX_IMAGE_SCALE - 1) * ((t - 0.5) / 0.5);
}

/** Inverse of scaleFromSliderPosition — where a given imageScale sits on the 0-100 track. */
export function sliderPositionFromScale(scale: number): number {
  const s = clampImageScale(scale);
  if (s <= 1) return ((s - MIN_IMAGE_SCALE) / (1 - MIN_IMAGE_SCALE)) * 50;
  return 50 + ((s - 1) / (MAX_IMAGE_SCALE - 1)) * 50;
}

/** Regions bottom-to-top, matching flatten paint order — same `sort` convention as `bubblesInPlayOrder`. */
export function regionsInStackOrder(regions: RegionRecord[]): RegionRecord[] {
  return regions.slice().sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id));
}

/** Swaps a region with its neighbor one layer forward/backward, renumbering `sort` densely. Null if already at that end. */
export function moveRegionInStack(
  regions: RegionRecord[],
  id: string,
  direction: "forward" | "backward"
): RegionRecord[] | null {
  const ordered = regionsInStackOrder(regions);
  const i = ordered.findIndex((r) => r.id === id);
  const j = direction === "forward" ? i + 1 : i - 1;
  if (i < 0 || j < 0 || j >= ordered.length) return null;
  const next = ordered.slice();
  const swap = next[i];
  next[i] = next[j];
  next[j] = swap;
  return next.map((r, n) => (r.sort === n ? r : { ...r, sort: n }));
}

/** Converts a pointer-drag delta (bbox-local px) into a new offset pair, clamped to [0,1]. Dragging the image right/down should reveal more of its left/top, hence the sign flip. */
export function offsetFromDrag(
  current: { offsetX: number; offsetY: number },
  deltaPx: { x: number; y: number },
  bboxPx: { width: number; height: number },
  imageNatural: { width: number; height: number },
  imageScale: number
): { offsetX: number; offsetY: number } {
  const bw = bboxPx.width || 1;
  const bh = bboxPx.height || 1;
  const iw = imageNatural.width || 1;
  const ih = imageNatural.height || 1;
  const coverScale = Math.max(bw / iw, bh / ih);
  const scale = coverScale * clampImageScale(imageScale);
  const overflowX = Math.max(0, iw * scale - bw);
  const overflowY = Math.max(0, ih * scale - bh);
  const dOffsetX = overflowX > 0 ? -deltaPx.x / overflowX : 0;
  const dOffsetY = overflowY > 0 ? -deltaPx.y / overflowY : 0;
  return {
    offsetX: Math.max(0, Math.min(1, current.offsetX + dOffsetX)),
    offsetY: Math.max(0, Math.min(1, current.offsetY + dOffsetY)),
  };
}
