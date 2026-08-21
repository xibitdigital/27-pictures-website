/**
 * Deep-link helpers for FlipFrame testing / share URLs.
 *
 *   /toons/jax/?page=3  → open on content page 3 (1-based)
 *
 * Reads happen once at init; `writePageQuery` keeps the address bar tracking
 * the reader so the URL is copy-pasteable from anywhere in the book.
 */

function readInitialPage(): number | null {
  if (typeof window === "undefined" || !window.location) return null;
  return parseSearch(window.location.search);
}

/**
 * The page this document was loaded with, captured at import — before any
 * reader exists, so nothing can have rewritten the URL yet. Capturing this
 * lazily was not enough: the engine's first `syncChrome` writes the param
 * before init ever reads it, so a lazy read would memoise the clobbered value.
 */
let initialPage: number | null = readInitialPage();

/**
 * Parse `?page=N` from a search string. Returns 1-based page or null.
 *
 * With no argument this reports the page the document was **loaded** with, and
 * keeps reporting it for the life of the page — the value is memoised on first
 * read. That matters because `writePageQuery` mutates the same param as the
 * reader moves: the flip engine reaches the cover, drops `?page=`, and a later
 * consumer (the vertical strip resolves its deep-link only once slots exist)
 * would otherwise find the param already gone and open on page 1.
 *
 * Pass an explicit search string to parse it directly, uncached.
 */
export function parsePageQuery(search?: string): number | null {
  if (search === undefined) return initialPage;
  return parseSearch(search);
}

function parseSearch(raw: string): number | null {
  if (!raw) return null;
  const q = new URLSearchParams(raw.startsWith("?") ? raw : `?${raw}`);
  const v = q.get("page");
  if (v == null || v === "") return null;
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.floor(n);
}

/**
 * Re-capture the load-time page from the current URL. Only for tests — a real
 * page load gets a fresh module instance, but a shared jsdom window does not.
 */
export function resetPageQueryCache(): void {
  initialPage = readInitialPage();
}

/**
 * Mirror the current 1-based content page into `?page=N`.
 *
 * Uses `replaceState`, never `pushState`: a book turns pages constantly, and
 * pushing would bury whatever the visitor was on before under dozens of
 * entries, so Back would walk the book backwards instead of leaving it.
 *
 * Pass `null` for the covers — the param is dropped rather than clamped to 1,
 * so a shared cover URL opens on the cover.
 *
 * @returns the value written, or null if the param was removed / left alone
 */
export function writePageQuery(pageNum: number | null): string | null {
  if (typeof window === "undefined") return null;
  const h = window.history;
  if (!h || typeof h.replaceState !== "function") return null;

  const url = new URL(window.location.href);
  const current = url.searchParams.get("page");
  const next = pageNum != null && Number.isFinite(pageNum) && pageNum >= 1 ? String(Math.floor(pageNum)) : null;
  // Every flip calls this; skip the no-op writes.
  if (current === next) return next;

  if (next == null) url.searchParams.delete("page");
  else url.searchParams.set("page", next);
  // Rebuild by hand so other params and the hash survive untouched.
  h.replaceState(h.state, "", `${url.pathname}${url.search}${url.hash}`);
  return next;
}

/** One strip slot's vertical extent in viewport coordinates. */
export interface SlotBox {
  pageNum: number;
  top: number;
  bottom: number;
}

/**
 * Which page a vertical strip is showing: the slot that owns `mid` (the middle
 * of the viewport). Plates are taller than a laptop viewport, so "the slot at
 * the top" is wrong as soon as one page fills the screen — and between two
 * plates, in the gutter, the answer has to be the one above rather than none.
 *
 * Scroll mode has no engine view index, so this is the only source for
 * `?page=`; the book engine mirrors its spread instead.
 */
export function visiblePageNum(slots: SlotBox[], mid: number): number | null {
  let current: number | null = null;
  for (const s of slots) {
    if (!Number.isFinite(s.pageNum)) continue;
    if (s.top <= mid && s.bottom >= mid) return s.pageNum;
    if (s.top > mid) break;
    current = s.pageNum;
  }
  return current;
}

/**
 * Plate reflow nudges the strip by a few px as lazy images decode; a swipe
 * moves it by far more. Above this, the reader moved the page, not the reader
 * code — measured on an iPhone simulator, where repeated deep-link re-applies
 * yanked the strip back to `?page=` mid-swipe and read as "it will not scroll".
 */
export const DEEP_LINK_RELEASE_PX = 48;

/** True once the position has left the deep-link target for good. */
export function deepLinkReleased(appliedY: number | null, currentY: number, releasePx = DEEP_LINK_RELEASE_PX): boolean {
  if (appliedY == null) return false;
  return Math.abs(currentY - appliedY) >= releasePx;
}

/**
 * Map a 1-based content page number to the engine viewIndex.
 * - Single-page mode: cover=0, page1=1, … pageN=N, back=N+1
 * - Spread mode: use the same single-index → spread mapping as layout switches
 */
export function contentPageToViewIndex(
  pageNum: number,
  pageCount: number,
  singlePage: boolean,
  totalSpreads: number
): number {
  if (pageCount < 1) return 0;
  const n = Math.max(1, Math.min(Math.floor(pageNum), pageCount));
  if (singlePage) return n;
  // same as singleToSpread(pages, totalSpreads, n) with content index n
  if (n <= 0) return 0;
  if (n > pageCount) return Math.max(0, totalSpreads - 1);
  return Math.floor(n / 2);
}
