/**
 * Toon config URLs.
 *
 * - Dev (`import.meta.env.DEV`): local reference via Vite
 *   → `/__dev/toon-config/<toon>.json` → content/toons/<toon>/config.json
 * - Prod: content-hashed file on CDN from config-lock.json
 *   → `/toons/<toon>/config.<md5>.json` + VITE_ASSET_BASE
 *
 * Edit content/toons/<toon>/config.json, then publish with
 * `npm run publish-toon-config` when ready for production.
 */
import lock from "./config-lock.json";

export type ToonId = keyof typeof lock;

/** Dev middleware path — must match vite/plugins/toonConfigDev.ts */
export function devToonConfigUrl(toon: string): string {
  return `/__dev/toon-config/${toon}.json`;
}

export function isDevToonConfigUrl(url: string): boolean {
  return /^\/__dev\/toon-config\/[a-z0-9_-]+\.json$/i.test((url || "").split("?")[0] || "");
}

/**
 * Site path for a toon's config.
 * Non-production (vite dev / unit tests) → local content/ via Vite middleware.
 * Production build → locked hashed name on CDN.
 */
export function toonConfigUrl(toon: ToonId): string {
  // PROD is true only for production builds (`vite build` / preview of dist).
  // Dev server and Vitest stay on the local reference file.
  if (!import.meta.env.PROD) {
    return devToonConfigUrl(String(toon));
  }
  const file = lock[toon];
  if (!file) throw new Error(`toonConfigUrl: no lock entry for "${String(toon)}"`);
  return `/toons/${String(toon)}/${file}`;
}

export { lock as toonConfigLock };
