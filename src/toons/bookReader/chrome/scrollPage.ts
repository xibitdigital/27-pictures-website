/** Fraction of the viewport to advance on each press of the scroll-down control. */
export const SCROLL_PAGE_FRACTION = 0.9;

/** Remaining pixels below which the control hides — already at the end. */
export const SCROLL_END_PX = 8;

/** Treat a plate as already aligned if its snap Y is this close to the current scroll. */
export const PAGE_ALIGN_EPS_PX = 8;

/** Smaller than this is a leftover nudge — skip it and page-down instead. */
export const PAGE_NUDGE_PX = 80;

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
 * First plate whose top is still below the chrome — the next one, not the
 * current plate sitting a few pixels under the bar (that used to eat a press
 * as a ~40px nudge before the real page-down).
 */
export function nextPageAlignY(pages: PageBox[], scrollY: number, chromeOffset: number): number | null {
  for (const page of pages) {
    const viewportTop = page.getBoundingClientRect().top;
    if (viewportTop <= chromeOffset + PAGE_ALIGN_EPS_PX) continue;
    const align = pageAlignY(viewportTop + scrollY, chromeOffset);
    if (align - scrollY < PAGE_NUDGE_PX) continue;
    return align;
  }
  return null;
}

/**
 * Page-down 90% of the viewport. Only deviate from that jump *forward*, to
 * land exactly on the next plate's top instead of a few leftover pixels
 * short of it (a plate ending just past one screen — Nero mobile: 858 vs
 * 844 — otherwise costs a second, near-zero-progress tap).
 *
 * Must never snap *backward* to an align point behind the 90% jump target.
 * That used to trigger whenever the next plate merely started somewhere
 * ahead of the current scroll, however close — so on a book whose plates
 * are shorter than the viewport, any page-down pressed while mid-plate
 * (not freshly aligned to a plate top) landed on the very next plate's top
 * a few dozen pixels away instead of advancing a full screen.
 */
export function scrollTargetY(scrollY: number, viewH: number, nextAlignY: number | null): number {
  const jumpTo = scrollY + viewH * SCROLL_PAGE_FRACTION;
  if (nextAlignY != null && nextAlignY >= jumpTo && nextAlignY <= scrollY + viewH + PAGE_NUDGE_PX) return nextAlignY;
  return jumpTo;
}

export function scrollBehavior(win: Window = window): ScrollBehavior {
  if (win.matchMedia("(prefers-reduced-motion: reduce)").matches) return "auto";
  return "smooth";
}

/**
 * The `?page=` deep-link retries `scrollTo(0, target)` for a few hundred ms.
 * A page-down tap has to cancel that first, or iOS shows a tiny move then
 * yanks back — the next tap is the one that actually sticks.
 */
export const USER_SCROLL_EVENT = "flipframe-user-scroll";

export function applyWindowScroll(win: Window, top: number, behavior: ScrollBehavior): void {
  if (behavior === "smooth") {
    win.scrollTo({ top, behavior: "smooth" });
    return;
  }
  // Two-arg form: same call the deep-link yank uses, and the one iOS honours
  // from a tap. The `{ behavior: "auto" }` object form is what was getting lost.
  win.scrollTo(0, top);
  const doc = win.document;
  if (doc?.documentElement) doc.documentElement.scrollTop = top;
  if (doc?.body) doc.body.scrollTop = top;
}

function scheduleScrollHold(win: Window, top: number): void {
  const hold = () => applyWindowScroll(win, top, "auto");
  if (typeof win.requestAnimationFrame === "function") win.requestAnimationFrame(hold);
  const vv = win.visualViewport;
  if (vv && typeof vv.addEventListener === "function") {
    vv.addEventListener("resize", hold, { once: true });
  }
  if (typeof win.setTimeout === "function") win.setTimeout(hold, 120);
}

export function scrollPageDown(
  win: Window = window,
  opts?: { pages?: PageBox[]; chromeOffset?: number; doc?: Document }
): void {
  if (typeof win.dispatchEvent === "function") {
    win.dispatchEvent(new Event(USER_SCROLL_EVENT));
  }
  const scrollY = win.scrollY || win.pageYOffset || 0;
  const pages = opts?.pages ?? [];
  const chrome = opts?.chromeOffset ?? chromeOffsetPx(opts?.doc ?? document);
  const top = scrollTargetY(scrollY, viewHeight(win), nextPageAlignY(pages, scrollY, chrome));
  const behavior = scrollBehavior(win);
  applyWindowScroll(win, top, behavior);
  if (behavior === "auto") scheduleScrollHold(win, top);
}
