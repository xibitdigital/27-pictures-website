/**
 * Auto-read: whatever is on screen reads itself out loud.
 *
 * Layers register id + getRect + captions. Visibility is owned here via
 * geometry (visibility.ts). Queue transitions live in queuePolicy.ts.
 * Scroll uses pausePlayback(); unmount uses stop(). Unlock primes media then
 * one microtask sync; the shell owns the single post-dialog kick after OK.
 */
import { inject, provide, ref, type InjectionKey, type Ref } from "vue";
import { readingOrder } from "./captionModel";
import { unlockMediaFromGesture, primeHtmlAudioUnlock } from "./mediaUnlock";
import { createSharedAudioPlayer } from "./sharedAudio";
import { orderedOnScreenLayers, VISIBLE_RATIO } from "./visibility";
import { diffVisiblePages } from "./queuePolicy";

export { VISIBLE_RATIO } from "./visibility";

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
}

interface LayerRecord {
  id: string;
  getRect: () => DOMRect | null;
  captions: AutoReadCaptionRef[];
  released: boolean;
  speakingIndex: Ref<number | null>;
}

interface PageJob {
  id: string;
  captions: AutoReadCaptionRef[];
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

export function createAutoReadController(options: AutoReadOptions = {}): AutoReadController {
  const gapMs = options.gapMs != null ? Number(options.gapMs) : 600;
  const enabled = options.enabled !== false;
  const requireGesture = options.requireGesture !== false;

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
  let coveredIds = new Set<string>();
  let wantedIds = new Set<string>();
  let playQueue: PageJob[] = [];
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
    player.release();
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

    unlockMediaFromGesture();

    // One gesture-adjacent restart. Shell owns post-dialog reflow via kick().
    unlockTimer = clearTimer(unlockTimer);
    unlockTimer = setTimeout(() => {
      unlockTimer = null;
      pausePlayback();
      player.release();
      resetCoverage();
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

  /** Ordered on-screen layers with captions (geometry only). */
  function readableLayers(): LayerRecord[] {
    return orderedOnScreenLayers(layers, window.innerHeight || 0, (l) => !l.released && l.captions.length > 0);
  }

  function liveLayer(id: string): LayerRecord | null {
    for (const layer of layers) {
      if (layer.id === id && !layer.released) return layer;
    }
    return null;
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

    // Hard-cut audio once per fling and fully release the media element so the
    // next idle speak() does not reuse a half-dead Audio node (common after a
    // few scroll pauses — highlight would advance with no sound).
    if (!scrollPaused) {
      scrollPaused = true;
      if (running || player.busy()) pausePlayback();
      player.release();
    }

    scrollIdleTimer = setTimeout(() => {
      scrollIdleTimer = null;
      scrolling = false;
      scrollPaused = false;
      // Always re-read whatever is under the viewport after a fling. Keeping a
      // stale doneKey made sync() no-op or skip pages after several scrolls.
      resetCoverage();
      doneKey = "";
      playFailStreak = 0;
      schedule();
    }, SCROLL_IDLE_MS);
  }

  function jobsFrom(layersList: LayerRecord[]): PageJob[] {
    return layersList.map((l) => ({
      id: l.id,
      captions: readingOrder(l.captions),
    }));
  }

  function startJobs(jobs: PageJob[], key: string, ids: string[]): void {
    pausePlayback();
    playQueue = jobs;
    currentKey = key;
    coveredIds = new Set(ids);
    wantedIds = new Set(ids);
    doneKey = "";
    void pump(key);
  }

  function sync(): void {
    if (scrolling) return;
    if (requireGesture && !unlocked.value) {
      maybeShowPrompt();
      return;
    }
    const ordered = readableLayers();
    if (!ordered.length) {
      if (running && layers.size) return;
      resetCoverage();
      pausePlayback();
      return;
    }

    const diff = diffVisiblePages(currentKey, ordered, coveredIds, {
      running,
      doneKey,
    });

    if (diff.kind === "noop") return;

    if (diff.kind === "subset") {
      currentKey = diff.key;
      wantedIds = new Set(diff.wantedIds);
      playQueue = playQueue.filter((j) => wantedIds.has(j.id));
      return;
    }

    if (diff.kind === "expand") {
      currentKey = diff.key;
      coveredIds = new Set(diff.allIds);
      wantedIds = new Set(diff.allIds);
      const jobs = jobsFrom(diff.append);
      if (running) {
        playQueue.push(...jobs);
        return;
      }
      playQueue = jobs;
      doneKey = "";
      void pump(diff.key);
      return;
    }

    // replace
    startJobs(jobsFrom(diff.toRead), diff.key, diff.allIds);
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
        if (!wantedIds.has(job.id)) continue;
        for (const caption of job.captions) {
          if (seq !== mySeq || scrolling) return;
          if (!wantedIds.has(job.id)) break;
          const layer = liveLayer(job.id);
          const played = await speakLayer(layer, caption);
          if (seq !== mySeq || scrolling) return;
          if (!played) {
            armRetry(key);
            return;
          }
          playFailStreak = 0;
          if (gapMs > 0) {
            await new Promise<void>((resolve) => setTimeout(resolve, gapMs));
            if (seq !== mySeq || scrolling) return;
            if (!wantedIds.has(job.id)) break;
          }
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
        if (!unlocked.value) {
          unlocked.value = true;
          promptOpen.value = false;
          void primeHtmlAudioUnlock();
        }
        pausePlayback();
        doneKey = currentKey;
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
