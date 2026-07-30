/**
 * FlipFrame engine — pure reactive state (no DOM).
 * Vue components in BookSurface / BookSlot / FlipLeaf own all markup.
 */
import { reactive } from "vue";
import { loadConfigPages } from "./loadConfig";
import {
  indicatorText,
  pageSrcForSpread,
  prefersReduceMotion,
  prefersSinglePage,
  preloadSrc,
  singleToSpread,
  singleViewContent,
  slotForSpread,
  slotToFlipFace,
  spreadToSingle,
  totalSingleViews,
  totalSpreadsFor,
  type FlipModel,
  type SlotModel,
} from "./bookModels";
import type { ToonBookApi, ToonBookOptions } from "./types";

const FLIP_MS = 700;
const FLIP_SAFETY_MS = FLIP_MS + 200;
const SINGLE_FLIP_MS = 350;

export interface BookEngineState {
  pages: string[];
  viewIndex: number;
  singlePage: boolean;
  leftSlot: SlotModel;
  rightSlot: SlotModel;
  flip: FlipModel | null;
  indicator: string;
  canPrev: boolean;
  canNext: boolean;
  isFlipping: boolean;
  highlightPulse: boolean;
  error: string | null;
  ready: boolean;
  /** Bump when cover sound chrome should re-read getSoundEnabled. */
  coverRev: number;
}

export interface BookEngine extends ToonBookApi {
  readonly state: BookEngineState;
  start: () => Promise<void>;
  onFlipComplete: () => void;
  subscribe: (fn: () => void) => () => void;
}

function resolvePages(opts: ToonBookOptions): () => Promise<string[]> {
  if (typeof opts.getPages === "function") return opts.getPages;
  if (Array.isArray(opts.pages) && opts.pages.length) {
    return () => Promise.resolve(opts.pages!.slice());
  }
  const url = opts.configUrl || opts.manifestUrl;
  if (!url) {
    return async () => {
      throw new Error("ToonBook: configUrl is required when pages/getPages are not set");
    };
  }
  return () => loadConfigPages(url);
}

/**
 * Create a FlipFrame engine. Call `start()` after wiring subscribers.
 * No DOM access — bind `state` in Vue templates.
 */
