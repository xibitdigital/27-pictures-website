/// <reference types="vite/client" />
/// <reference types="vitest/globals" />

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<object, object, unknown>;
  export default component;
}

/** Cloudflare Turnstile global (loaded from CDN on the marketing site). */
interface TurnstileApi {
  execute: (widgetId?: string | HTMLElement) => void;
  reset: (widgetId?: string | HTMLElement) => void;
  remove: (widgetId?: string | HTMLElement) => void;
  render: (
    el: string | HTMLElement,
    options: Record<string, unknown>
  ) => string;
}

interface Window {
  turnstile?: TurnstileApi;
  onTurnstileSuccess?: (token: string) => void;
  onTurnstileExpired?: () => void;
  /** Lenis smooth-scroll (CDN on marketing site). */
  Lenis?: new (opts?: Record<string, unknown>) => {
    raf: (time: number) => void;
  };
}
