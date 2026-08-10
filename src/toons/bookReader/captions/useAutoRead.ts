/**
 * Auto-read: play captions by **anchor position**, not page alignment.
 *
 * - Vertical / mobile strip (`body.view-vertical`): only balloons whose screen
 *   Y sits in the top 80% of the viewport (FOCUS_BAND_END). Scroll to bring
 *   lower balloons into the band — the plate does not need to snap/align.
 * - Book mode: full viewport band so every on-screen balloon on a spread can
 *   speak (no vertical scroll of the plate).
 *
 * Layers register id + getRect + captions. Clip selection lives in
 * visibility.ts (collectFocusClips). Queue transitions use queuePolicy.ts on
 * caption keys (`pageId:index`).
 *
 * A caption plays **once while it stays on screen**: played keys are remembered
 * and only forgotten when the anchor scrolls out of the viewport (or its plate
 * unmounts). Without that, every scroll stop reset coverage and re-read the
 * bubbles still sitting in the band.
 */
import { inject, provide, ref, type InjectionKey, type Ref } from "vue";
import { unlockMediaFromGesture, primeHtmlAudioUnlock } from "./mediaUnlock";
import { createSharedAudioPlayer } from "./sharedAudio";
import { collectFocusClips, keysOutOfView, FOCUS_BAND_END, VISIBLE_RATIO, type FocusClip } from "./visibility";
import { pageKey } from "./queuePolicy";

export { VISIBLE_RATIO, FOCUS_BAND_END } from "./visibility";

export interface AutoReadCaptionRef {
  index: number;
  audio: string;
  volume: number;
  x: number;
  y: number;
}

export interface AutoReadLayerOptions {
  id: string;
  getRect: () => DOMRect | null;
}

export interface AutoReadLayerHandle {
  speakingIndex: Ref<number | null>;
  setCaptions: (captions: AutoReadCaptionRef[]) => void;
  layoutChanged: () => void;
  playOne: (caption: AutoReadCaptionRef) => void;
  release: () => void;
}

export interface AutoReadOptions {
  gapMs?: number;
  enabled?: boolean;
  requireGesture?: boolean;
  /**
   * End of the focus band as a fraction of viewport height for **vertical /
   * mobile scroll mode** (default 0.8 = top 80%). Clips below the band wait
   * until scroll brings them up. Book mode always uses the full viewport (1).
   */
  focusBandEnd?: number;
}

interface LayerRecord {
  id: string;
  getRect: () => DOMRect | null;
  captions: AutoReadCaptionRef[];
  released: boolean;
  speakingIndex: Ref<number | null>;
}

/** One speakable clip — queue is caption-level, not whole-page. */
interface ClipJob {
  key: string;
  layerId: string;
  caption: AutoReadCaptionRef;
}

export interface AutoReadController {
  registerLayer: (opts: AutoReadLayerOptions) => AutoReadLayerHandle;
  stop: () => void;
  notifyScroll: () => void;
  kick: () => void;
  unlocked: Ref<boolean>;
  promptOpen: Ref<boolean>;
  enableFromPrompt: () => void;
  dismissPrompt: () => void;
  maybeShowPrompt: () => void;
}

const SETTLE_MS = 220;
const SCROLL_IDLE_MS = 700;
const MAX_PLAY_FAILS = 2;
const PLAY_FAIL_BACKOFF_MS = 400;

function viewportHeight(): number {
  try {
    const vv = window.visualViewport?.height;
    if (vv != null && vv > 1) return vv;
  } catch {
    /* ignore */
  }
  return window.innerHeight || 0;
}

