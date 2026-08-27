/** Plate-normalised 0–1 coordinates from pointer events on the content box. */

export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export interface ContentBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function clientToPlateFraction(
  clientX: number,
  clientY: number,
  box: ContentBox,
  offsetX = 0,
  offsetY = 0
): { x: number; y: number } {
  const w = box.width || 1;
  const h = box.height || 1;
  return {
    x: clamp01((clientX - box.left) / w - offsetX),
    y: clamp01((clientY - box.top) / h - offsetY),
  };
}

/** Pointer position minus the bubble centre, in plate fractions — keeps the grab from jumping. */
export function grabOffset(
  clientX: number,
  clientY: number,
  box: ContentBox,
  x: number,
  y: number
): { offsetX: number; offsetY: number } {
  const w = box.width || 1;
  const h = box.height || 1;
  return {
    offsetX: (clientX - box.left) / w - x,
    offsetY: (clientY - box.top) / h - y,
  };
}
