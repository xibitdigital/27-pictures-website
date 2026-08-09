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
  /** Silence after each clip, in ms. Default 2000. */
  gapMs?: number;
  /** Turn the whole feature off (kept for tests / opt-out). */
  enabled?: boolean;
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
}

/** Coalesce the two halves of a spread — they become visible a frame apart. */
const SETTLE_MS = 220;

export function createAutoReadController(options: AutoReadOptions = {}): AutoReadController {
  const gapMs = options.gapMs != null ? Number(options.gapMs) : 2000;
  const enabled = options.enabled !== false;

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

  function clearHighlight(): void {
    if (speakingLayer) speakingLayer.speakingIndex.value = null;
    speakingLayer = null;
  }

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
    audio = el;
    clearHighlight();
    if (layer) {
      speakingLayer = layer;
      layer.speakingIndex.value = caption.index;
    }

    return new Promise<boolean>((resolve) => {
      let done = false;
      const finish = (ok: boolean): void => {
        if (done) return;
        done = true;
        if (speakFinish === finish) speakFinish = null;
        if (layer && layer.speakingIndex.value === caption.index) layer.speakingIndex.value = null;
        if (speakingLayer === layer) speakingLayer = null;
        if (audio === el) audio = null;
        resolve(ok);
      };
      speakFinish = finish;
      el.addEventListener("ended", () => finish(true), { once: true });
      // A broken clip must not stall the page — count it as read and move on.
      el.addEventListener("error", () => finish(true), { once: true });
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
            // Blocked by the autoplay policy — retry after the first gesture.
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

  /** One-shot: the first user gesture unblocks audio, so try this view again. */
  function armRetry(key: string): void {
    if (retryArmed || typeof document === "undefined") return;
    retryArmed = true;
    document.addEventListener(
      "pointerdown",
      () => {
        retryArmed = false;
        // A tap on a caption plays that caption instead — it stops us first.
        setTimeout(() => {
          if (running || currentKey !== key) return;
          // Coverage has to go too, not just the key: these pages were marked
          // covered by the attempt that autoplay blocked, and `sync` skips a
          // view with nothing fresh in it — so clearing the key alone left the
          // retry a no-op and nothing ever spoke.
          resetCoverage();
          sync();
        }, 0);
      },
      { once: true }
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

  return { registerLayer, stop };
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
