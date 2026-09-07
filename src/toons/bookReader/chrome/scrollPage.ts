/** Fraction of the viewport to advance on each press of the scroll-down control. */
export const SCROLL_PAGE_FRACTION = 0.8;

/** Remaining pixels below which the control hides — already at the end. */
export const SCROLL_END_PX = 8;

/** Treat a plate as already aligned if its snap Y is this close to the current scroll. */
export const PAGE_ALIGN_EPS_PX = 8;

/** Fallback clearance when no `[data-reader-chrome]` is on screen (progress hairline). */
export const DEFAULT_CHROME_OFFSET_PX = 4;

/** Air between the chrome bottom and the plate top. */
export const CHROME_GAP_PX = 4;

export type PageBox = { getBoundingClientRect: () => { top: number } };

export function remainingScroll(scrollY: number, viewHeight: number, scrollHeight: number): number {
  return Math.max(0, scrollHeight - viewHeight - scrollY);
}

export function canScrollPageDown(scrollY: number, viewHeight: number, scrollHeight: number): boolean {
  return remainingScroll(scrollY, viewHeight, scrollHeight) > SCROLL_END_PX;
}

export function viewHeight(win: Window = window): number {
  return win.visualViewport?.height || win.innerHeight;
}

export function docScrollHeight(doc: Document = document): number {
  const el = doc.documentElement;
  const body = doc.body;
  return Math.max(el.scrollHeight, body?.scrollHeight ?? 0);
}

/**
 * Viewport Y of the bottom of the top chrome (logo + controls), plus a small
 * gap, so a snapped plate sits just under the bar instead of under it.
 */
export function chromeOffsetPx(doc: Document = document): number {
  let offset = DEFAULT_CHROME_OFFSET_PX;
  for (const el of doc.querySelectorAll("[data-reader-chrome]")) {
    const r = el.getBoundingClientRect();
    if (r.height <= 0 || r.top > 80) continue;
    offset = Math.max(offset, r.bottom);
  }
  return offset + CHROME_GAP_PX;
}

/** Document Y that puts this plate's top just under the top chrome. */
export function pageAlignY(pageTop: number, chromeOffset: number): number {
  return Math.max(0, pageTop - chromeOffset);
}

/**
 * First plate below the current scroll that is not already aligned under the
 * chrome. `pages` is document order (strip slots).
 */
export function nextPageAlignY(pages: PageBox[], scrollY: number, chromeOffset: number): number | null {
  for (const page of pages) {
    const top = page.getBoundingClientRect().top + scrollY;
    const align = pageAlignY(top, chromeOffset);
    if (align > scrollY + PAGE_ALIGN_EPS_PX) return align;
  }
  return null;
}

/** Snap to the next plate when this jump would reach or pass it; otherwise page-down. */
export function scrollTargetY(scrollY: number, viewH: number, nextAlignY: number | null): number {
  const jumpTo = scrollY + viewH * SCROLL_PAGE_FRACTION;
  if (nextAlignY != null && nextAlignY <= jumpTo) return nextAlignY;
  return jumpTo;
}

export function scrollPageDown(
  win: Window = window,
  opts?: { pages?: PageBox[]; chromeOffset?: number; doc?: Document }
): void {
  const reduce = win.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const scrollY = win.scrollY || win.pageYOffset || 0;
  const pages = opts?.pages ?? [];
  const chrome = opts?.chromeOffset ?? chromeOffsetPx(opts?.doc ?? document);
  const top = scrollTargetY(scrollY, viewHeight(win), nextPageAlignY(pages, scrollY, chrome));
  win.scrollTo({ top, behavior: reduce ? "auto" : "smooth" });
}
