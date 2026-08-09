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

/** Coalesce the two halves of a spread — they become visible a frame apart. */
const SETTLE_MS = 220;
/** Hard cap so a hung clip (no `ended` on flaky mobile WebViews) cannot freeze the queue. */
const SPEAK_MAX_MS = 16000;
/** If play() neither starts nor rejects (some emulator WebViews), fail open. */
const PLAY_START_MS = 4000;
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

export function createAutoReadController(options: AutoReadOptions = {}): AutoReadController {
  // Default gap was 2000ms — felt "stuck" between lines on mobile emulators.
  const gapMs = options.gapMs != null ? Number(options.gapMs) : 600;
  const enabled = options.enabled !== false;
  const requireGesture = options.requireGesture !== false;

  const layers = new Set<LayerRecord>();
  let settleTimer: ReturnType<typeof setTimeout> | null = null;
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
  let audio: HTMLAudioElement | null = null;
  let speakingLayer: LayerRecord | null = null;
  /** Resolves the in-flight `speak()` when stop() aborts it. */
  let speakFinish: ((ok: boolean) => void) | null = null;
  let retryArmed = false;
  /** Key to re-read once unlock lands (autoplay was blocked). */
  let pendingRetryKey = "";
  const unlocked = ref(false);
  const promptOpen = ref(false);
  /** User closed the prompt with “Not now” — don’t nag again this load. */
  let promptSoftDismissed = false;
  /** Coalesce double unlock (OK click = pointerdown + enableFromPrompt). */
  let restartTimer: ReturnType<typeof setTimeout> | null = null;

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
   */
  function unlockAudioFromGesture(): void {
    const alreadyUnlocked = unlocked.value;
    unlocked.value = true;
    promptOpen.value = false;
    retryArmed = false;

    const restart = (): void => {
      // pointerdown + OK click both unlock — one restart after the burst.
      if (restartTimer != null) clearTimeout(restartTimer);
      restartTimer = setTimeout(() => {
        restartTimer = null;
        pendingRetryKey = "";
        // Force-cut any hung speak/gap so unlock always recovers the reader
        // (emulators sometimes never fire "ended", leaving running=true forever).
        stop();
        // Coverage must clear: a blocked attempt marked pages covered with nothing
        // spoken, and sync would skip them as "nothing fresh".
        resetCoverage();
        sync();
      }, 40);
    };

    if (alreadyUnlocked) {
      // Re-prime on repeat gestures (iOS can re-lock after long background).
      void primeHtmlAudioUnlock().then(() => restart());
      return;
    }

    // Start both unlocks while still on the user-gesture stack. play() must be
    // invoked synchronously here; awaiting only comes after.
    const htmlPrime = primeHtmlAudioUnlock();
    const acPrime = resumeAudioContext();
    void Promise.all([htmlPrime, acPrime]).then(() => restart());
  }

  function enableFromPrompt(): void {
    // Must run in the click handler so the browser treats it as a user gesture.
    unlockAudioFromGesture();
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
    const a = audio;
    audio = null;
    if (a) {
      try {
        a.pause();
      } catch {
        /* ignore */
      }
    }
    // pause() does not fire "ended" — resolve so the pump is not stuck forever.
    const finish = speakFinish;
    speakFinish = null;
    if (finish) finish(false);
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
    if (settleTimer != null) clearTimeout(settleTimer);
    settleTimer = setTimeout(() => {
      settleTimer = null;
      sync();
    }, SETTLE_MS);
  }

  /** Forget what has been read, so the next sync treats the view as new. */
  function resetCoverage(): void {
    currentKey = "";
    coveredIds = new Set();
    wantedIds = new Set();
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
    // Don't thrash play() before the browser has a user gesture — on iOS that
    // spam + rejected promises can jank the main thread. Wait for unlock prompt.
    if (requireGesture && !unlocked.value) {
      maybeShowPrompt();
      return;
    }
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
      el = new Audio(caption.audio);
    } catch {
      return Promise.resolve(false);
    }
    const v = Number(caption.volume);
    el.volume = Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 1;
    // Helps mobile/emulator decode start without waiting for a full buffer.
    // playsinline is required for reliable HTMLAudio on iOS Safari.
    configureMediaEl(el);
    audio = el;
    clearHighlight();
    if (layer) {
      speakingLayer = layer;
      layer.speakingIndex.value = caption.index;
    }

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
        if (audio === el) audio = null;
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
        if (p && typeof p.catch === "function") p.catch(() => finish(false));
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
        const job = playQueue.shift()!;
        // Page left the settled view (subset prune / rapid turn) — skip it.
        if (!wantedIds.has(job.id)) continue;
        for (const caption of job.captions) {
          if (seq !== mySeq) return;
          if (!wantedIds.has(job.id)) break;
          const layer = liveLayer(job.id);
          const played = await speak(layer, caption);
          if (seq !== mySeq) return;
          if (!played) {
            // Blocked by the autoplay policy — wait for unlock (or retry if
            // unlock already happened in a race with settle).
            armRetry(key);
            return;
          }
          if (gapMs > 0) {
            await new Promise<void>((resolve) => setTimeout(resolve, gapMs));
            if (seq !== mySeq) return;
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
   * Autoplay blocked this view. Remember it and rely on armGestureUnlock (or a
   * late gesture if unlock already ran) to restart — no second special tap on
   * the plate beyond the normal first interaction with the reader.
   */
  function armRetry(key: string): void {
    pendingRetryKey = key;
    if (unlocked.value) {
      // Unlock already happened; re-try next tick (settle / silent-play race).
      setTimeout(() => {
        if (running || (currentKey !== key && pendingRetryKey !== key)) return;
        pendingRetryKey = "";
        resetCoverage();
        sync();
      }, 0);
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
        if (record.visible) schedule();
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
