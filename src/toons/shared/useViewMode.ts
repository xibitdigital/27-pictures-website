/**
 * Vue composable for book vs vertical-scroll mode.
 * UI state only — the strip is a VerticalStrip component (no createElement).
 */
import { onMounted, ref, type Ref } from "vue";

export const MOBILE_MAX_WIDTH = 768;

export function prefersMobileScroll(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH}px)`).matches
  );
}

export interface UseViewModeOptions {
  /** Default true — start in scroll mode under 768px. */
  mobileDefault?: boolean;
  onEnterBook?: () => void;
  onEnterScroll?: () => void;
  /** Optional reader element to scroll to top when entering vertical mode. */
  reader?: Ref<HTMLElement | null | undefined>;
}

export interface UseViewModeApi {
  isVertical: Ref<boolean>;
  pages: Ref<string[]>;
  setVertical: (on: boolean) => Promise<void>;
  toggle: () => Promise<void>;
  loadPages: (manifestUrl?: string) => Promise<void>;
}

export function useViewMode(opts: UseViewModeOptions = {}): UseViewModeApi {
  const mobileDefault = opts.mobileDefault !== false;
  const isVertical = ref(false);
  const pages = ref<string[]>([]);

  async function loadPages(manifestUrl = "manifest.json"): Promise<void> {
    const res = await fetch(manifestUrl, { cache: "no-cache" });
    if (!res.ok) throw new Error("manifest " + res.status);
    const manifest = (await res.json()) as { files?: string[]; pages?: number; pattern?: string };
    if (Array.isArray(manifest.files) && manifest.files.length) {
      pages.value = manifest.files.map(String);
      return;
    }
    const count = Number(manifest.pages) || 0;
    const pattern = manifest.pattern || "assets/{n}.jpg";
    pages.value =
      count < 1
        ? []
        : Array.from({ length: count }, (_, i) => pattern.replace("{n}", String(i + 1)));
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
