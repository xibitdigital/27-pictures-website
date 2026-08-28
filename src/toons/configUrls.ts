/**
 * Toon config URLs.
 *
 * - Dev (`import.meta.env.DEV`): local reference via Vite
 *   → `/__dev/toon-config/<toon>.json` → content/toons/<toon>/config.json
 * - Prod: content-hashed file on CDN from config-lock.json
 *   → `/toons/<toon>/config.<md5>.json` + VITE_ASSET_BASE
 * - Published D1 drafts: `dbToonConfigUrl(slug)` → editor Worker
 *   `/config/<slug>` (dev proxy `/__editor-api/config/<slug>`).
 *
 * Edit content/toons/<toon>/config.json. GitHub Actions runs
 * `publish-toon-config --skip-unchanged` before `vite build`, so a push to
 * staging/main publishes any new hashes and compiles them into the bundle.
 * Local `make ship` still does the same for one toon.
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
export function readerConfigUrl(toon: ToonId): string {
  return dbToonConfigUrl(String(toon)) ?? toonConfigUrl(toon);
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