export function createAutoReadController(options: AutoReadOptions = {}): AutoReadController {
  const gapMs = options.gapMs != null ? Number(options.gapMs) : 600;
  const enabled = options.enabled !== false;
  const requireGesture = options.requireGesture !== false;
  const focusBandEnd =
    options.focusBandEnd != null && Number.isFinite(Number(options.focusBandEnd))
      ? Math.max(0.15, Math.min(1, Number(options.focusBandEnd)))
      : FOCUS_BAND_END;

  const layers = new Set<LayerRecord>();
  const player = createSharedAudioPlayer();

  let settleTimer: ReturnType<typeof setTimeout> | null = null;
  let scrollIdleTimer: ReturnType<typeof setTimeout> | null = null;
  let failRetryTimer: ReturnType<typeof setTimeout> | null = null;
  let unlockTimer: ReturnType<typeof setTimeout> | null = null;

  let scrolling = false;
  let scrollPaused = false;
  let seq = 0;
  let running = false;
  let currentKey = "";
  let doneKey = "";
  /** Caption keys (`layerId:index`) covered / wanted for the current view. */
  let coveredIds = new Set<string>();
  let wantedIds = new Set<string>();
  let playQueue: ClipJob[] = [];
  /** Caption keys already spoken and still on screen — never auto-repeat. */
  const playedIds = new Set<string>();
  /** Key of the clip currently inside speakLayer (not yet in playedIds). */
  let activeJobKey = "";
  let speakingLayer: LayerRecord | null = null;
  let retryArmed = false;
  let pendingRetryKey = "";
  let playFailStreak = 0;

  const unlocked = ref(false);
  const promptOpen = ref(false);
  let promptSoftDismissed = false;

  if (enabled && !requireGesture) unlocked.value = true;

  function clearHighlight(): void {
    if (speakingLayer) speakingLayer.speakingIndex.value = null;
    speakingLayer = null;
  }

  function clearTimer(t: ReturnType<typeof setTimeout> | null): null {
    if (t != null) clearTimeout(t);
    return null;
  }

  /** Kill audio + pump. Does not touch scroll timers. */
  function pausePlayback(): void {
    // Scroll / hard-cut often interrupts mid-clip. Count the active bubble as
    // heard so settle does not restart it while it is still on screen (mobile
    // fling thrash was re-reading the same line after every pause).
    if (speakingLayer && speakingLayer.speakingIndex.value != null) {
      playedIds.add(`${speakingLayer.id}:${speakingLayer.speakingIndex.value}`);
    }
    seq++;
    running = false;
    playQueue = [];
    player.stopCurrent();
    clearHighlight();
  }

  function stop(): void {
    pausePlayback();
    settleTimer = clearTimer(settleTimer);
    scrollIdleTimer = clearTimer(scrollIdleTimer);
    failRetryTimer = clearTimer(failRetryTimer);
    unlockTimer = clearTimer(unlockTimer);
    scrolling = false;
    scrollPaused = false;
    playedIds.clear();
    player.destroy();
  }

  function maybeShowPrompt(): void {
    if (!enabled || unlocked.value || promptSoftDismissed) return;
    promptOpen.value = true;
  }

  function dismissPrompt(): void {
    promptOpen.value = false;
    promptSoftDismissed = true;
    if (requireGesture && !unlocked.value) armNextGestureUnlock();
  }

  function armNextGestureUnlock(): void {
    if (retryArmed) return;
    retryArmed = true;
    const opts: AddEventListenerOptions = { capture: true, once: true, passive: true };
    const onGesture = (): void => {
      retryArmed = false;
      unlockAudioFromGesture();
    };
    document.addEventListener("pointerdown", onGesture, opts);
    document.addEventListener("touchend", onGesture, opts);
    document.addEventListener("keydown", onGesture, opts);
  }

  function unlockAudioFromGesture(): void {
    unlocked.value = true;
    promptOpen.value = false;
    retryArmed = false;
    playFailStreak = 0;
    pendingRetryKey = "";

    // Sticky-unlock the **shared** player element (not a throwaway Audio).
    // Extra context resume still helps some WebKit builds.
    void player.unlockFromGesture();
    unlockMediaFromGesture();

    // One gesture-adjacent restart. Shell owns post-dialog reflow via kick().
    unlockTimer = clearTimer(unlockTimer);
    unlockTimer = setTimeout(() => {
      unlockTimer = null;
      pausePlayback();
      // Soft release only — keep the unlocked element for post-scroll speak().
      player.release();
      resetCoverage();
      playedIds.clear();
      sync();
    }, 0);
  }

  function enableFromPrompt(): void {
    unlockAudioFromGesture();
  }

  function kick(): void {
    if (!enabled || !unlocked.value || scrolling) return;
    schedule();
  }

  function resetCoverage(): void {
    currentKey = "";
    coveredIds = new Set();
    wantedIds = new Set();
  }

  function liveLayer(id: string): LayerRecord | null {
    for (const layer of layers) {
      if (layer.id === id && !layer.released) return layer;
    }
    return null;
  }

  /**
   * Mobile strip → top 80% caption band. Book mode → full viewport so every
   * balloon on a visible spread can speak. Detected via body.view-vertical
   * (set by useViewMode) so plate height is never used as a proxy for mode —
   * mobile plates often *fit* the emulator viewport and were wrongly treated
   * as full-page before.
   */
  function activeBandEnd(): number {
    try {
      if (typeof document !== "undefined" && document.body?.classList.contains("view-vertical")) {
        return focusBandEnd;
      }
    } catch {
      /* ignore */
    }
    return 1;
  }

  /** Clips currently in the active focus band (caption screen Y only). */
  function focusClips(): FocusClip[] {
    return collectFocusClips(layers, viewportHeight(), activeBandEnd());
  }

  /** Jobs for clips not yet spoken in this on-screen pass. */
  function clipJobs(clips: FocusClip[]): ClipJob[] {
    return clips
      .filter((c) => !playedIds.has(c.key))
      .map((c) => ({
        key: c.key,
        layerId: c.layerId,
        caption: c.caption,
      }));
  }

  /** Forget played captions that scrolled off screen so they can read again. */
  function prunePlayed(): void {
    if (!playedIds.size) return;
    for (const key of keysOutOfView(layers, viewportHeight(), playedIds)) {
      playedIds.delete(key);
    }
  }

  function schedule(): void {
    if (!enabled || scrolling) return;
    settleTimer = clearTimer(settleTimer);
    settleTimer = setTimeout(() => {
      settleTimer = null;
      if (scrolling) return;
      sync();
    }, SETTLE_MS);
  }

  function notifyScroll(): void {
    if (!enabled) return;
    scrolling = true;
    settleTimer = clearTimer(settleTimer);
    scrollIdleTimer = clearTimer(scrollIdleTimer);

    // Hard-cut audio once per fling. Pause only — do not release()/load() the
    // shared element. iOS Safari ties unlock to that node; clearing src mid-
    // session made post-scroll auto-read silent on real devices / Simulator.
    if (!scrollPaused) {
      scrollPaused = true;
      if (running || player.busy()) pausePlayback();
      else player.stopCurrent();
    }

    scrollIdleTimer = setTimeout(() => {
      scrollIdleTimer = null;
      scrolling = false;
      scrollPaused = false;
      // Re-collect whatever sits in the focus band under the new scroll offset.
      resetCoverage();
      doneKey = "";
      playFailStreak = 0;
      schedule();
    }, SCROLL_IDLE_MS);
  }

  function startJobs(jobs: ClipJob[], key: string, allKeys: string[]): void {
    pausePlayback();
    activeJobKey = "";
    playQueue = jobs;
    currentKey = key;
    coveredIds = new Set(allKeys);
    wantedIds = new Set(allKeys);
    doneKey = "";
    void pump(key);
  }

  /**
   * Rebuild auto-read from the full in-band list in **config array order**.
   * Avoid expand-append of one caption at a time — a later words[] entry
   * (e.g. “Be careful.”) could start before an earlier one (“Everyone…”)
   * when they entered the focus band a frame apart.
   */
  function sync(): void {
    if (scrolling) return;
    if (requireGesture && !unlocked.value) {
      maybeShowPrompt();
      return;
    }

    prunePlayed();
    const clips = focusClips();
    if (!clips.length) {
      if (running && layers.size) return;
      resetCoverage();
      activeJobKey = "";
      pausePlayback();
      return;
    }

    const allKeys = clips.map((c) => c.key);
    const key = pageKey(allKeys);
    // Unplayed in config order; exclude the clip currently speaking.
    const jobs = clipJobs(clips).filter((j) => j.key !== activeJobKey);

    wantedIds = new Set(allKeys);
    coveredIds = new Set(allKeys);

    if (running) {
      // Same plate growing mid-speak: keep the current clip, rebuild the rest
      // in config order (never append a later words[] entry ahead of an earlier one).
      // Different page / active clip left the band: hard-cut to the new list.
      if (activeJobKey && allKeys.includes(activeJobKey)) {
        currentKey = key;
        playQueue = jobs;
        return;
      }
      startJobs(jobs, key, allKeys);
      return;
    }

    currentKey = key;

    if (!jobs.length) {
      doneKey = key;
      return;
    }

    // Same band already finished — do not restart.
    if (doneKey === key) return;

    startJobs(jobs, key, allKeys);
  }

  async function speakLayer(layer: LayerRecord | null, caption: AutoReadCaptionRef): Promise<boolean> {
    clearHighlight();
    if (layer) {
      speakingLayer = layer;
      layer.speakingIndex.value = caption.index;
    }
    const mySeq = seq;
    const ok = await player.speak(caption.audio, caption.volume);
    if (layer && layer.speakingIndex.value === caption.index) layer.speakingIndex.value = null;
    if (speakingLayer === layer) speakingLayer = null;
    if (seq !== mySeq) return false;
    return ok;
  }

  async function pump(key: string): Promise<void> {
    const mySeq = seq;
    running = true;
    try {
      while (playQueue.length) {
        if (seq !== mySeq || scrolling) return;
        const job = playQueue.shift()!;
        if (!wantedIds.has(job.key)) continue;
        activeJobKey = job.key;
        const layer = liveLayer(job.layerId);
        const played = await speakLayer(layer, job.caption);
        if (activeJobKey === job.key) activeJobKey = "";
        if (seq !== mySeq || scrolling) return;
        if (!played) {
          armRetry(key);
          return;
        }
        playFailStreak = 0;
        // Spoken while on screen → do not re-read on the next scroll settle.
        playedIds.add(job.key);
        if (gapMs > 0) {
          await new Promise<void>((resolve) => setTimeout(resolve, gapMs));
          if (seq !== mySeq || scrolling) return;
          if (!wantedIds.has(job.key)) continue;
        }
      }
      if (seq === mySeq) doneKey = currentKey || key;
    } finally {
      if (seq === mySeq) running = false;
    }
  }

  function armRetry(key: string): void {
    pendingRetryKey = key;
    if (unlocked.value) {
      playFailStreak++;
      if (playFailStreak > MAX_PLAY_FAILS) {
        playFailStreak = 0;
        armNextGestureUnlock();
        return;
      }
      failRetryTimer = clearTimer(failRetryTimer);
      const delay = PLAY_FAIL_BACKOFF_MS * playFailStreak;
      failRetryTimer = setTimeout(() => {
        failRetryTimer = null;
        if (scrolling || running) return;
        if (currentKey !== key && pendingRetryKey !== key) return;
        pendingRetryKey = "";
        resetCoverage();
        sync();
      }, delay);
      return;
    }
    maybeShowPrompt();
    armNextGestureUnlock();
  }

  function markViewOwned(): void {
    const clips = focusClips();
    if (clips.length) {
      const keys = clips.map((c) => c.key);
      currentKey = pageKey(keys);
      coveredIds = new Set(keys);
      wantedIds = new Set(keys);
    }
    doneKey = currentKey;
  }

  function registerLayer(opts: AutoReadLayerOptions): AutoReadLayerHandle {
    const record: LayerRecord = {
      id: opts.id,
      getRect: opts.getRect,
      captions: [],
      released: false,
      speakingIndex: ref<number | null>(null),
    };
    layers.add(record);

    return {
      speakingIndex: record.speakingIndex,
      setCaptions(captions: AutoReadCaptionRef[]): void {
        record.captions = captions;
        if (!captions.length) return;
        schedule();
      },
      layoutChanged(): void {
        schedule();
      },
      playOne(caption: AutoReadCaptionRef): void {
        // Cancel pending auto-read timers first. After scroll idle we always
        // schedule(); if that fires mid-tap it pausePlayback()s and kills this
        // gesture-driven clip (bubble “doesn’t play”).
        settleTimer = clearTimer(settleTimer);
        failRetryTimer = clearTimer(failRetryTimer);
        unlockTimer = clearTimer(unlockTimer);
        scrollIdleTimer = clearTimer(scrollIdleTimer);
        scrolling = false;
        scrollPaused = false;

        if (!unlocked.value) {
          unlocked.value = true;
          promptOpen.value = false;
          // Unlock the shared element on this gesture (not a throwaway Audio).
          void player.unlockFromGesture();
          void primeHtmlAudioUnlock();
        }
        // Hard stop + soft-clear. Keep the same unlocked node for iOS; the
        // tap itself is a user gesture so speak() is allowed either way.
        pausePlayback();
        player.release();
        // Mark the current focus band as user-owned so a late sync() is a no-op.
        markViewOwned();
        // Tapped clip counts as read — auto-read must not repeat it in place.
        playedIds.add(`${record.id}:${caption.index}`);
        void speakLayer(record, caption);
      },
      release(): void {
        layers.delete(record);
        record.released = true;
        if (speakingLayer === record) {
          record.speakingIndex.value = null;
          speakingLayer = null;
        }
        schedule();
      },
    };
  }

  return {
    registerLayer,
    stop,
    notifyScroll,
    kick,
    unlocked,
    promptOpen,
    enableFromPrompt,
    dismissPrompt,
    maybeShowPrompt,
  };
}

export const AUTO_READ_KEY: InjectionKey<AutoReadController> = Symbol("flipframe-auto-read");

export function provideAutoRead(options?: AutoReadOptions): AutoReadController {
  const controller = createAutoReadController(options);
  provide(AUTO_READ_KEY, controller);
  return controller;
}

export function useAutoReadController(): AutoReadController | null {
  return inject(AUTO_READ_KEY, null);
}
