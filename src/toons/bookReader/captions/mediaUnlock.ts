/**
 * Browser autoplay unlock for FlipFrame captions.
 * iOS Safari needs a real HTMLAudioElement.play() inside a user gesture;
 * AudioContext.resume() alone is not enough.
 *
 * Prefer SharedAudioPlayer.unlockFromGesture() so the **same** element used
 * for caption speak() is unlocked. This helper is a fallback for paths that
 * only need a one-shot prime.
 */

import { configureMediaEl, SILENT_WAV } from "./sharedAudio";

export { SILENT_WAV } from "./sharedAudio";

/** Play silent HTMLAudio on the gesture stack. Never rejects. */
export function primeHtmlAudioUnlock(): Promise<void> {
  try {
    const el = new Audio(SILENT_WAV);
    configureMediaEl(el);
    el.volume = 0.01;
    return el
      .play()
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
  } catch {
    /* ignore */
  }
  return Promise.resolve();
}

/** Extra sticky-activation path for Web Audio (does not alone unlock HTMLAudio). */
export function resumeAudioContext(): Promise<void> {
  type Ctx = {
    resume: () => Promise<void>;
    close: () => Promise<void>;
    createBuffer?: (channels: number, length: number, sampleRate: number) => { length: number };
    createBufferSource?: () => {
      buffer: unknown;
      connect: (dest: unknown) => void;
      start: (when?: number) => void;
    };
    destination?: unknown;
  };
  type CtxCtor = new () => Ctx;
  const AC =
    (window as unknown as { AudioContext?: CtxCtor }).AudioContext ||
    (window as unknown as { webkitAudioContext?: CtxCtor }).webkitAudioContext;
  if (!AC) return Promise.resolve();
  try {
    const ctx = new AC();
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

/** Fire both unlock signals while still on the user-gesture stack. */
export function unlockMediaFromGesture(): void {
  void primeHtmlAudioUnlock();
  void resumeAudioContext();
}
