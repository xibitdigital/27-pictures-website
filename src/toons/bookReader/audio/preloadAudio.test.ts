import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  collectWordAudioUrls,
  clearAudioPreloadCache,
  isAudioPreloaded,
  preloadAudioUrl,
  preloadAudioUrls,
} from "./preloadAudio";
import type { WordsConfig } from "../types";

/** Minimal Audio mock with EventTarget + readyState. */
function mockAudio(opts: { readyState?: number; fail?: boolean } = {}) {
  const listeners = new Map<string, Set<() => void>>();
  const readyState = opts.readyState ?? 0;

  return function MockAudio(this: Record<string, unknown>) {
    this.preload = "";
    this.src = "";
    this.readyState = readyState;
    this.load = vi.fn(() => {
      if (opts.fail) {
        queueMicrotask(() => {
          listeners.get("error")?.forEach((fn) => fn());
        });
      } else if (readyState < 3) {
        queueMicrotask(() => {
          this.readyState = 4;
          listeners.get("canplaythrough")?.forEach((fn) => fn());
        });
      }
    });
    this.addEventListener = (type: string, fn: () => void) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    };
    this.removeEventListener = (type: string, fn: () => void) => {
      listeners.get(type)?.delete(fn);
    };
    return this;
  } as unknown as typeof Audio;
}

describe("collectWordAudioUrls", () => {
  it("returns unique non-empty audio paths", () => {
    const config: WordsConfig = {
      pages: {
        "1": [
          { audio: "assets/sfx/a.mp3", text: "A" },
          { audio: "assets/sfx/a.mp3", text: "A2" },
          { text: "silent" },
          { audio: "  assets/sfx/b.mp3  ", text: "B" },
          { audio: "", text: "empty" },
        ],
        "2": [{ audio: "assets/sfx/c.mp3", text: "C" }],
      },
    };
    expect(collectWordAudioUrls(config).sort()).toEqual([
      "assets/sfx/a.mp3",
      "assets/sfx/b.mp3",
      "assets/sfx/c.mp3",
    ]);
  });

  it("handles missing pages", () => {
    expect(collectWordAudioUrls(undefined)).toEqual([]);
    expect(collectWordAudioUrls({})).toEqual([]);
  });
});

describe("preloadAudioUrl / preloadAudioUrls", () => {
  beforeEach(() => {
    clearAudioPreloadCache();
  });

  afterEach(() => {
    clearAudioPreloadCache();
    vi.restoreAllMocks();
  });

  it("creates an Audio element with preload=auto and caches it", async () => {
    vi.spyOn(window, "Audio").mockImplementation(mockAudio({ readyState: 4 }));

    await preloadAudioUrl("assets/sfx/x.mp3");

    expect(window.Audio).toHaveBeenCalled();
    expect(isAudioPreloaded("assets/sfx/x.mp3")).toBe(true);

    const calls = (window.Audio as unknown as ReturnType<typeof vi.fn>).mock.calls.length;
    await preloadAudioUrl("assets/sfx/x.mp3");
    expect((window.Audio as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(
      calls
    );
  });

  it("resolves on error without rejecting", async () => {
    vi.spyOn(window, "Audio").mockImplementation(mockAudio({ fail: true }));

    await expect(preloadAudioUrl("missing.mp3")).resolves.toBeUndefined();
    expect(isAudioPreloaded("missing.mp3")).toBe(true);
  });

  it("dedupes and preloads a batch", async () => {
    const seen: string[] = [];
    vi.spyOn(window, "Audio").mockImplementation(function (this: {
      preload: string;
      src: string;
      readyState: number;
      load: () => void;
      addEventListener: () => void;
    }) {
      this.preload = "auto";
      this.src = "";
      this.readyState = 4;
      this.load = () => {
        seen.push(this.src);
      };
      this.addEventListener = () => {};
      return this;
    } as unknown as typeof Audio);

    await preloadAudioUrls(["a.mp3", "b.mp3", "a.mp3", "", "c.mp3"]);

    expect(seen.sort()).toEqual(["a.mp3", "b.mp3", "c.mp3"]);
  });

  it("waits for canplaythrough when not yet ready", async () => {
    vi.spyOn(window, "Audio").mockImplementation(mockAudio({ readyState: 0 }));
    await expect(preloadAudioUrl("slow.mp3")).resolves.toBeUndefined();
    expect(isAudioPreloaded("slow.mp3")).toBe(true);
  });
});
