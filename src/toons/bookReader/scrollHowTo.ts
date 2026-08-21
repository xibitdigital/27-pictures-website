/**
 * One-shot “how to read” toast. Shown as soon as the strip is readable —
 * no cover guide and no sound prompt in the way — and it stays up until the
 * reader actually scrolls, then is remembered so it never comes back.
 */
/**
 * Versioned on purpose. The toast used to be mobile-only, so every reader who
 * had ever opened a strip on a phone carried `"1"` under the old key — and when
 * scroll became the default at every width, those readers were marked as having
 * seen an instruction that had never been shown to them on a desktop. Bumping
 * the key re-arms it once for everyone; it is one toast, dismissed by scrolling.
 */
export const SCROLL_HOWTO_KEY = "flipframe-scroll-howto:v2";
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
  vertical: boolean;
  guideOpen: boolean;
  /** Autoread sound prompt — a modal overlay the toast would render behind. */
  promptOpen: boolean;
}): boolean {
  // Scroll mode is the default at every width now, so the toast is not mobile
  // furniture: a desktop reader dropped into the strip has no arrows and no
  // page edges to click, and nothing else tells them so.
  if (opts.seen || !opts.vertical) return false;
  return !opts.guideOpen && !opts.promptOpen;
}
