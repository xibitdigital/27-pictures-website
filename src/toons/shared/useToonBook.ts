/**
 * Vue composable: wire template refs into the imperative FlipFrame engine.
 *
 * Usage in a component:
 *   const bookEl = ref<HTMLElement | null>(null);
 *   const slotLeft = ref<HTMLElement | null>(null);
 *   // …
 *   useToonBook(
 *     { book: bookEl, slotLeft, slotRight, indicator, btnPrev, btnNext, … },
 *     { altPrefix: "Jax", onPagePaint, … }
 *   );
 */
import { onMounted, onBeforeUnmount, unref, type MaybeRef } from "vue";
import { initToonBook } from "./book-reader";
import type { ToonBookApi, ToonBookEls, ToonBookOptions } from "./types";

export type ToonBookRefMap = {
  [K in keyof ToonBookEls]: MaybeRef<ToonBookEls[K] | null | undefined>;
};

function resolveEls(refs: ToonBookRefMap): ToonBookEls | null {
  const book = unref(refs.book);
  const slotLeft = unref(refs.slotLeft);
  const slotRight = unref(refs.slotRight);
  const indicator = unref(refs.indicator);
  const btnPrev = unref(refs.btnPrev);
  const btnNext = unref(refs.btnNext);

  if (!book || !slotLeft || !slotRight || !indicator || !btnPrev || !btnNext) {
    return null;
  }

  return {
    book,
    slotLeft,
    slotRight,
    indicator,
    btnPrev,
    btnNext,
    zoneNext: unref(refs.zoneNext) ?? null,
    zonePrev: unref(refs.zonePrev) ?? null,
    topControls: unref(refs.topControls) ?? null,
  };
}

/**
 * Mount the book reader after the component DOM is ready; tear down on unmount.
 * Returns a getter for the live API (available after onMounted).
 */
export function useToonBook(
  refs: ToonBookRefMap,
  opts: ToonBookOptions = {}
): { getApi: () => ToonBookApi | undefined } {
  let api: ToonBookApi | undefined;

  onMounted(() => {
    const els = resolveEls(refs);
    if (!els) {
      console.error("useToonBook: missing required template refs", {
        book: !!unref(refs.book),
        slotLeft: !!unref(refs.slotLeft),
        slotRight: !!unref(refs.slotRight),
        indicator: !!unref(refs.indicator),
        btnPrev: !!unref(refs.btnPrev),
        btnNext: !!unref(refs.btnNext),
      });
      return;
    }
    api = initToonBook(els, opts);
  });

  onBeforeUnmount(() => {
    api?.destroy();
    api = undefined;
  });

  return {
    getApi: () => api,
  };
}
