/**
 * Single source of truth for a toon: content-hashed config.<md5>.json
 * pages[] → each { file, words? }
 * Apps resolve the current filename via src/toons/config-lock.json.
 */
import { resolveAssetUrl, resolvePageUrls } from "./assetUrl";
import { isDevToonConfigUrl } from "../configUrls";
import type { ToonConfig, ToonPage } from "./types";

export interface ConfigLoadOptions {
  /**
   * Directory used to resolve relative asset paths when VITE_ASSET_BASE is set
   * (e.g. `/toons/jax/`). Required for relative config/media when CDN is on.
   */
  pageDir?: string;
}

/** In-flight + resolved cache so book shell + captions share one fetch. */
const inflight = new Map<string, Promise<ToonConfig>>();
const resolved = new Map<string, ToonConfig>();

/** Clear fetch cache (tests). */
export function clearConfigCache(): void {
  inflight.clear();
  resolved.clear();
}

/**
 * Resolve where to fetch config (optional CDN via VITE_ASSET_BASE).
 * - Dev local paths (`/__dev/toon-config/…`) stay same-origin (Vite), never CDN
 * - Absolute http(s) URLs pass through
 * - Root-absolute hashed paths use the CDN base when set
 * - Relative names need `pageDir`
 */
export function resolveConfigUrl(configUrl: string, pageDir?: string): string {
  const url = (configUrl || "").trim();
  if (!url) throw new Error("resolveConfigUrl: configUrl is required");
  if (/^https?:\/\//i.test(url)) return url;
  // Local reference config in vite dev/preview — do not prefix VITE_ASSET_BASE
  if (isDevToonConfigUrl(url)) return url;
  if (url.startsWith("/")) return resolveAssetUrl(url);
  return resolveAssetUrl(url, pageDir);
}

/** Ordered page image paths from config (CDN-resolved when configured). */
export function pagesFromConfig(config: ToonConfig, opts?: ConfigLoadOptions): string[] {
  const list = Array.isArray(config.pages) ? config.pages : [];
  const raw = list.map((p) => String((p as ToonPage)?.file || "")).filter(Boolean);
  return resolvePageUrls(raw, opts?.pageDir);
}

/**
 * Fetch config.json.
 * - Local `__dev/toon-config/*`: always re-fetch (no long-lived memory cache) so
 *   appending pages under content/toons appears after reload — not a stale map.
 * - Hashed CDN URLs: cache per URL so shell + captions share one fetch.
 */
export async function loadConfig(url: string): Promise<ToonConfig> {
  const key = url;
  const isDevLocal = isDevToonConfigUrl(url);

  if (!isDevLocal) {
    const hit = resolved.get(key);
    if (hit) return hit;
  }

  let pending = inflight.get(key);
  if (!pending) {
    pending = fetch(key, { cache: isDevLocal ? "no-store" : "no-cache" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`toon config ${res.status}`);
        return (await res.json()) as ToonConfig;
      })
      .then((cfg) => {
        if (!isDevLocal) resolved.set(key, cfg);
        return cfg;
      })
      .finally(() => {
        inflight.delete(key);
      });
    inflight.set(key, pending);
  }
  return pending;
}

/** Fetch + expand page image list from config. */
export async function loadConfigPages(url: string, opts?: ConfigLoadOptions): Promise<string[]> {
  const config = await loadConfig(url);
  return pagesFromConfig(config, opts);
}

/**
 * Page loader for book + strip. Shares the module cache with caption loading
 * when both use the same resolved config URL.
 */
export function createConfigLoader(url: string, opts?: ConfigLoadOptions): () => Promise<string[]> {
  return async () => {
    const pages = await loadConfigPages(url, opts);
    return pages.slice();
  };
}

/** @deprecated Use pagesFromConfig */
export const pagesFromManifest = pagesFromConfig;
/** @deprecated Use loadConfigPages */
export const loadManifest = loadConfigPages;
/** @deprecated Use createConfigLoader */
export const createManifestLoader = createConfigLoader;
