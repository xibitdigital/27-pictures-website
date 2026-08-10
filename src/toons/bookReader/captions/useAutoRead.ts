/**
 * Auto-read: whatever is on screen reads itself out loud.
 *
 * Every caption carrying `audio` plays in reading order — in book mode the
 * left page top→bottom, then the right page; in the vertical strip whichever
 * page is on screen — highlighted while it plays, with a gap after each clip.
 * One sequence at a time; a tap on a caption takes over.
 *
 * The controller never touches the DOM beyond measuring layer rects: layers
 * register themselves (component instances), and highlight is a reactive index.
 *
 * Layer mounts are ephemeral during a flip (the leaf carries the same page as
 * the slot underneath). Sequences are keyed by page id + a caption snapshot,
 * not by a particular component instance, so an unmount mid-clip cannot kill
 * the rest of the page.
 *
 * Rapid page turns hard-cut to the settled view: only a pure spread expansion
 * (right half arriving after the left) appends. Anything else replaces the
 * queue so stale clips from pages the user already left never pile up.
 *
 * Browsers block Audio.play() until a user gesture. Auto-read often starts
 * after a settle timer (outside the gesture stack), so we unlock media on OK
 * (or a later page-turn if the user dismissed the prompt). Unlock must play a
 * real HTMLAudioElement during the gesture — AudioContext.resume() alone does
 * not unlock HTML5 audio on iOS Safari.
 */
import { inject, provide, ref, type InjectionKey, type Ref } from "vue";
import { readingOrder } from "./captionModel";

export interface AutoReadCaptionRef {
  index: number;
  audio: string;
  volume: number;
  x: number;
  y: number;
}

export interface AutoReadLayerOptions {
  /** Stable identity of what is being read (page number). */
  id: string;
  /** Layer rect, for ordering left/right and top/bottom. */
  getRect: () => DOMRect | null;
}

export interface AutoReadLayerHandle {
  /** Index of the caption currently speaking in this layer (null = silent). */
  speakingIndex: Ref<number | null>;
  setVisible: (visible: boolean) => void;
  setCaptions: (captions: AutoReadCaptionRef[]) => void;
  /** A tap owns the page: stop the sequence and play just this caption. */
  playOne: (caption: AutoReadCaptionRef) => void;
  release: () => void;
}

export interface AutoReadOptions {
  /** Silence after each clip, in ms. Default 600. */
  gapMs?: number;
  /** Turn the whole feature off (kept for tests / opt-out). */
  enabled?: boolean;
  /**
   * Wait for a user gesture before play() (browser autoplay policy).
   * Default true in production; unit tests pass false.
   */
  requireGesture?: boolean;
}

interface LayerRecord {
  id: string;
  getRect: () => DOMRect | null;
  captions: AutoReadCaptionRef[];
  visible: boolean;
  /** Unmounted for good — distinct from `visible`, which dips during a flip. */
  released: boolean;
  speakingIndex: Ref<number | null>;
}

interface PageJob {
  id: string;
  captions: AutoReadCaptionRef[];
}

export interface AutoReadController {
  registerLayer: (opts: AutoReadLayerOptions) => AutoReadLayerHandle;
  /** Stop everything (page change, unmount, manual takeover). */
  stop: () => void;
  /**
   * Call on every window scroll (vertical strip). Hard-cuts audio while the
   * user is flinging so play()/decode work cannot freeze the main thread, and
   * restarts after idle once a plate settles in view.
   */
  notifyScroll: () => void;
  /**
   * Re-promote on-screen layers and schedule auto-read. Call after Story/OK
   * dialogs close so the first plate starts without the user scrolling.
   */
  kick: () => void;
  /** True after a user gesture unlocked browser autoplay for this page load. */
  unlocked: Ref<boolean>;
  /** One-shot “OK to enable caption sound” dialog. */
  promptOpen: Ref<boolean>;
  /** OK on the prompt — unlocks media and starts (or restarts) auto-read. */
  enableFromPrompt: () => void;
  /** Dismiss without enabling (page turn can still unlock later). */
  dismissPrompt: () => void;
  /** Open the prompt if still locked (e.g. after Story guide closes). */
  maybeShowPrompt: () => void;
}

