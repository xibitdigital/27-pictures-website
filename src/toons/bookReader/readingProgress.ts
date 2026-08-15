/**
 * Where a reader got to, per toon.
 *
 * Stored locally and nowhere else: no account, no sync, no request. It exists
 * so `/toons/` can offer "continue reading" instead of making someone
 * remember which page they were on — the same job Apple TV's Continue
 * Watching row does.
 *
 * Covers are not progress: a book only enters the list once a content page has
 * been seen, and leaves it again when the last page is reached, so a finished
 * book does not sit in the row forever.
 */
export const PROGRESS_STORAGE_PREFIX = "toon-progress:";

export interface ReadingProgress {
  /** 1-based page number, matching ?page= deep links. */
  page: number;
  pages: number;
  /** Epoch ms of the last update — the row is ordered by it. */
  at: number;
}

function storageKey(toonId: string): string {
  return `${PROGRESS_STORAGE_PREFIX}${toonId}`;
}

function isProgress(value: unknown): value is ReadingProgress {
  if (!value || typeof value !== "object") return false;
  const p = value as Partial<ReadingProgress>;
  return (
    typeof p.page === "number" &&
    typeof p.pages === "number" &&
    typeof p.at === "number" &&
    p.page > 0 &&
    p.pages > 0 &&
    p.page <= p.pages
  );
}

/** Storage can throw in private mode and embedded webviews — never let it break a page. */
export function readProgress(toonId: string): ReadingProgress | null {
  try {
    const raw = window.localStorage.getItem(storageKey(toonId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isProgress(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function clearProgress(toonId: string): void {
  try {
    window.localStorage.removeItem(storageKey(toonId));
  } catch {
    /* ignore */
  }
}

/**
 * Records a position. Page 1 of a book someone just opened is not progress
 * worth resuming, and the last page means they finished — both drop the entry.
 */
export function writeProgress(toonId: string, page: number, pages: number, now = Date.now()): void {
  if (!toonId || !Number.isFinite(page) || !Number.isFinite(pages) || pages <= 0) return;
  if (page <= 1 || page >= pages) {
    clearProgress(toonId);
    return;
  }
  try {
    const value: ReadingProgress = { page: Math.round(page), pages: Math.round(pages), at: now };
    window.localStorage.setItem(storageKey(toonId), JSON.stringify(value));
  } catch {
    /* ignore */
  }
}
