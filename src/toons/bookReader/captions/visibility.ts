/**
 * Pure viewport visibility for auto-read layers.
 * Controller is the only owner of “who is on screen”; layers only supply getRect().
 */

/**
 * Fraction of a plate that must sit in the viewport to count as on screen.
 * Tall portrait plates often exceed the mobile viewport height, so 0.55 was
 * unreachable until a scroll re-fired layout.
 */
export const VISIBLE_RATIO = 0.2;

export interface VisibilityInput {
  id: string;
  getRect: () => DOMRect | null;
}

/** Whether a rect should count as on-screen for auto-read. */
export function isRectOnScreen(r: DOMRect, viewportHeight: number, ratio = VISIBLE_RATIO): boolean {
  if (r.width < 2 || r.height < 2) return false;
  if (viewportHeight < 1) return true;
  const visibleH = Math.min(r.bottom, viewportHeight) - Math.max(r.top, 0);
  if (visibleH <= 0) return false;
  return visibleH / r.height >= ratio || visibleH >= Math.min(120, viewportHeight * 0.35);
}

/**
 * Ordered layers currently on screen (top→bottom, then left→right).
 * Dedupes by id (flip leaf + slot), keeps the first registration.
 */
export function orderedOnScreenLayers<T extends VisibilityInput>(
  layers: Iterable<T>,
  viewportHeight: number,
  isEligible: (layer: T) => boolean = () => true
): T[] {
  const candidates: { layer: T; top: number; left: number }[] = [];
  for (const layer of layers) {
    if (!isEligible(layer)) continue;
    const r = layer.getRect();
    if (!r || !isRectOnScreen(r, viewportHeight)) continue;
    candidates.push({ layer, top: r.top, left: r.left });
  }
  const byId = new Map<string, { layer: T; top: number; left: number }>();
  for (const c of candidates) {
    if (!byId.has(c.layer.id)) byId.set(c.layer.id, c);
  }
  return Array.from(byId.values())
    .sort((a, b) => {
      if (Math.abs(a.top - b.top) > 40) return a.top - b.top;
      return a.left - b.left;
    })
    .map((c) => c.layer);
}

export function orderedOnScreenIds(
  layers: Iterable<VisibilityInput & { eligible?: boolean }>,
  viewportHeight: number
): string[] {
  return orderedOnScreenLayers(layers, viewportHeight, (l) => l.eligible !== false).map((l) => l.id);
}
