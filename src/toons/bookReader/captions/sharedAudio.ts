/**
 * One shared HTMLAudioElement for FlipFrame caption auto-read.
 *
 * iOS Safari unlock is sticky on the **same** HTMLMediaElement that received a
 * gesture-time play(). Destroying that node on every scroll (release → new
 * Audio) makes post-scroll auto-read silent until the next tap. Keep one
 * element for the controller lifetime; only hard-drop it on full stop().
 */

/** Hard cap so a hung clip cannot freeze the queue forever. */
export const SPEAK_MAX_MS = 16000;
/** If play() neither starts nor rejects, fail open. */
export const PLAY_START_MS = 4000;

/**
 * Tiny silent WAV (data URI). CSP media-src allows data: on the site.
 * Used to sticky-unlock the shared element on a real user gesture.
 */
export const SILENT_WAV = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.max(0, Math.min(1, n));
}

/** iOS needs playsinline on every element that will call play(). */
export function configureMediaEl(el: HTMLAudioElement): void {
  el.preload = "auto";
  try {
    el.setAttribute("playsinline", "true");
    el.setAttribute("webkit-playsinline", "true");
    (el as HTMLAudioElement & { playsInline?: boolean }).playsInline = true;
  } catch {
    /* ignore */
  }
}

/** Clear src/buffers without discarding the element (keeps iOS unlock). */
export function releaseMediaEl(el: HTMLAudioElement): void {
  try {
    el.pause();
  } catch {
    /* ignore */
  }
  try {
    el.removeAttribute("src");
    el.src = "";
    el.load();
  } catch {
    /* ignore */
  }
}

export interface SharedAudioPlayer {
  busy: () => boolean;
  /** Stop in-flight speak (resolve false) and pause the element. */
  stopCurrent: () => void;
  /**
   * stopCurrent + clear src/buffers. Keeps the same HTMLAudioElement so iOS
   * gesture unlock survives scroll pauses.
   */
  release: () => void;
  /**
   * Full teardown (controller stop). Next speak() allocates a new element.
   */
  destroy: () => void;
  /**
   * Play a silent clip on the shared element during a user gesture so later
   * async speak() calls stay allowed on iOS Safari.
   */
  unlockFromGesture: () => Promise<void>;
  speak: (url: string, volume: number) => Promise<boolean>;
}

export function createSharedAudioPlayer(): SharedAudioPlayer {
  let el: HTMLAudioElement | null = null;
  let speakFinish: ((ok: boolean) => void) | null = null;
  let aborted = false;
  /** Bump to invalidate in-flight event handlers after stop/next clip. */
  let speakGen = 0;

  function getEl(): HTMLAudioElement {
    if (!el) {
      el = new Audio();
      configureMediaEl(el);
    }
    return el;
  }

  function stopCurrent(): void {
    aborted = true;
    speakGen++;
    const finish = speakFinish;
    speakFinish = null;
    if (finish) finish(false);
    if (el) {
      try {
        el.pause();
      } catch {
        /* ignore */
      }
    }
  }

  function release(): void {
    stopCurrent();
    if (el) releaseMediaEl(el);
    // Keep `el` — iOS unlock is tied to this node.
  }

  function destroy(): void {
    stopCurrent();
    if (el) {
      releaseMediaEl(el);
      el = null;
    }
  }

  async function unlockFromGesture(): Promise<void> {
    const media = getEl();
    configureMediaEl(media);
    try {
      media.pause();
    } catch {
      /* ignore */
    }
    try {
      media.src = SILENT_WAV;
      media.volume = 0.01;
      await media.play();
    } catch {
      /* ignore — still better than nothing */
    }
    try {
      media.pause();
    } catch {
      /* ignore */
    }
    // Leave a clean pipeline; do not drop the element.
    releaseMediaEl(media);
  }

  function speak(url: string, volume: number): Promise<boolean> {
    const media = getEl();
    aborted = false;
    const gen = ++speakGen;

    try {
      try {
        media.pause();
      } catch {
        /* ignore */
      }
      configureMediaEl(media);
      // Assign src only — do NOT call load() after. src= already starts the
      // resource fetch; an extra load() aborts it and makes the following
      // play() reject (bubble tap fails silently on the user-gesture stack).
      if (media.src) {
        try {
          media.removeAttribute("src");
          media.load();
        } catch {
          /* ignore */
        }
      }
      media.src = url;
      media.volume = clamp01(Number(volume));
    } catch {
      return Promise.resolve(false);
    }

    return new Promise<boolean>((resolve) => {
      let done = false;
      let playStarted = false;
      let startTimer: ReturnType<typeof setTimeout> | null = null;
      let maxTimer: ReturnType<typeof setTimeout> | null = null;

      const finish = (ok: boolean): void => {
        if (done || gen !== speakGen) return;
        done = true;
        if (startTimer != null) clearTimeout(startTimer);
        if (maxTimer != null) clearTimeout(maxTimer);
        media.removeEventListener("ended", onEnded);
        media.removeEventListener("error", onError);
        media.removeEventListener("playing", onPlaying);
        media.removeEventListener("play", onPlaying);
        if (speakFinish === finish) speakFinish = null;
        try {
          media.pause();
        } catch {
          /* ignore */
        }
        resolve(ok);
      };

      const onEnded = (): void => finish(true);
      const onError = (): void => finish(true);
      const onPlaying = (): void => {
        playStarted = true;
        if (startTimer != null) {
          clearTimeout(startTimer);
          startTimer = null;
        }
      };

      speakFinish = finish;
      // Listeners before play() so short/cached clips cannot race past them.
      media.addEventListener("ended", onEnded);
      media.addEventListener("error", onError);
      media.addEventListener("playing", onPlaying);
      media.addEventListener("play", onPlaying);

      maxTimer = setTimeout(() => finish(true), SPEAK_MAX_MS);
      startTimer = setTimeout(() => {
        if (!playStarted) finish(false);
      }, PLAY_START_MS);

      try {
        // play() resolves when playback *starts* — more reliable than the
        // "playing" event alone (some book-mode paths never fire it).
        void media
          .play()
          .then(() => {
            if (gen !== speakGen) return;
            onPlaying();
          })
          .catch(() => {
            if (aborted || gen !== speakGen || speakFinish !== finish) return;
            finish(false);
          });
      } catch {
        finish(false);
      }
    });
  }

  return {
    busy: () => speakFinish != null,
    stopCurrent,
    release,
    destroy,
    unlockFromGesture,
    speak,
  };
}
