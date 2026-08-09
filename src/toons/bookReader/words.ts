/**
 * Caption config loading for toon pages.
 *
 * Rendering lives in `captions/` (WordLayer.vue → WordCaption.vue); this file
 * only fetches the toon config and resolves media paths through the CDN.
 */
import { resolveAssetUrl } from "./assetUrl";
import { loadConfig } from "./loadConfig";
import type { WordsConfig } from "./types";

/** Default localStorage key for caption language (legacy Jax key). */
export const LANG_STORAGE_KEY = "jax-toon-lang";

/**
 * Resolve page images + word SFX paths through VITE_ASSET_BASE so assets load
 * from R2/CDN when configured (relative paths stay relative when base is empty).
 */
export function resolveWordsAssets(config: WordsConfig, pageDir?: string): WordsConfig {
  if (!Array.isArray(config?.pages)) return config;
  const pages = config.pages.map((page) => {
    const file = page?.file && typeof page.file === "string" ? resolveAssetUrl(page.file.trim(), pageDir) : page?.file;
    const words = Array.isArray(page?.words)
      ? page.words.map((w) => {
          if (!w || typeof w.audio !== "string" || !w.audio.trim()) return w;
          return { ...w, audio: resolveAssetUrl(w.audio.trim(), pageDir) };
        })
      : page?.words;
    return { ...page, file, words };
  });
  return { ...config, pages };
}

/**
 * Load toon config.json and resolve caption SFX paths.
 * Shares the fetch cache with the page loader (`loadConfig`) on the same URL.
 */
export async function loadWords(url: string, pageDir?: string): Promise<WordsConfig> {
  const config = await loadConfig(url);
  return resolveWordsAssets(config, pageDir);
}
