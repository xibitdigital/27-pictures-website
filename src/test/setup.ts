import { afterEach, vi } from "vitest";
import { config } from "@vue/test-utils";

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
  reveal: {
    mounted() {},
    unmounted() {},
  },
};

afterEach(() => {
  document.body.innerHTML = "";
  document.body.className = "";
  document.body.style.overflow = "";
});
