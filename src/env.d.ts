/// <reference types="vite/client" />
/// <reference types="vitest/globals" />

interface ImportMetaEnv {
  /**
   * Optional CDN / R2 origin for toon media (images, SFX, music).
   * Empty or unset = serve from same origin (Cloudflare Pages `public/`).
   * Example: `https://assets.twentyseven.pictures`
   */
  readonly VITE_ASSET_BASE?: string;
  /**
   * FlipFrame build id (git short SHA by default; override with VITE_FLIPFRAME_BUILD).
   * Shown under the FlipFrame name on cover / guide.
   */
  readonly VITE_FLIPFRAME_BUILD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<object, object, unknown>;
  export default component;
}

declare module "*.json" {
  const value: Record<string, string>;
  export default value;
}

/** Cloudflare Turnstile global (loaded from CDN on the marketing site). */
interface TurnstileApi {
  execute: (widgetId?: string | HTMLElement) => void;
  reset: (widgetId?: string | HTMLElement) => void;
  remove: (widgetId?: string | HTMLElement) => void;
  render: (el: string | HTMLElement, options: Record<string, unknown>) => string;
}

interface Window {
  turnstile?: TurnstileApi;
  onTurnstileSuccess?: (token: string) => void;
  onTurnstileExpired?: () => void;
}
