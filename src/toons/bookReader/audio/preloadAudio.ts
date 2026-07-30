/**
 * Warm browser cache / decoder for toon SFX + music so first play is snappy.
 * One-shot SFX still use a fresh `new Audio(url)` for overlap; preloading
 * fills HTTP cache and keeps a silent element at canplaythrough when possible.
 */
import type { WordsConfig } from "../types";

const cache = new Map<string, HTMLAudioElement>();

/** HAVE_FUTURE_DATA — enough data to play forward a bit (see HTMLMediaElement). */
const READY_ENOUGH = 3;

/** Unique non-empty `audio` paths from toon config page captions. */
export function collectWordAudioUrls(config: WordsConfig | null | undefined): string[] {
  const urls = new Set<string>();
  const pages = config?.pages;
  if (!Array.isArray(pages)) return [];
  for (const page of pages) {
    const entries = page?.words;
    if (!Array.isArray(entries)) continue;
    for (const w of entries) {
      const src = w?.audio;
      if (typeof src === "string" && src.trim()) urls.add(src.trim());
    }
  }
  return [...urls];
}

/** Whether a URL is already held in the preload cache (tests / diagnostics). */
export function isAudioPreloaded(url: string): boolean {
  return cache.has(url);
}

/** Drop cache (tests only). */
export function clearAudioPreloadCache(): void {
  cache.clear();
}

/**
 * Start loading one URL. Resolves on canplaythrough or error (never rejects).
 * Idempotent — reuses an in-flight / finished entry for the same URL.
 */
export function preloadAudioUrl(url: string): Promise<void> {
  if (!url || typeof window === "undefined") return Promise.resolve();

  const existing = cache.get(url);
  if (existing) return waitForAudio(existing);

  const audio = new Audio();
  audio.preload = "auto";
  audio.src = url;
  cache.set(url, audio);

  try {
    audio.load();
  } catch {
    /* ignore */
  }

  return waitForAudio(audio);
}

function waitForAudio(audio: HTMLAudioElement): Promise<void> {
  if ((audio.readyState ?? 0) >= READY_ENOUGH) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const done = () => resolve();
    audio.addEventListener("canplaythrough", done, { once: true });
    audio.addEventListener("error", done, { once: true });
  });
}

/**
 * Preload many URLs with limited concurrency (default 6).
 * Dedupes, skips empties, never rejects.
 */
export async function preloadAudioUrls(urls: Iterable<string>, opts: { concurrency?: number } = {}): Promise<void> {
  const list = [...new Set([...urls].filter((u) => typeof u === "string" && u.trim()))];
  if (!list.length) return;

  const concurrency = Math.max(1, opts.concurrency ?? 6);
  let index = 0;

  async function worker(): Promise<void> {
    while (index < list.length) {
      const url = list[index++];
      await preloadAudioUrl(url);
    }
  }

  const n = Math.min(concurrency, list.length);
  await Promise.all(Array.from({ length: n }, () => worker()));
}