/**
 * Fraction of a plate that must sit in the viewport to count as “on screen”.
 * 0.55 was too high for tall portrait plates (often taller than the mobile
 * viewport), so auto-read never started until a scroll re-fired IO.
 */
export const VISIBLE_RATIO = 0.2;
/** Coalesce the two halves of a spread — they become visible a frame apart. */
const SETTLE_MS = 220;
/**
 * After the last scroll event, wait this long before starting auto-read.
 * Fast flings fire hundreds of scroll events; short idle restarts play() mid-
 * momentum and can exhaust iOS media (silent forever / tab crash).
 */
const SCROLL_IDLE_MS = 700;
/** Hard cap so a hung clip (no `ended` on flaky mobile WebViews) cannot freeze the queue. */
const SPEAK_MAX_MS = 16000;
/** If play() neither starts nor rejects (some emulator WebViews), fail open. */
const PLAY_START_MS = 4000;
/**
 * Consecutive play() failures before we give up until a user gesture.
 * Unbounded retries after a fling were spinning the main thread to death.
 */
const MAX_PLAY_FAILS = 2;
/** Backoff base for play-failure retries (ms). */
const PLAY_FAIL_BACKOFF_MS = 400;
/**
 * Tiny silent WAV (data URI). iOS Safari only unlocks *HTMLAudioElement* when
 * a media element actually plays inside a user gesture — AudioContext.resume()
 * alone is not enough (Chrome sticky activation is more forgiving).
 */
const SILENT_WAV = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

/** iOS needs playsinline on every element that will call play(). */
function configureMediaEl(el: HTMLAudioElement): void {
  el.preload = "auto";
  try {
    el.setAttribute("playsinline", "true");
    el.setAttribute("webkit-playsinline", "true");
    (el as HTMLAudioElement & { playsInline?: boolean }).playsInline = true;
  } catch {
    /* ignore */
  }
}

/** Release decoder buffers — required on iOS after rapid pause/src swaps. */
function releaseMediaEl(el: HTMLAudioElement): void {
  try {
    el.pause();
  } catch {
    /* ignore */
  }
  try {
    el.removeAttribute("src");
    // Empty assignment forces some WebKit builds to drop the resource.
    el.src = "";
    el.load();
  } catch {
    /* ignore */
  }
}

