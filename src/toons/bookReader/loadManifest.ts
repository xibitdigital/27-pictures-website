/**
 * Single source of truth for toon page lists (manifest.json).
 * Used by the flip engine and vertical-scroll mode — no duplicate parse logic.
 */
import { resolvePageUrls } from "./assetUrl";
import type { ToonManifest } from "./types";

export interface ManifestLoadOptions {
  /**
   * Directory used to resolve relative asset paths when VITE_ASSET_BASE is set
   * (e.g. `/toons/jax/`). Defaults to the current document path in the browser.
   */
  pageDir?: string;
}

/** Expand a parsed manifest into ordered page URLs (CDN-resolved when configured). */
export function pagesFromManifest(manifest: ToonManifest, opts?: ManifestLoadOptions): string[] {
  let raw: string[];
  if (Array.isArray(manifest.files) && manifest.files.length) {
    raw = manifest.files.map((f) => String(f));
  } else {
    const count = Number(manifest.pages) || 0;
    const pattern = manifest.pattern || "assets/{n}.jpg";
    if (count < 1) return [];
    raw = Array.from({ length: count }, (_, i) => pattern.replace("{n}", String(i + 1)));
  }
  return resolvePageUrls(raw, opts?.pageDir);
}

/** Fetch + expand manifest.json. */
export async function loadManifest(url = "manifest.json", opts?: ManifestLoadOptions): Promise<string[]> {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(`manifest.json ${res.status}`);
  const manifest = (await res.json()) as ToonManifest;
  return pagesFromManifest(manifest, opts);
}

/**
 * One in-flight / cached loader per URL so book + strip share a single fetch.
 * Create once per toon mount (not module-global — tests stub fetch per suite).
 */
export function createManifestLoader(url = "manifest.json", opts?: ManifestLoadOptions): () => Promise<string[]> {
  let cached: string[] | null = null;
  let inflight: Promise<string[]> | null = null;

  return async () => {
    if (cached) return cached.slice();
    if (!inflight) {
      inflight = loadManifest(url, opts)
        .then((pages) => {
          cached = pages;
          return pages;
        })
        .finally(() => {
          inflight = null;
        });
    }
    const pages = await inflight;
    return pages.slice();
  };
}
