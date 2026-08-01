/** Declarative slot / flip models for the Vue book surface (no DOM). */

export type SlotModel =
  | { kind: "blank" }
  | { kind: "page"; src: string; pageNum: number }
  | { kind: "front" }
  | { kind: "back" }
  /** Inside cover board with no chrome (empty endpaper). */
  | { kind: "cover" };

export type FlipFaceModel =
  | { kind: "page"; src: string; pageNum: number }
  | { kind: "front" }
  | { kind: "back" }
  | { kind: "cover" }
  | { kind: "empty" };

export interface FlipModel {
  id: number;
  direction: "next" | "prev";
  /** Desktop leaf has front + back faces; single-page only uses front. */
  mode: "desktop" | "single";
  front: FlipFaceModel;
  back?: FlipFaceModel;
}

export function prefersReduceMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function prefersSinglePage(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(max-width: 768px)").matches
  );
}

export function totalSpreadsFor(pageCount: number): number {
  return Math.ceil((pageCount + 1) / 2);
}

export function pageIndexForSpread(spread: number, side: "left" | "right"): number | null {
  if (spread === 0 && side === "left") return null;
  return side === "left" ? 2 * spread - 1 : 2 * spread;
}

export function pageSrcForSpread(pages: string[], spread: number, side: "left" | "right"): string | null {
  const idx = pageIndexForSpread(spread, side);
  if (idx === null || idx >= pages.length) return null;
  return pages[idx] ?? null;
}

export function pageNumForSpread(pages: string[], spread: number, side: "left" | "right"): number | null {
  const idx = pageIndexForSpread(spread, side);
  if (idx === null || idx >= pages.length) return null;
  return idx + 1;
}

export function isFrontCover(spread: number, side: "left" | "right"): boolean {
  return spread === 0 && side === "left";
}

export function isBackCover(pages: string[], totalSpreads: number, spread: number, side: "left" | "right"): boolean {
  return spread === totalSpreads - 1 && !pageSrcForSpread(pages, spread, side);
}

export function slotForSpread(
  pages: string[],
  totalSpreads: number,
  spread: number,
  side: "left" | "right"
): SlotModel {
  const src = pageSrcForSpread(pages, spread, side);
  if (src) {
    const pageNum = pageNumForSpread(pages, spread, side);
    return { kind: "page", src, pageNum: pageNum ?? 1 };
  }
  if (isFrontCover(spread, side)) return { kind: "front" };
  if (isBackCover(pages, totalSpreads, spread, side)) return { kind: "back" };
  // No page art on this half → inside cover board (may be empty endpaper).
  return { kind: "cover" };
}

export function singleViewContent(pages: string[], index: number): SlotModel {
  if (index === 0) return { kind: "front" };
  const pageIndex = index - 1;
  if (pageIndex >= pages.length) return { kind: "back" };
  return { kind: "page", src: pages[pageIndex]!, pageNum: pageIndex + 1 };
}

export function totalSingleViews(pageCount: number): number {
  return pageCount + 2;
}

export function spreadToSingle(pages: string[], totalSpreads: number, spread: number): number {
  const rightNum = pageNumForSpread(pages, spread, "right");
  const leftNum = pageNumForSpread(pages, spread, "left");
  if (rightNum) return rightNum;
  if (leftNum) return leftNum;
  if (spread <= 0) return 0;
  return pages.length + 1;
}

export function singleToSpread(pages: string[], totalSpreads: number, index: number): number {
  if (index <= 0) return 0;
  if (index > pages.length) return Math.max(0, totalSpreads - 1);
  return Math.floor(index / 2);
}

export function indicatorText(pages: string[], viewIndex: number, singlePage: boolean, totalSpreads: number): string {
  const total = pages.length;
  if (singlePage) {
    const content = singleViewContent(pages, viewIndex);
    if (content.kind === "page") return `${content.pageNum} / ${total}`;
    return "";
  }
  const rightNum = pageNumForSpread(pages, viewIndex, "right");
  const leftNum = pageNumForSpread(pages, viewIndex, "left");
  if (leftNum && rightNum) return `${leftNum} – ${rightNum} / ${total}`;
  if (rightNum) return `${rightNum} / ${total}`;
  if (leftNum) return `${leftNum} / ${total}`;
  return `0 / ${total}`;
}

export function slotToFlipFace(slot: SlotModel): FlipFaceModel {
  if (slot.kind === "page") return { kind: "page", src: slot.src, pageNum: slot.pageNum };
  if (slot.kind === "front") return { kind: "front" };
  if (slot.kind === "back") return { kind: "back" };
  if (slot.kind === "cover") return { kind: "cover" };
  return { kind: "empty" };
}

/** Decode image so slot swaps never flash empty. */
export function preloadSrc(src: string | null | undefined): Promise<void> {
  if (!src) return Promise.resolve();
  return new Promise((resolve) => {
    const img = new Image();
    let done = false;
    const fin = () => {
      if (done) return;
      done = true;
      resolve();
    };
    img.onload = fin;
    img.onerror = fin;
    img.src = src;
    if (img.complete) fin();
    // Prefer decode when available — settles layout-ready pixels sooner than load alone.
    else if (typeof img.decode === "function") {
      img.decode().then(fin).catch(fin);
    }
  });
}
