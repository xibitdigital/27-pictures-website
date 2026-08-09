/**
 * Caption source for a toon: loads config.json once (shared fetch cache with
 * the page loader) and hands pages' `words[]` to the caption layers, plus the
 * language the reader is showing.
 */
import { computed, inject, provide, ref, type ComputedRef, type InjectionKey, type Ref } from "vue";
import { collectWordAudioUrls, preloadAudioUrls } from "../audio/preloadAudio";
import { loadWords } from "../words";
import type { LangCode, LangOption, ToonConfig, WordEntry } from "../types";

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

  function readStoredLang(): LangCode | null {
    try {
      const v = localStorage.getItem(options.langStorageKey);
      if (v && languages.value.some((l) => l.code === v)) return v;
    } catch {
      /* ignore */
    }
    return null;
  }

  function setLang(code: LangCode): void {
    if (!languages.value.some((l) => l.code === code)) return;
    lang.value = code;
    try {
      localStorage.setItem(options.langStorageKey, code);
    } catch {
      /* ignore */
    }
  }

  function wordsForPage(pageNum: number): WordEntry[] {
    const pages = config.value?.pages;
    if (!Array.isArray(pages)) return [];
    const page = pages[pageNum - 1];
    return Array.isArray(page?.words) ? (page.words as WordEntry[]) : [];
  }

  let pending: Promise<void> | null = null;
  function load(): Promise<void> {
    if (pending) return pending;
    pending = loadWords(options.configUrl, options.pageDir)
      .then((cfg) => {
        config.value = cfg;
        lang.value = readStoredLang() || cfg.defaultLang || "en";
        ready.value = true;
        if (options.preloadSfx !== false) void preloadAudioUrls(collectWordAudioUrls(cfg));
      })
      .catch((err) => {
        // A missing/broken config must not take the reader down — pages still turn.
        console.error(err);
      });
    return pending;
  }

  return { ready, lang, languages, designWidth, designHeight, fontFamily, wordsForPage, setLang, load };
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
