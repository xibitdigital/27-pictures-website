/**
 * Pure viewport visibility for auto-read.
 *
 * Auto-read selects by **caption anchor position**, never by “is this page
 * aligned / fully on screen”. Vertical / scroll mode passes bandEnd = 0.9 so
 * only balloons in the top 90% of the viewport speak; book mode passes 1 so
 * every on-screen balloon on a spread can speak. Controller owns “who speaks”;
 * layers only supply getRect().
 */

/**
 * Fraction of a plate that must sit in the viewport to count as on screen
 * (legacy page-level helper; focus-band clip selection is preferred for auto-read).
 * Tall portrait plates often exceed the mobile viewport height, so 0.55 was
 * unreachable until a scroll re-fired layout.
 */
export const VISIBLE_RATIO = 0.2;

/**
 * Focus band end as a fraction of viewport height (0 → bandEnd).
 * Top 90% of the screen: bubbles below this line wait until scroll brings them
 * up. Book mode uses 1 (full viewport) instead.
 *
 * Was 0.8 while scroll was mobile-only. Scroll is now the default at every
 * width, and on a desktop viewport a 20% dead strip is tall enough to hold a
 * whole caption — a balloon could sit fully on screen and stay silent.
 */
export const FOCUS_BAND_END = 0.9;

export interface VisibilityInput {
  id: string;
  getRect: () => DOMRect | null;
}

export interface FocusCaptionRef {
  index: number;
  audio: string;
  volume: number;
  x: number;
  y: number;
}

export interface FocusLayerInput {
  id: string;
  getRect: () => DOMRect | null;
  captions: FocusCaptionRef[];
  released?: boolean;
}

export interface FocusClip {
  key: string;
  layerId: string;
  caption: FocusCaptionRef;
  screenX: number;
  screenY: number;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/** Whether a rect should count as on-screen for auto-read (page-level). */
export function isRectOnScreen(r: DOMRect, viewportHeight: number, ratio = VISIBLE_RATIO): boolean {
  if (r.width < 2 || r.height < 2) return false;
  if (viewportHeight < 1) return true;
  const visibleH = Math.min(r.bottom, viewportHeight) - Math.max(r.top, 0);
  if (visibleH <= 0) return false;
  return visibleH / r.height >= ratio || visibleH >= Math.min(120, viewportHeight * 0.35);
}

/** Screen Y of a caption anchor (0–1 plate coords → CSS pixels). */
export function captionScreenPoint(plate: DOMRect, x: number, y: number): { x: number; y: number } {
  return {
    x: plate.left + clamp01(x) * plate.width,
    y: plate.top + clamp01(y) * plate.height,
  };
}

/** True when screenY sits in the focus band [0, viewportHeight * bandEnd). */
export function isInFocusBand(screenY: number, viewportHeight: number, bandEnd = FOCUS_BAND_END): boolean {
  if (viewportHeight < 1) return true;
  const end = Math.max(1, viewportHeight * bandEnd);
  return screenY >= 0 && screenY < end;
}

/**
 * Captions whose anchors fall in the focus band — **caption geometry only**.
 * Plate height / page alignment are ignored; a partially scrolled plate still
 * yields whatever balloons sit in [0, viewportHeight * bandEnd).
 *
 * Order: plates top→bottom then left→right (spread: left page before right),
 * then **config array order** within a plate (`caption.index` / words[] order).
 * Dedupes layer ids.
 */
export function collectFocusClips(
  layers: Iterable<FocusLayerInput>,
  viewportHeight: number,
  bandEnd = FOCUS_BAND_END
): FocusClip[] {
  type LayerClips = {
    layerId: string;
    plateTop: number;
    plateLeft: number;
    clips: FocusClip[];
  };
  const byLayer: LayerClips[] = [];
  const seenLayer = new Set<string>();
  // Clamp so callers cannot pass 0 or NaN and silence everything.
  const band = Number.isFinite(bandEnd) ? Math.max(0.15, Math.min(1, bandEnd)) : FOCUS_BAND_END;

  for (const layer of layers) {
    if (layer.released) continue;
    if (!layer.captions.length) continue;
    // Prefer first registration per id (flip leaf + slot).
    if (seenLayer.has(layer.id)) continue;
    const plate = layer.getRect();
    if (!plate || plate.width < 2 || plate.height < 2) continue;
    seenLayer.add(layer.id);

    const layerClips: FocusClip[] = [];
    // Config `words[]` order (stable by index) — not geometric comic sort.
    const ordered = layer.captions.slice().sort((a, b) => a.index - b.index);
    for (const caption of ordered) {
      if (!caption.audio) continue;
      const pt = captionScreenPoint(plate, caption.x, caption.y);
      if (!isInFocusBand(pt.y, viewportHeight, band)) continue;
      layerClips.push({
        key: `${layer.id}:${caption.index}`,
        layerId: layer.id,
        caption,
        screenX: pt.x,
        screenY: pt.y,
      });
    }
    if (layerClips.length) {
      byLayer.push({
        layerId: layer.id,
        plateTop: plate.top,
        plateLeft: plate.left,
        clips: layerClips,
      });
    }
  }

  byLayer.sort((a, b) => {
    if (Math.abs(a.plateTop - b.plateTop) > 40) return a.plateTop - b.plateTop;
    return a.plateLeft - b.plateLeft;
  });

  return byLayer.flatMap((l) => l.clips);
}

/** Layer id part of a caption key (`layerId:index`). */
export function keyLayerId(key: string): string {
  const cut = key.lastIndexOf(":");
  return cut > 0 ? key.slice(0, cut) : key;
}

/**
 * Already-played caption keys that are no longer on screen — safe to forget so
 * scrolling back re-reads them, while a caption still in view never repeats.
 *
 * Unmeasured plates (rect null mid-reflow) are kept: forgetting them would
 * replay the same clip on every layout tick.
 */
export function keysOutOfView(
  layers: Iterable<FocusLayerInput>,
  viewportHeight: number,
  played: Iterable<string>
): string[] {
  const screenY = new Map<string, number>();
  const liveIds = new Set<string>();

  for (const layer of layers) {
    if (layer.released) continue;
    liveIds.add(layer.id);
    const plate = layer.getRect();
    if (!plate || plate.width < 2 || plate.height < 2) continue;
    for (const caption of layer.captions) {
      const key = `${layer.id}:${caption.index}`;
      if (screenY.has(key)) continue; // first registration wins (flip leaf + slot)
      screenY.set(key, captionScreenPoint(plate, caption.x, caption.y).y);
    }
  }

  const stale: string[] = [];
  for (const key of played) {
    if (!liveIds.has(keyLayerId(key))) {
      stale.push(key);
      continue;
    }
    const y = screenY.get(key);
    if (y == null) continue;
    if (viewportHeight < 1) continue;
    if (y < 0 || y > viewportHeight) stale.push(key);
  }
  return stale;
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
