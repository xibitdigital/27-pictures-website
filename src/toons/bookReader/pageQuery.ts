/**
 * Deep-link helpers for FlipFrame testing / share URLs.
 *
 *   /toons/jax/?page=3  → open on content page 3 (1-based)
 */

/** Parse `?page=N` from a search string. Returns 1-based page or null. */
export function parsePageQuery(search?: string): number | null {
  const raw = search ?? (typeof window !== "undefined" && window.location ? window.location.search : "");
  if (!raw) return null;
  const q = new URLSearchParams(raw.startsWith("?") ? raw : `?${raw}`);
  const v = q.get("page");
  if (v == null || v === "") return null;
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.floor(n);
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
