/**
 * Vue composable for book vs vertical-scroll mode.
 * UI state only — the strip is a VerticalStrip component (no createElement).
 */
import { onMounted, ref, type Ref } from "vue";
import { loadConfigPages } from "./loadConfig";

export const MOBILE_MAX_WIDTH = 768;

export function prefersMobileScroll(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH}px)`).matches;
}

export interface UseViewModeOptions {
  /** Default true — start in scroll mode under 768px. */
  mobileDefault?: boolean;
  onEnterBook?: () => void;
  onEnterScroll?: () => void;
  /** Optional reader element to scroll to top when entering vertical mode. */
  reader?: Ref<HTMLElement | null | undefined>;
  /**
   * Shared page loader (e.g. createConfigLoader). When set, book + strip
   * share one fetch. Default: loadConfigPages.
   */
  loadPages?: (url?: string) => Promise<string[]>;
  configUrl?: string;
  /** @deprecated Use configUrl */
  manifestUrl?: string;
}

export interface UseViewModeApi {
  isVertical: Ref<boolean>;
  pages: Ref<string[]>;
  setVertical: (on: boolean) => Promise<void>;
  toggle: () => Promise<void>;
  loadPages: (configUrl?: string) => Promise<void>;
}

export function useViewMode(opts: UseViewModeOptions = {}): UseViewModeApi {
  const mobileDefault = opts.mobileDefault !== false;
  const isVertical = ref(false);
  const pages = ref<string[]>([]);
  const defaultUrl = opts.configUrl || opts.manifestUrl;
  const resolvePages =
    opts.loadPages ??
    ((url?: string) => {
      const u = url || defaultUrl;
      if (!u) return Promise.reject(new Error("useViewMode: configUrl is required"));
      return loadConfigPages(u);
    });

  async function loadPages(configUrl?: string): Promise<void> {
    const u = configUrl || defaultUrl;
    if (!u && !opts.loadPages) {
      throw new Error("useViewMode: configUrl is required");
    }
    pages.value = await resolvePages(u);
  }

  async function setVertical(on: boolean): Promise<void> {
    isVertical.value = !!on;
    document.body.classList.toggle("view-vertical", isVertical.value);

    if (isVertical.value) {
      if (!pages.value.length) {
        try {
          await loadPages();
        } catch (err) {
          console.error(err);
        }
      }
      const reader = opts.reader?.value;
      if (reader) reader.scrollTop = 0;
      window.scrollTo(0, 0);
      opts.onEnterScroll?.();
    } else {
      opts.onEnterBook?.();
    }
  }

  onMounted(() => {
    if (mobileDefault && prefersMobileScroll()) {
      void setVertical(true);
    }
  });

  return {
    isVertical,
    pages,
    setVertical,
    toggle: () => setVertical(!isVertical.value),
    loadPages,
  };
}
