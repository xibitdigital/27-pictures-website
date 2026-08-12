import { afterEach, vi } from "vitest";
import { config } from "@vue/test-utils";
import { resetPageQueryCache } from "../toons/bookReader/pageQuery";

// Isolate tests from developer .env (CDN base). vite.config test.env also sets this;
// stub here so vi.stubEnv in individual tests can still override per case.
vi.stubEnv("VITE_ASSET_BASE", "");

// Headless UI + many components expect matchMedia in jsdom/happy-dom.
if (typeof window !== "undefined" && !window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

// Stub global directives used in SiteNav so unit tests don't need full app setup.
config.global.stubs = {
  ...config.global.stubs,
};

config.global.directives = {
  magnetic: {
    mounted() {},
    unmounted() {},
  },
};

afterEach(() => {
  document.body.innerHTML = "";
  document.body.className = "";
  document.body.style.overflow = "";
  // The reader mirrors its position into `?page=` and reads it on init.
  // A browser gets a fresh URL and a fresh module per load; the shared jsdom
  // window gets neither, so without this every test after a page turn would
  // open on that page.
  if (typeof window !== "undefined" && window.history?.replaceState) {
    window.history.replaceState(null, "", window.location.pathname);
  }
  resetPageQueryCache();
});