export function createBookEngine(opts: ToonBookOptions = {}): BookEngine {
  const reduceMotion = prefersReduceMotion();
  const loadPages = resolvePages(opts);

  let destroyed = false;
  let flipId = 0;
  let flipSafetyTimer: ReturnType<typeof setTimeout> | null = null;
  /** Target view index waiting for flip animation to finish. */
  let pendingFlipTarget: number | null = null;
  /** Late-slot paint deferred until flip ends (desktop). */
  let pendingLate: { side: "left" | "right"; model: SlotModel } | null = null;

  const listeners = new Set<() => void>();

  /** Vue-reactive — templates bind `engine.state` directly. */
  const state = reactive<BookEngineState>({
    pages: [],
    viewIndex: 0,
    singlePage: prefersSinglePage(),
    leftSlot: { kind: "blank" },
    rightSlot: { kind: "blank" },
    flip: null,
    indicator: "…",
    canPrev: false,
    canNext: false,
    isFlipping: false,
    highlightPulse: false,
    error: null,
    ready: false,
    coverRev: 0,
  });

  function emit(): void {
    for (const fn of listeners) fn();
  }

  function subscribe(fn: () => void): () => void {
    listeners.add(fn);
    fn();
    return () => listeners.delete(fn);
  }

  function totalSpreads(): number {
    return totalSpreadsFor(state.pages.length);
  }

  function maxIndex(): number {
    return state.singlePage ? totalSingleViews(state.pages.length) - 1 : Math.max(0, totalSpreads() - 1);
  }

  function syncChrome(): void {
    state.indicator = indicatorText(state.pages, state.viewIndex, state.singlePage, totalSpreads());
    state.canPrev = state.viewIndex > 0;
    state.canNext = state.viewIndex < maxIndex();
    document.body.classList.toggle("single-page", state.singlePage);
  }

  function paintSpread(spread: number): void {
    const ts = totalSpreads();
    state.leftSlot = slotForSpread(state.pages, ts, spread, "left");
    state.rightSlot = slotForSpread(state.pages, ts, spread, "right");
  }

  function paintSingle(index: number): void {
    state.leftSlot = { kind: "blank" };
    state.rightSlot = singleViewContent(state.pages, index);
  }

  function updateView(skipRender = false): void {
    if (destroyed) return;
    if (!skipRender) {
      if (state.singlePage) paintSingle(state.viewIndex);
      else paintSpread(state.viewIndex);
      state.coverRev += 1;
    }
    syncChrome();
    emit();
  }

  function clearFlipTimers(): void {
    if (flipSafetyTimer) {
      clearTimeout(flipSafetyTimer);
      flipSafetyTimer = null;
    }
  }

  function abortFlip(): void {
    clearFlipTimers();
    state.flip = null;
    state.isFlipping = false;
    pendingFlipTarget = null;
    pendingLate = null;
  }

  function finishFlipSettled(): void {
    clearFlipTimers();
    if (pendingLate) {
      if (pendingLate.side === "left") state.leftSlot = pendingLate.model;
      else state.rightSlot = pendingLate.model;
      pendingLate = null;
    }
    if (pendingFlipTarget != null) {
      state.viewIndex = pendingFlipTarget;
      pendingFlipTarget = null;
    }
    state.isFlipping = false;
    syncChrome();
    emit();

    // Drop flip leaf after paint composites (double-rAF).
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        state.flip = null;
        emit();
      });
    });
  }

  /** Called by FlipLeaf on animationend (or safety timeout inside engine). */
  function onFlipComplete(): void {
    if (!state.isFlipping || pendingFlipTarget == null) return;
    finishFlipSettled();
  }

  async function turnDesktop(delta: number): Promise<void> {
    const target = state.viewIndex + delta;
    const ts = totalSpreads();
    if (target < 0 || target >= ts) return;
    opts.onPageTurn?.(delta);

    if (reduceMotion) {
      state.viewIndex = target;
      updateView(false);
      return;
    }

    const goingNext = delta > 0;
    const cur = state.viewIndex;
    const frontSrc = goingNext
      ? pageSrcForSpread(state.pages, cur, "right")
      : pageSrcForSpread(state.pages, cur, "left");
    const backSrc = goingNext
      ? pageSrcForSpread(state.pages, target, "left")
      : pageSrcForSpread(state.pages, target, "right");
    const earlySide: "left" | "right" = goingNext ? "right" : "left";
    const lateSide: "left" | "right" = goingNext ? "left" : "right";
    const earlyModel = slotForSpread(state.pages, ts, target, earlySide);
    const lateModel = slotForSpread(state.pages, ts, target, lateSide);

    state.isFlipping = true;
    emit();

    await Promise.all([
      preloadSrc(frontSrc),
      preloadSrc(backSrc),
      preloadSrc(earlyModel.kind === "page" ? earlyModel.src : null),
      preloadSrc(lateModel.kind === "page" ? lateModel.src : null),
    ]);
    if (destroyed || !state.isFlipping) return;

    // Early slot under the leaf.
    if (earlySide === "left") state.leftSlot = earlyModel;
    else state.rightSlot = earlyModel;
    pendingLate = { side: lateSide, model: lateModel };
    pendingFlipTarget = target;

    const frontFace = frontSrc
      ? ({ kind: "page", src: frontSrc } as const)
      : slotToFlipFace(slotForSpread(state.pages, ts, cur, goingNext ? "right" : "left"));
    const backFace = backSrc
      ? ({ kind: "page", src: backSrc } as const)
      : slotToFlipFace(slotForSpread(state.pages, ts, target, goingNext ? "left" : "right"));

    state.flip = {
      id: ++flipId,
      direction: goingNext ? "next" : "prev",
      mode: "desktop",
      front: frontFace,
      back: backFace,
    };
    emit();

    flipSafetyTimer = setTimeout(onFlipComplete, FLIP_SAFETY_MS);
  }

  async function turnSingle(delta: number): Promise<void> {
    const target = state.viewIndex + delta;
    if (target < 0 || target >= totalSingleViews(state.pages.length)) return;
    opts.onPageTurn?.(delta);

    if (reduceMotion) {
      state.viewIndex = target;
      updateView(false);
      return;
    }

    const leaving = singleViewContent(state.pages, state.viewIndex);
    const arriving = singleViewContent(state.pages, target);
    const leaveSrc = leaving.kind === "page" ? leaving.src : null;
    const arriveSrc = arriving.kind === "page" ? arriving.src : null;

    state.isFlipping = true;
    emit();

    await Promise.all([preloadSrc(leaveSrc), preloadSrc(arriveSrc)]);
    if (destroyed || !state.isFlipping) return;

    // Leaf covers current; destination already underneath.
    state.rightSlot = arriving;
    pendingLate = null;
    pendingFlipTarget = target;
    state.flip = {
      id: ++flipId,
      direction: delta > 0 ? "next" : "prev",
      mode: "single",
      front: slotToFlipFace(leaving),
    };
    emit();

    flipSafetyTimer = setTimeout(onFlipComplete, SINGLE_FLIP_MS + 150);
  }

  function turn(delta: number): void {
    if (destroyed || state.isFlipping || !state.ready) return;
    if (state.singlePage) void turnSingle(delta);
    else void turnDesktop(delta);
  }

  const goNext = () => turn(1);
  const goPrev = () => turn(-1);

  function applyMode(nextSingle: boolean): void {
    if (nextSingle === state.singlePage) return;
    if (state.isFlipping) abortFlip();
    if (nextSingle) {
      state.viewIndex = spreadToSingle(state.pages, totalSpreads(), state.viewIndex);
    } else {
      state.viewIndex = singleToSpread(state.pages, totalSpreads(), state.viewIndex);
    }
    state.singlePage = nextSingle;
    updateView(false);
  }

  function onKeydown(e: KeyboardEvent): void {
    if (destroyed) return;
    if (e.key === "ArrowLeft") goPrev();
    if (e.key === "ArrowRight") goNext();
  }

  function onSinglePageMq(e: MediaQueryListEvent): void {
    applyMode(e.matches);
  }

  let singlePageMq: MediaQueryList | null = null;

  function highlightTopControls(): void {
    state.highlightPulse = false;
    emit();
    // Force a tick so CSS can re-trigger the pulse class.
    requestAnimationFrame(() => {
      state.highlightPulse = true;
      emit();
      window.setTimeout(() => {
        state.highlightPulse = false;
        emit();
      }, 1700);
    });
  }

  async function start(): Promise<void> {
    if (destroyed) return;
    try {
      state.pages = await loadPages();
    } catch (err) {
      console.error(err);
      state.error = "Failed to load";
      state.indicator = "Failed to load";
      state.canPrev = false;
      state.canNext = false;
      emit();
      return;
    }

    if (!state.pages.length) {
      state.error = "No pages found";
      state.indicator = "No pages found";
      state.canPrev = false;
      state.canNext = false;
      emit();
      return;
    }

    try {
      await opts.beforeStart?.();
    } catch (err) {
      console.warn("ToonBook beforeStart:", err);
    }

    // Warm page images.
    for (const src of state.pages) {
      const img = new Image();
      img.src = src;
    }

    state.viewIndex = 0;
    state.ready = true;
    updateView(false);
    highlightTopControls();

    document.addEventListener("keydown", onKeydown);
    singlePageMq = window.matchMedia("(max-width: 768px)");
    if (typeof singlePageMq.addEventListener === "function") {
      singlePageMq.addEventListener("change", onSinglePageMq);
    } else {
      singlePageMq.addListener(onSinglePageMq);
    }
  }

  function destroy(): void {
    if (destroyed) return;
    destroyed = true;
    abortFlip();
    document.removeEventListener("keydown", onKeydown);
    if (singlePageMq) {
      if (typeof singlePageMq.removeEventListener === "function") {
        singlePageMq.removeEventListener("change", onSinglePageMq);
      } else if (singlePageMq.removeListener) {
        singlePageMq.removeListener(onSinglePageMq);
      }
    }
    document.body.classList.remove("single-page");
    listeners.clear();
  }

  return {
    state,
    start,
    onFlipComplete,
    subscribe,
    turn,
    goNext,
    goPrev,
    updateView,
    getViewIndex: () => state.viewIndex,
    getPages: () => state.pages.slice(),
    destroy,
  };
}

/**
 * Test / legacy helper: create engine, start immediately, return API.
 * Prefer `createBookEngine` + Vue surface in app code.
 */
export function initToonBook(_els: unknown, opts: ToonBookOptions = {}): ToonBookApi | undefined {
  const engine = createBookEngine(opts);
  void engine.start();
  return engine;
}
