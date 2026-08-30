/**
 * Toon config URLs.
 *
 * Live readers load FlipFrame JSON from the editor Worker (D1):
 * `dbToonConfigUrl(slug)` → `/config/<slug>` (dev proxy `/__editor-api/config/<slug>`).
 * Hashed CDN files from config-lock.json remain a fallback when the API is unset
 * (Vitest). Edit captions in the studio, not in content/toons.
 */
import { editorApiBase, withSiteQuery } from "./editor/api";
import lock from "./config-lock.json";

export type ToonId = keyof typeof lock;

/** Dev middleware path — must match vite/plugins/toonConfigDev.ts */
export function devToonConfigUrl(toon: string): string {
  return `/__dev/toon-config/${toon}.json`;
}

export function isDevToonConfigUrl(url: string): boolean {
  return /^\/__dev\/toon-config\/[a-z0-9_-]+\.json$/i.test((url || "").split("?")[0] || "");
}

/** Published reader JSON from the editor Worker (D1). Null when API is unset (Vitest). */
export function dbToonConfigUrl(slug: string): string | null {
  const base = editorApiBase();
  if (!base) return null;
  return withSiteQuery(`${base}/config/${slug}`);
}

export function isEditorToonConfigUrl(url: string): boolean {
  const path = (url || "").split("?")[0] || "";
  if (/^\/__editor-api\/config\/[a-z0-9_-]+$/i.test(path)) return true;
  const base = editorApiBase();
  if (base && path.startsWith(`${base}/config/`)) return true;
  return false;
}

/** Same-origin / Worker JSON — never prefix VITE_ASSET_BASE. */
export function isLocalToonConfigUrl(url: string): boolean {
  return isDevToonConfigUrl(url) || isEditorToonConfigUrl(url);
}

/** Published D1 JSON when the editor API is up; otherwise hashed / file config. */
export function readerConfigUrl(toon: string): string {
  return dbToonConfigUrl(toon) ?? toonConfigUrl(toon);
}

/**
 * Site path for a toon's config.
 * Non-production (vite dev / unit tests) → local content/ via Vite middleware.
 * Production build → locked hashed name on CDN.
 */
export function toonConfigUrl(toon: string): string {
  // PROD is true only for production builds (`vite build` / preview of dist).
  // Dev server and Vitest stay on the local reference file.
  if (!import.meta.env.PROD) {
    return devToonConfigUrl(toon);
  }
  const file = (lock as Record<string, string>)[toon];
  if (!file) throw new Error(`toonConfigUrl: no lock entry for "${toon}"`);
  return `/toons/${toon}/${file}`;
}

export { lock as toonConfigLock };
