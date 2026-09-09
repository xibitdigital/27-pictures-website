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

export const MIN_IMAGE_SCALE = 1;
export const MAX_IMAGE_SCALE = 4;

/** Default snap-to-grid spacing: 24 divisions of the plate, a fine enough grid to align panel gutters without fighting freehand drawing. */
export const DEFAULT_GRID_SIZE = 1 / 24;

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

/**
 * Where the assigned image renders inside its shape's bbox, in bbox-local
 * px — negative x/y and a size larger than the bbox are expected: the image
 * is drawn oversized (like `object-fit: cover`) then panned/clipped.
 * `imageScale` (>=1) zooms in past the minimum "cover" size; `offsetX/Y`
 * (0-1) pan across the resulting overflow, 0.5 = centered.
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
  const scale = coverScale * Math.max(MIN_IMAGE_SCALE, imageScale || 1);
  const width = iw * scale;
  const height = ih * scale;
  const overflowX = Math.max(0, width - bw);
  const overflowY = Math.max(0, height - bh);
  return {
    x: -offsetX * overflowX,
    y: -offsetY * overflowY,
    width,
    height,
  };
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
  const scale = coverScale * Math.max(MIN_IMAGE_SCALE, imageScale || 1);
  const overflowX = Math.max(0, iw * scale - bw);
  const overflowY = Math.max(0, ih * scale - bh);
  const dOffsetX = overflowX > 0 ? -deltaPx.x / overflowX : 0;
  const dOffsetY = overflowY > 0 ? -deltaPx.y / overflowY : 0;
  return {
    offsetX: Math.max(0, Math.min(1, current.offsetX + dOffsetX)),
    offsetY: Math.max(0, Math.min(1, current.offsetY + dOffsetY)),
  };
}