export function createAutoReadController(options: AutoReadOptions = {}): AutoReadController {
  // Default gap was 2000ms — felt "stuck" between lines on mobile emulators.
  const gapMs = options.gapMs != null ? Number(options.gapMs) : 600;
  const enabled = options.enabled !== false;
  const requireGesture = options.requireGesture !== false;

  const layers = new Set<LayerRecord>();
  let settleTimer: ReturnType<typeof setTimeout> | null = null;
  let scrollIdleTimer: ReturnType<typeof setTimeout> | null = null;
  /** True while the user is actively scrolling the vertical strip. */
  let scrolling = false;
  /** Already hard-cut audio for this fling (avoid stop() on every scroll tick). */
  let scrollPaused = false;
  /** Bumped on every stop/start — in-flight sequences die when it moves. */
  let seq = 0;
  let running = false;
  let currentKey = "";
  let doneKey = "";
  /** Page ids the current sequence covers — see the subset check in `sync`. */
  let coveredIds = new Set<string>();
  /**
   * Pages the last settled sync wants spoken. The pump drops jobs that fall
   * out of this set (page left the view) without waiting for stop().
   */
  let wantedIds = new Set<string>();
  /** Remaining pages to speak (snapshot of captions, resolved by page id). */
  let playQueue: PageJob[] = [];
  /**
   * One shared element for the whole reader. `new Audio()` per clip + rapid
   * scroll stop/start exhausts iOS media slots → silent forever or tab kill.
   */
  let sharedAudio: HTMLAudioElement | null = null;
  let speakingLayer: LayerRecord | null = null;
  /** Resolves the in-flight `speak()` when stop() aborts it. */
  let speakFinish: ((ok: boolean) => void) | null = null;
  /** True when the current speak was aborted by stop/scroll (not autoplay). */
  let speakAborted = false;
  let retryArmed = false;
  /** Key to re-read once unlock lands (autoplay was blocked). */
  let pendingRetryKey = "";
  let playFailStreak = 0;
  let failRetryTimer: ReturnType<typeof setTimeout> | null = null;
  const unlocked = ref(false);
  const promptOpen = ref(false);
  /** User closed the prompt with “Not now” — don’t nag again this load. */
  let promptSoftDismissed = false;
  /** Coalesce double unlock (OK click = pointerdown + enableFromPrompt). */
  let restartTimer: ReturnType<typeof setTimeout> | null = null;
  /** Delayed post-unlock kicks — must clear on stop or they leak across tests. */
  const kickTimers: ReturnType<typeof setTimeout>[] = [];

  function getSharedAudio(): HTMLAudioElement {
    if (!sharedAudio) {
      sharedAudio = new Audio();
      configureMediaEl(sharedAudio);
    }
    return sharedAudio;
  }

  function clearHighlight(): void {
    if (speakingLayer) speakingLayer.speakingIndex.value = null;
    speakingLayer = null;
  }

  function maybeShowPrompt(): void {
    if (!enabled || unlocked.value || promptSoftDismissed) return;
    promptOpen.value = true;
  }

  function dismissPrompt(): void {
    promptOpen.value = false;
    promptSoftDismissed = true;
    // User skipped the dialog — next page-turn / tap may unlock instead.
    if (requireGesture && !unlocked.value) armGestureUnlock();
  }

  /**
   * Play a silent HTMLAudioElement *synchronously* from the gesture stack.
   * Required on iOS Safari — AudioContext.resume() does not unlock HTML5 audio.
   * Returns a promise that settles after play succeeds/fails (never rejects).
   */
  function primeHtmlAudioUnlock(): Promise<void> {
    if (typeof window === "undefined") return Promise.resolve();
    try {
      const el = new Audio(SILENT_WAV);
      configureMediaEl(el);
      // Not fully muted: some WebKit builds treat muted play as a separate
      // autoplay bucket that does not unlock audible playback later.
      el.volume = 0.01;
      const p = el.play();
      if (p && typeof p.then === "function") {
        return p
          .then(() => {
            try {
              el.pause();
              el.removeAttribute("src");
              el.load();
            } catch {
              /* ignore */
            }
          })
          .catch(() => undefined);
      }
    } catch {
      /* ignore */
    }
    return Promise.resolve();
  }

  /** Chrome sticky-activation path (does not alone unlock iOS HTMLAudio). */
  function resumeAudioContext(): Promise<void> {
    type Ctx = {
      resume: () => Promise<void>;
      close: () => Promise<void>;
      state: string;
      createBuffer?: (channels: number, length: number, sampleRate: number) => { length: number };
      createBufferSource?: () => {
        buffer: unknown;
        connect: (dest: unknown) => void;
        start: (when?: number) => void;
      };
      destination?: unknown;
    };
    type CtxCtor = new () => Ctx;
    const w = typeof window !== "undefined" ? window : null;
    const AC =
      w &&
      ((w as unknown as { AudioContext?: CtxCtor }).AudioContext ||
        (w as unknown as { webkitAudioContext?: CtxCtor }).webkitAudioContext);
    if (!AC) return Promise.resolve();
    try {
      const ctx = new AC();
      // One-sample silent buffer: extra unlock signal for WebKit Web Audio.
      try {
        if (ctx.createBuffer && ctx.createBufferSource && ctx.destination) {
          const buf = ctx.createBuffer(1, 1, 22050);
          const src = ctx.createBufferSource();
          src.buffer = buf;
          src.connect(ctx.destination);
          src.start(0);
        }
      } catch {
        /* optional */
      }
      return ctx
        .resume()
        .catch(() => undefined)
        .then(() => ctx.close().catch(() => undefined));
    } catch {
      return Promise.resolve();
    }
  }

  /**
   * First intentional OK (or any pointer/key if they skip the dialog) unlocks
   * Audio for later async play() calls. Without a gesture the browser rejects
   * play() after settle timers — users had to tap the plate twice.
   *
   * On iOS, unlock *must* play an HTMLAudioElement inside this call; resuming
   * AudioContext alone is not sticky for later `new Audio().play()`.
   *
   * Critical: start auto-read on this call stack (or immediately after silent
   * prime), not only after Promise.all — emulators drop sticky activation if
   * the first real clip waits on async unlock work.
   */
  function unlockAudioFromGesture(): void {
    unlocked.value = true;
    promptOpen.value = false;
    retryArmed = false;
    playFailStreak = 0;
    pendingRetryKey = "";

    // Silent prime + AC resume *synchronously* on the gesture stack.
    void primeHtmlAudioUnlock();
    void resumeAudioContext();

    // Kick reading now (gesture-adjacent) and again after dialog reflow.
    beginReadingAfterUnlock();
    kickWhenIdle(50);
    kickWhenIdle(200);
    kickWhenIdle(600);
    kickWhenIdle(1200);
  }

  function beginReadingAfterUnlock(): void {
    if (restartTimer != null) clearTimeout(restartTimer);
    restartTimer = setTimeout(() => {
      restartTimer = null;
      // Force-cut any hung speak/gap so unlock always recovers the reader
      // (emulators sometimes never fire "ended", leaving running=true forever).
      stop();
      resetCoverage();
      promoteVisibleFromRects();
      sync();
    }, 0);
  }

  function enableFromPrompt(): void {
    // Must run in the click handler so the browser treats it as a user gesture.
    unlockAudioFromGesture();
  }

  /** Public: shell calls this after Story/OK dialogs finish unmounting. */
  function kick(): void {
    if (!enabled || !unlocked.value || scrolling) return;
    promoteVisibleFromRects();
    schedule();
  }

  function armGestureUnlock(): void {
    if (typeof document === "undefined") return;
    const opts: AddEventListenerOptions = { capture: true, once: true, passive: true };
    const onGesture = (): void => {
      unlockAudioFromGesture();
    };
    // touchend/pointerup: iOS sometimes only keeps activation through the full
    // touch; pointerdown alone was not always enough for later HTMLAudio play.
    document.addEventListener("pointerdown", onGesture, opts);
    document.addEventListener("touchend", onGesture, opts);
    document.addEventListener("keydown", onGesture, opts);
  }

  // Do NOT unlock on every first tap at startup — that made "Start reading"
  // consume the gesture and skip the sound prompt. Arm passive unlock only
  // after "Not now", so page-turn still enables audio without the dialog.
  // Unit tests skip the gesture gate so clips can play under jsdom mocks.
  if (enabled && !requireGesture) unlocked.value = true;

  function stop(): void {
    seq++;
    running = false;
    playQueue = [];
    speakAborted = true;
    if (failRetryTimer != null) {
      clearTimeout(failRetryTimer);
      failRetryTimer = null;
    }
    if (restartTimer != null) {
      clearTimeout(restartTimer);
      restartTimer = null;
    }
    if (settleTimer != null) {
      clearTimeout(settleTimer);
      settleTimer = null;
    }
    if (scrollIdleTimer != null) {
      clearTimeout(scrollIdleTimer);
      scrollIdleTimer = null;
    }
    scrolling = false;
    scrollPaused = false;
    while (kickTimers.length) {
      const t = kickTimers.pop();
      if (t != null) clearTimeout(t);
    }
    // pause() does not fire "ended" — resolve so the pump is not stuck forever.
    const finish = speakFinish;
    speakFinish = null;
    if (finish) finish(false);
    if (sharedAudio) releaseMediaEl(sharedAudio);
    clearHighlight();
  }

  /** Live (non-released) layer for a page id — used for highlight only. */
  function liveLayer(id: string): LayerRecord | null {
    for (const layer of layers) {
      if (layer.id === id && !layer.released) return layer;
    }
    return null;
  }

  function orderedVisibleLayers(): LayerRecord[] {
    const visible = Array.from(layers).filter((l) => l.visible && l.captions.length);
    // One page can be mounted more than once: a flipping leaf carries captions
    // on both faces while the settled slot underneath still has its own. Left
    // as duplicates the same page reads twice, and — worse — the leaf mounting
    // turns the key "5" into "5|5", which reads as a new view and restarts the
    // sequence from the top. Insertion order keeps the settled layer, since the
    // transient leaf always registers after the slot it covers.
    const byId = new Map<string, LayerRecord>();
    for (const layer of visible) {
      if (!byId.has(layer.id)) byId.set(layer.id, layer);
    }
    return Array.from(byId.values()).sort((a, b) => {
      const ra = a.getRect();
      const rb = b.getRect();
      if (!ra || !rb) return 0;
      // Rows first (vertical strip), then left→right (book spread).
      if (Math.abs(ra.top - rb.top) > 40) return ra.top - rb.top;
      return ra.left - rb.left;
    });
  }

  function schedule(): void {
    if (!enabled) return;
    // Do not queue play() while the finger is still flinging — iOS Safari
    // drops momentum when Audio construction/play hits the main thread.
    if (scrolling) return;
    if (settleTimer != null) clearTimeout(settleTimer);
    settleTimer = setTimeout(() => {
      settleTimer = null;
      if (scrolling) return;
      sync();
    }, SETTLE_MS);
  }

  /**
   * Vertical-strip scroll handler (call at most once per frame from the shell).
   * Pause audio once per fling — never stop/reset on every scroll event, and
   * never start play() until the finger has been idle long enough.
   */
  function notifyScroll(): void {
    if (!enabled) return;
    scrolling = true;
    if (settleTimer != null) {
      clearTimeout(settleTimer);
      settleTimer = null;
    }
    if (scrollIdleTimer != null) clearTimeout(scrollIdleTimer);
    // One hard-cut for the whole fling. Do not resetCoverage here: that forced
    // a full restart after every micro-pause and re-fired play() mid-scroll.
    if (!scrollPaused && (running || speakFinish || sharedAudio?.src)) {
      scrollPaused = true;
      stop();
    }
    scrollIdleTimer = setTimeout(() => {
      scrollIdleTimer = null;
      scrolling = false;
      scrollPaused = false;
      // Fresh view after a fling — re-evaluate whatever is on screen now.
      // Clear done/current only when we actually interrupted playback so a
      // fully-read page the user rests on is not re-spammed.
      if (currentKey && doneKey !== currentKey) {
        resetCoverage();
        doneKey = "";
      }
      // Media pipeline may recover after a rest; allow a few play attempts again.
      playFailStreak = 0;
      schedule();
    }, SCROLL_IDLE_MS);
  }

  /** Forget what has been read, so the next sync treats the view as new. */
  function resetCoverage(): void {
    currentKey = "";
    coveredIds = new Set();
    wantedIds = new Set();
  }

  /**
   * Mark layers visible from geometry when IntersectionObserver has not (yet)
   * reported — e.g. zero-size first paint under a dialog, or ratio below the
   * old 0.55 bar. Does not schedule; caller runs sync/schedule after.
   *
   * Fallback: if nothing intersects (dialogs, pre-layout), pick the topmost
   * captioned plate so page 1 still auto-reads without a user scroll.
   */
  function promoteVisibleFromRects(): void {
    if (typeof window === "undefined") return;
    const vh = window.innerHeight || 0;
    let anyVisible = false;
    let topmost: LayerRecord | null = null;
    let topmostY = Infinity;
    let firstById: LayerRecord | null = null;

    for (const layer of layers) {
      if (layer.released || !layer.captions.length) continue;
      if (!firstById || Number.parseInt(layer.id, 10) < Number.parseInt(firstById.id, 10)) {
        firstById = layer;
      }
      const r = layer.getRect();
      if (!r || r.width < 2 || r.height < 2) continue;
      if (r.top < topmostY) {
        topmostY = r.top;
        topmost = layer;
      }
      if (vh < 1) {
        layer.visible = true;
        anyVisible = true;
        continue;
      }
      const visibleH = Math.min(r.bottom, vh) - Math.max(r.top, 0);
      if (visibleH <= 0) continue;
      const ratio = visibleH / r.height;
      // Any meaningful on-screen slice, or ratio past the soft bar.
      if (ratio >= VISIBLE_RATIO || visibleH >= Math.min(120, vh * 0.35)) {
        layer.visible = true;
        anyVisible = true;
      }
    }

    if (!anyVisible) {
      const fallback = topmost || firstById;
      if (fallback) fallback.visible = true;
    }
  }

  /** Delayed re-sync after layout settles (unlock / dialog close). */
  function kickWhenIdle(ms: number): void {
    if (typeof window === "undefined") return;
    const t = window.setTimeout(() => {
      const i = kickTimers.indexOf(t);
      if (i >= 0) kickTimers.splice(i, 1);
      if (scrolling || !unlocked.value) return;
      kick();
    }, ms);
    kickTimers.push(t);
  }

  function jobsFrom(layersList: LayerRecord[]): PageJob[] {
    return layersList.map((l) => ({
      id: l.id,
      // Snapshot now: the component instance may unmount mid-sequence.
      captions: readingOrder(l.captions),
    }));
  }

  function parseKey(key: string): string[] {
    return key ? key.split("|").filter(Boolean) : [];
  }

  function isPureSuperset(nextIds: string[], prevIds: string[]): boolean {
    if (!prevIds.length || nextIds.length <= prevIds.length) return false;
    return prevIds.every((id) => nextIds.includes(id));
  }

  function isPureSubset(nextIds: string[], prevIds: string[]): boolean {
    if (!nextIds.length || nextIds.length >= prevIds.length) return false;
    return nextIds.every((id) => prevIds.includes(id));
  }

  function startJobs(jobs: PageJob[], key: string, ids: string[]): void {
    stop();
    playQueue = jobs;
    currentKey = key;
    coveredIds = new Set(ids);
    wantedIds = new Set(ids);
    doneKey = "";
    void pump(key);
  }

  function sync(): void {
    if (scrolling) return;
    // Don't thrash play() before the browser has a user gesture — on iOS that
    // spam + rejected promises can jank the main thread. Wait for unlock prompt.
    if (requireGesture && !unlocked.value) {
      maybeShowPrompt();
      return;
    }
    // IO may lag right after unlock; geometry is enough to start reading.
    if (!orderedVisibleLayers().length) promoteVisibleFromRects();
    const ordered = orderedVisibleLayers();
    if (!ordered.length) {
      // Mid-flip both halves can be below the threshold at once. Tearing the
      // sequence down then silences the rest of the spread, so only give up
      // when there is genuinely nothing mounted to read.
      if (running && layers.size) return;
      resetCoverage();
      stop();
      return;
    }
    const ids = ordered.map((l) => l.id);
    const key = ids.join("|");
    // Same pages, still reading (or already read) — leave it alone.
    if (key === currentKey && (running || doneKey === key)) return;

    const prevIds = parseKey(currentKey);
    const fresh = ordered.filter((l) => !coveredIds.has(l.id));

    // Pages leaving only (8|9 → 8 mid-flip): prune jobs for pages that left,
    // keep speaking whatever is still wanted. Do not restart the remaining half.
    if (prevIds.length && isPureSubset(ids, prevIds)) {
      currentKey = key;
      wantedIds = new Set(ids);
      playQueue = playQueue.filter((j) => wantedIds.has(j.id));
      // Keep coveredIds as-is so a page that briefly left cannot re-queue as fresh.
      return;
    }

    // Pure expansion by exactly one page (10 → 10|11): the missing half of a
    // spread landed after the left was already speaking. Append only — never
    // re-read the left. A jump that piles on two+ pages (rapid turn while the
    // old plate is still on screen) is navigation, not expansion.
    if (prevIds.length && isPureSuperset(ids, prevIds) && ids.length === prevIds.length + 1 && fresh.length === 1) {
      currentKey = key;
      coveredIds = new Set(ids);
      wantedIds = new Set(ids);
      const jobs = jobsFrom(fresh);
      if (running) {
        playQueue.push(...jobs);
        return;
      }
      // Left page already finished; just read the newcomer.
      playQueue = jobs;
      doneKey = "";
      void pump(key);
      return;
    }

    // Real navigation (or first paint). Hard-cut so rapid skips do not stack
    // every intermediate page onto the queue. Speak only pages that were not
    // already in the previous key — the plate the user left must go silent,
    // even if it is still on screen for a frame during the flip.
    const newcomers = prevIds.length ? ordered.filter((l) => !prevIds.includes(l.id)) : ordered;
    const toRead = newcomers.length ? newcomers : ordered;
    startJobs(jobsFrom(toRead), key, ids);
  }

  function speak(layer: LayerRecord | null, caption: AutoReadCaptionRef): Promise<boolean> {
    let el: HTMLAudioElement;
    try {
      el = getSharedAudio();
      // Reuse the shared element: pause + swap src. Full releaseMediaEl() here
      // (src="" + load) races decode on emulators and kills the first clip.
      try {
        el.pause();
      } catch {
        /* ignore */
      }
      configureMediaEl(el);
      // el.src is absolute; caption.audio may be absolute or relative.
      const abs = (() => {
        try {
          return new URL(caption.audio, typeof location !== "undefined" ? location.href : "http://local/").href;
        } catch {
          return caption.audio;
        }
      })();
      if (el.src !== abs) {
        el.src = caption.audio;
      } else {
        try {
          el.currentTime = 0;
        } catch {
          /* ignore */
        }
      }
    } catch {
      return Promise.resolve(false);
    }
    const v = Number(caption.volume);
    el.volume = Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 1;
    clearHighlight();
    if (layer) {
      speakingLayer = layer;
      layer.speakingIndex.value = caption.index;
    }
    speakAborted = false;

    return new Promise<boolean>((resolve) => {
      let done = false;
      let playStarted = false;
      let startTimer: ReturnType<typeof setTimeout> | null = null;
      let maxTimer: ReturnType<typeof setTimeout> | null = null;

      const finish = (ok: boolean): void => {
        if (done) return;
        done = true;
        if (startTimer != null) clearTimeout(startTimer);
        if (maxTimer != null) clearTimeout(maxTimer);
        if (speakFinish === finish) speakFinish = null;
        if (layer && layer.speakingIndex.value === caption.index) layer.speakingIndex.value = null;
        if (speakingLayer === layer) speakingLayer = null;
        // Keep the shared element; just stop playback. Full release happens in stop().
        try {
          el.pause();
        } catch {
          /* ignore */
        }
        resolve(ok);
      };
      speakFinish = finish;
      el.addEventListener("ended", () => finish(true), { once: true });
      // A broken clip must not stall the page — count it as read and move on.
      el.addEventListener("error", () => finish(true), { once: true });
      el.addEventListener(
        "playing",
        () => {
          playStarted = true;
          if (startTimer != null) {
            clearTimeout(startTimer);
            startTimer = null;
          }
        },
        { once: true }
      );

      // Emulator / flaky networks: never wait forever for ended/playing.
      maxTimer = setTimeout(() => finish(true), SPEAK_MAX_MS);
      startTimer = setTimeout(() => {
        if (!playStarted) finish(false);
      }, PLAY_START_MS);

      try {
        const p = el.play();
        if (p && typeof p.catch === "function") {
          p.catch(() => {
            // Aborted by stop()/scroll — not an autoplay failure.
            if (speakAborted || speakFinish !== finish) return;
            finish(false);
          });
        }
      } catch {
        finish(false);
      }
    });
  }

  async function pump(key: string): Promise<void> {
    // Caller has already put jobs in playQueue and bumped seq via stop() (or
    // we are a fresh start after stop). Claim this generation.
    const mySeq = seq;
    running = true;
    try {
      while (playQueue.length) {
        if (seq !== mySeq) return;
        if (scrolling) return;
        const job = playQueue.shift()!;
        // Page left the settled view (subset prune / rapid turn) — skip it.
        if (!wantedIds.has(job.id)) continue;
        for (const caption of job.captions) {
          if (seq !== mySeq) return;
          if (scrolling) return;
          if (!wantedIds.has(job.id)) break;
          const layer = liveLayer(job.id);
          const played = await speak(layer, caption);
          if (seq !== mySeq || speakAborted || scrolling) return;
          if (!played) {
            // Blocked by autoplay or media pipeline failure — bounded retry.
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

  /**
   * Autoplay / media blocked this view. Bounded retries only — unbounded
   * setTimeout(0) loops after a fling were freezing the page.
   */
  function armRetry(key: string): void {
    pendingRetryKey = key;
    if (unlocked.value) {
      playFailStreak++;
      if (playFailStreak > MAX_PLAY_FAILS) {
        // Give up until the user taps something (unlock path re-primes media).
        playFailStreak = 0;
        if (!retryArmed && typeof document !== "undefined") {
          retryArmed = true;
          document.addEventListener(
            "pointerdown",
            () => {
              retryArmed = false;
              unlockAudioFromGesture();
            },
            { once: true, capture: true }
          );
        }
        return;
      }
      if (failRetryTimer != null) clearTimeout(failRetryTimer);
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
    // Explain + offer one-click unlock (also keeps passive gesture listeners).
    maybeShowPrompt();
    if (retryArmed || typeof document === "undefined") return;
    retryArmed = true;
    document.addEventListener(
      "pointerdown",
      () => {
        retryArmed = false;
        unlockAudioFromGesture();
      },
      { once: true, capture: true }
    );
  }

  function registerLayer(opts: AutoReadLayerOptions): AutoReadLayerHandle {
    const record: LayerRecord = {
      id: opts.id,
      getRect: opts.getRect,
      captions: [],
      visible: false,
      released: false,
      speakingIndex: ref<number | null>(null),
    };
    layers.add(record);

    return {
      speakingIndex: record.speakingIndex,
      setVisible(visible: boolean): void {
        if (record.visible === visible) return;
        record.visible = visible;
        schedule();
      },
      setCaptions(captions: AutoReadCaptionRef[]): void {
        record.captions = captions;
        if (!captions.length) return;
        // Captions often land after OK (config fetch). Promote + schedule even
        // when IO has not marked the plate visible yet — otherwise auto-read
        // waits for a scroll forever on emulators.
        if (!record.visible && unlocked.value) promoteVisibleFromRects();
        if (record.visible || unlocked.value) schedule();
      },
      playOne(caption: AutoReadCaptionRef): void {
        // Bubble tap is a user gesture — unlock autoplay for later auto-read too.
        if (!unlocked.value) {
          unlocked.value = true;
          promptOpen.value = false;
          // Fire silent prime in the same gesture so subsequent page clips work.
          void primeHtmlAudioUnlock();
        }
        // The user took over this view — don't let it start reading itself again.
        stop();
        doneKey = currentKey;
        void speak(record, caption);
      },
      release(): void {
        layers.delete(record);
        record.released = true;
        record.visible = false;
        // Do not stop the sequence. The flip leaf unmounts while the settled
        // slot (same page id) is still there — killing audio here is what made
        // "first sound plays, then everything goes quiet" after a page turn.
        // Highlight dies with this DOM node; audio + queue keep going and the
        // next clip re-resolves a live layer by page id.
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

/** Reader shell creates the controller; caption layers inject it. */
export function provideAutoRead(options?: AutoReadOptions): AutoReadController {
  const controller = createAutoReadController(options);
  provide(AUTO_READ_KEY, controller);
  return controller;
}

export function useAutoReadController(): AutoReadController | null {
  return inject(AUTO_READ_KEY, null);
}
