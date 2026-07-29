import type { ToonBookEls } from "@/toons/bookReader/types";
import { vi } from "vitest";

/** Minimal book DOM matching what the flip engine expects. */
export function mountBookFixture(): ToonBookEls & { root: HTMLElement } {
  const root = document.createElement("div");
  root.innerHTML = `
    <div class="toon-top-controls" data-top></div>
    <div class="book" data-book>
      <div class="page-slot left" data-left></div>
      <div class="page-slot right" data-right></div>
      <div class="nav-zone next" data-zone-next></div>
      <div class="nav-zone prev" data-zone-prev></div>
    </div>
    <button type="button" data-prev>prev</button>
    <button type="button" data-next>next</button>
    <span data-indicator></span>
  `;
  document.body.appendChild(root);

  return {
    root,
    book: root.querySelector("[data-book]") as HTMLElement,
    slotLeft: root.querySelector("[data-left]") as HTMLElement,
    slotRight: root.querySelector("[data-right]") as HTMLElement,
    indicator: root.querySelector("[data-indicator]") as HTMLElement,
    btnPrev: root.querySelector("[data-prev]") as HTMLButtonElement,
    btnNext: root.querySelector("[data-next]") as HTMLButtonElement,
    zoneNext: root.querySelector("[data-zone-next]") as HTMLElement,
    zonePrev: root.querySelector("[data-zone-prev]") as HTMLElement,
    topControls: root.querySelector("[data-top]") as HTMLElement,
  };
}

export function mockManifest(files: string[]) {
  return {
    ok: true,
    json: async () => ({ files, pages: files.length }),
  } as Response;
}

export type MatchMediaMode = "desktop" | "mobile" | "reduce-motion";

/**
 * Stub matchMedia for reader modes.
 * - desktop: spread view
 * - mobile: single-page (max-width 768)
 * - reduce-motion: instant turns (no flip animation)
 */
export function stubReaderMatchMedia(mode: MatchMediaMode = "desktop") {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => {
      let matches = false;
      if (query.includes("prefers-reduced-motion")) {
        matches =
          mode === "reduce-motion" || mode === "desktop" || mode === "mobile" ? mode === "reduce-motion" : false;
      }
      // When testing reduce-motion, still want desktop layout unless mobile.
      if (query.includes("max-width: 768px") || query.includes("max-width:768px")) {
        matches = mode === "mobile";
      }
      if (mode === "reduce-motion" && query.includes("prefers-reduced-motion")) {
        matches = true;
      }
      if (mode === "reduce-motion" && query.includes("max-width")) {
        matches = false; // desktop spreads + reduced motion
      }
      if (mode === "desktop" && query.includes("max-width")) matches = false;
      if (mode === "desktop" && query.includes("prefers-reduced-motion")) matches = false;
      if (mode === "mobile" && query.includes("max-width")) matches = true;
      if (mode === "mobile" && query.includes("prefers-reduced-motion")) matches = false;

      return {
        matches,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
        onchange: null,
      };
    })
  );
}

/** Instant image preload for flip engine. */
export function stubImagePreload() {
  vi.stubGlobal(
    "Image",
    class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      complete = true;
      set src(_v: string) {
        queueMicrotask(() => this.onload?.());
      }
    }
  );
}

export function stubManifestFetch(files: string[]) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockManifest(files)));
}

/** 4 pages → spreads: 0=(cover|p1), 1=(p2|p3), 2=(p4|?) with totalSpreads = ceil((4+1)/2)=3 */
export const FOUR_PAGES = ["assets/p1.jpg", "assets/p2.jpg", "assets/p3.jpg", "assets/p4.jpg"];
