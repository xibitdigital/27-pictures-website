/**
 * One-shot mobile “how to read” toast. Shown as soon as the strip is readable —
 * no cover guide and no sound prompt in the way — and it stays up until the
 * reader actually scrolls, then is remembered so it never comes back.
 */
export const SCROLL_HOWTO_KEY = "flipframe-scroll-howto";
/** Movement that counts as "they got it" — momentum jitter must not clear it. */
export const SCROLL_HOWTO_DISMISS_PX = 24;

export function hasSeenScrollHowTo(): boolean {
  try {
    return localStorage.getItem(SCROLL_HOWTO_KEY) === "1";
  } catch {
    return false;
  }
}

export function markScrollHowToSeen(): void {
  try {
    localStorage.setItem(SCROLL_HOWTO_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function shouldShowScrollHowTo(opts: {
  seen: boolean;
  mobile: boolean;
  vertical: boolean;
  guideOpen: boolean;
  /** Autoread sound prompt — a modal overlay the toast would render behind. */
  promptOpen: boolean;
}): boolean {
  if (opts.seen || !opts.mobile || !opts.vertical) return false;
  return !opts.guideOpen && !opts.promptOpen;
}
