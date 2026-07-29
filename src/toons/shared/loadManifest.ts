/**
 * Single source of truth for toon page lists (manifest.json).
 * Used by the flip engine and vertical-scroll mode — no duplicate parse logic.
 */
import type { ToonManifest } from "./types";

/** Expand a parsed manifest into ordered page URLs. */
export function pagesFromManifest(manifest: ToonManifest): string[] {
  if (Array.isArray(manifest.files) && manifest.files.length) {
    return manifest.files.map((f) => String(f));
  }
  const count = Number(manifest.pages) || 0;
  const pattern = manifest.pattern || "assets/{n}.jpg";
  if (count < 1) return [];
  return Array.from({ length: count }, (_, i) => pattern.replace("{n}", String(i + 1)));
}

/** Fetch + expand manifest.json. */
export async function loadManifest(url = "manifest.json"): Promise<string[]> {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(`manifest.json ${res.status}`);
  const manifest = (await res.json()) as ToonManifest;
  return pagesFromManifest(manifest);
}

/**
 * One in-flight / cached loader per URL so book + strip share a single fetch.
 * Create once per toon mount (not module-global — tests stub fetch per suite).
 */
export function createManifestLoader(url = "manifest.json"): () => Promise<string[]> {
  let cached: string[] | null = null;
  let inflight: Promise<string[]> | null = null;

  return async () => {
    if (cached) return cached.slice();
    if (!inflight) {
      inflight = loadManifest(url)
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
