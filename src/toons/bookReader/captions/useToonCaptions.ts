/**
 * Caption source for a toon: loads config.json once (shared fetch cache with
 * the page loader) and hands pages' `words[]` to the caption layers, plus the
 * language the reader is showing.
 */
import { computed, inject, provide, ref, type ComputedRef, type InjectionKey, type Ref } from "vue";
import { collectWordAudioUrls, preloadAudioUrls } from "../audio/preloadAudio";
import { loadWords } from "../words";
import type { LangCode, LangOption, ToonConfig, WordEntry } from "../types";

/** Written by the toons landing page (`rememberDocumentLocale`). Same strings. */
const SITE_LOCALE_KEY = "27p-locale";
const SITE_LOCALE_AT = "27p-locale-at";

export interface ToonCaptionsOptions {
  /** Already-resolved config URL (same one the shell fetches pages from). */
  configUrl: string;
  /** Site directory for relative media paths under VITE_ASSET_BASE. */
  pageDir?: string;
  /** localStorage key for the caption language. */
  langStorageKey: string;
  /** Preload caption SFX after the config lands. Default true. */
  preloadSfx?: boolean;
}

export interface ToonCaptionsStore {
  ready: Ref<boolean>;
  lang: Ref<LangCode>;
  languages: ComputedRef<LangOption[]>;
  designWidth: ComputedRef<number>;
  designHeight: ComputedRef<number>;
  fontFamily: ComputedRef<string>;
  wordsForPage: (pageNum: number) => WordEntry[];
  /** Warm the browser cache for one page's caption audio (idempotent). */
  warmPageAudio: (pageNum: number) => void;
  setLang: (code: LangCode) => void;
  load: () => Promise<void>;
}

const DEFAULT_LANGUAGES: LangOption[] = [
  { code: "en", label: "EN" },
  { code: "it", label: "IT" },
  { code: "de", label: "DE" },
  { code: "fr", label: "FR" },
];

export function createToonCaptions(options: ToonCaptionsOptions): ToonCaptionsStore {
  const config = ref<ToonConfig | null>(null);
  const ready = ref(false);
  const lang = ref<LangCode>("en");

  const languages = computed<LangOption[]>(() => config.value?.languages || DEFAULT_LANGUAGES);
  const designWidth = computed(() => Number(config.value?.designWidth) || 1008);
  const designHeight = computed(() => Number(config.value?.designHeight) || 1792);
  const fontFamily = computed(() => config.value?.fontFamily || '"Bangers", cursive');

  /** The page's own language, when this book has captions in it. */
  function pageLang(available: LangOption[]): LangCode | null {
    if (typeof document === "undefined") return null;
    const code = document.documentElement.getAttribute("lang")?.slice(0, 2).toLowerCase();
    return code && available.some((l) => l.code === code) ? (code as LangCode) : null;
  }

  function pickAvailable(code: string | null | undefined, available: LangOption[]): LangCode | null {
    const v = code?.slice(0, 2).toLowerCase();
    return v && available.some((l) => l.code === v) ? (v as LangCode) : null;
  }

  function readStamp(key: string): number {
    try {
      const n = Number(localStorage.getItem(key));
      return Number.isFinite(n) ? n : 0;
    } catch {
      return 0;
    }
  }

  function persistLang(code: LangCode): void {
    try {
      localStorage.setItem(options.langStorageKey, code);
      localStorage.setItem(`${options.langStorageKey}-at`, String(Date.now()));
    } catch {
      /* ignore */
    }
  }

  function readStoredLang(): LangCode | null {
    try {
      return pickAvailable(localStorage.getItem(options.langStorageKey), languages.value);
    } catch {
      return null;
    }
  }

  function readLandingLang(available: LangOption[]): LangCode | null {
    try {
      return pickAvailable(localStorage.getItem(SITE_LOCALE_KEY), available);
    } catch {
      return null;
    }
  }

  function readQueryLang(available: LangOption[]): LangCode | null {
    if (typeof window === "undefined") return null;
    try {
      return pickAvailable(new URLSearchParams(window.location.search).get("lang"), available);
    } catch {
      return null;
    }
  }

  function setLang(code: LangCode): void {
    if (!languages.value.some((l) => l.code === code)) return;
    lang.value = code;
    persistLang(code);
  }

  function wordsForPage(pageNum: number): WordEntry[] {
    const pages = config.value?.pages;
    if (!Array.isArray(pages)) return [];
    const page = pages[pageNum - 1];
    return Array.isArray(page?.words) ? (page.words as WordEntry[]) : [];
  }

  /** Pages whose caption audio has been handed to the preloader. */
  const warmedAudioPages = new Set<number>();

  /**
   * Warm one page's clips as that page is painted. Loading the whole book's
   * SFX after the config used to put ~100 mp3 requests in front of the plates
   * on a cold open; a clip outside the warmed pages still plays — playback
   * fetches on demand — just without the head start.
   */
  function warmPageAudio(pageNum: number): void {
    if (options.preloadSfx === false) return;
    if (warmedAudioPages.has(pageNum)) return;
    const urls = collectWordAudioUrls(wordsForPage(pageNum));
    if (!urls.length) return;
    warmedAudioPages.add(pageNum);
    void preloadAudioUrls(urls);
  }

  let pending: Promise<void> | null = null;
  function load(): Promise<void> {
    if (pending) return pending;
    pending = loadWords(options.configUrl, options.pageDir)
      .then((cfg) => {
        config.value = cfg;
        const available = languages.value;
        // A fresh visit to /fr/toons/ is a newer choice than last week's
        // English switcher setting. A switcher change *after* that visit
        // still wins on reload, because it carries a later timestamp.
        // `?lang=` is this navigation and always wins.
        const query = readQueryLang(available);
        const stored = readStoredLang();
        const landing = readLandingLang(available);
        const storedAt = readStamp(`${options.langStorageKey}-at`);
        const landingAt = readStamp(SITE_LOCALE_AT);
        const chosen =
          query ||
          (stored && storedAt >= landingAt ? stored : null) ||
          landing ||
          stored ||
          pageLang(available) ||
          cfg.defaultLang ||
          "en";
        lang.value = chosen;
        if (query) persistLang(query);
        ready.value = true;
        // Caption audio is warmed per page (warmPageAudio) as pages paint,
        // not all at once here — see that function's comment.
      })
      .catch((err) => {
        // A missing/broken config must not take the reader down — pages still turn.
        console.error(err);
      });
    return pending;
  }

  return { ready, lang, languages, designWidth, designHeight, fontFamily, wordsForPage, warmPageAudio, setLang, load };
}

export const TOON_CAPTIONS_KEY: InjectionKey<ToonCaptionsStore> = Symbol("flipframe-captions");

/** Reader shell provides the store; layers and the language switcher inject it. */
export function provideToonCaptions(options: ToonCaptionsOptions): ToonCaptionsStore {
  const store = createToonCaptions(options);
  provide(TOON_CAPTIONS_KEY, store);
  return store;
}

export function useToonCaptions(): ToonCaptionsStore | null {
  return inject(TOON_CAPTIONS_KEY, null);
}
