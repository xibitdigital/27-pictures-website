/** Fraction of the viewport to advance on each press of the scroll-down control. */
export const SCROLL_PAGE_FRACTION = 0.8;

/** Remaining pixels below which the control hides — already at the end. */
export const SCROLL_END_PX = 8;

export function remainingScroll(scrollY: number, viewHeight: number, scrollHeight: number): number {
  return Math.max(0, scrollHeight - viewHeight - scrollY);
}

export function canScrollPageDown(scrollY: number, viewHeight: number, scrollHeight: number): boolean {
  return remainingScroll(scrollY, viewHeight, scrollHeight) > SCROLL_END_PX;
}

export function scrollPageDown(win: Window = window): void {
  const reduce = win.matchMedia("(prefers-reduced-motion: reduce)").matches;
  win.scrollBy({
    top: win.innerHeight * SCROLL_PAGE_FRACTION,
    behavior: reduce ? "auto" : "smooth",
  });
}
