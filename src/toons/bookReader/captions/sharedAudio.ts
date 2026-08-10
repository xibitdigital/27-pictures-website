/**
 * One shared HTMLAudioElement for FlipFrame caption auto-read.
 * Allocating a new Audio() per clip + rapid stop/start exhausts iOS media slots.
 */

/** Hard cap so a hung clip cannot freeze the queue forever. */
export const SPEAK_MAX_MS = 16000;
/** If play() neither starts nor rejects, fail open. */
export const PLAY_START_MS = 4000;

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

/** Release decoder buffers — required on iOS after rapid pause/src thrash. */
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

function resolveAbsUrl(url: string): string {
  try {
    return new URL(url, location.href).href;
  } catch {
    return url;
  }
}

export interface SharedAudioPlayer {
  busy: () => boolean;
  /** Stop in-flight speak (resolve false) and pause the element. */
  stopCurrent: () => void;
  /** stopCurrent + drop src/buffers. */
  release: () => void;
  speak: (url: string, volume: number) => Promise<boolean>;
}

export function createSharedAudioPlayer(): SharedAudioPlayer {
  let el: HTMLAudioElement | null = null;
  let speakFinish: ((ok: boolean) => void) | null = null;
  let aborted = false;

  function getEl(): HTMLAudioElement {
    if (!el) {
      el = new Audio();
      configureMediaEl(el);
    }
    return el;
  }

  function stopCurrent(): void {
    aborted = true;
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
  }

  function speak(url: string, volume: number): Promise<boolean> {
    const media = getEl();
    aborted = false;
    try {
      try {
        media.pause();
      } catch {
        /* ignore */
      }
      configureMediaEl(media);
      const abs = resolveAbsUrl(url);
      if (media.src !== abs) {
        media.src = url;
      } else {
        try {
          media.currentTime = 0;
        } catch {
          /* ignore */
        }
      }
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
        if (done) return;
        done = true;
        if (startTimer != null) clearTimeout(startTimer);
        if (maxTimer != null) clearTimeout(maxTimer);
        if (speakFinish === finish) speakFinish = null;
        try {
          media.pause();
        } catch {
          /* ignore */
        }
        resolve(ok);
      };
      speakFinish = finish;

      media.addEventListener("ended", () => finish(true), { once: true });
      media.addEventListener("error", () => finish(true), { once: true });
      media.addEventListener(
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

      maxTimer = setTimeout(() => finish(true), SPEAK_MAX_MS);
      startTimer = setTimeout(() => {
        if (!playStarted) finish(false);
      }, PLAY_START_MS);

      try {
        void media.play().catch(() => {
          if (aborted || speakFinish !== finish) return;
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
    speak,
  };
}
