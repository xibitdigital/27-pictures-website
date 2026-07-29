/**
 * Production CDN media:
 *  - require VITE_ASSET_BASE on `vite build` (not during tests)
 *  - expand %VITE_ASSET_BASE% in HTML entries + sitemap
 *  - strip toon + card-art binaries from dist (served from R2)
 *
 * Source HTML should use: %VITE_ASSET_BASE%/card-art/foo.jpg
 * (Vite also expands %VITE_*% in HTML; we re-run for sitemap + safety.)
 */
import type { Plugin } from "vite";
import fs from "node:fs";
import path from "node:path";

const MEDIA_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".mp3", ".mp4", ".webm", ".ogg", ".wav"]);

/** Token used in static HTML/XML; replaced with the CDN origin (no trailing slash). */
export const ASSET_BASE_TOKEN = "%VITE_ASSET_BASE%";

export function readAssetBase(): string {
  return (process.env.VITE_ASSET_BASE || "").trim().replace(/\/+$/, "");
}

/** Replace %VITE_ASSET_BASE% with the resolved origin. */
export function expandAssetBaseToken(text: string, base: string): string {
  return text.replaceAll(ASSET_BASE_TOKEN, base);
}

function stripMediaUnder(dir: string): number {
  if (!fs.existsSync(dir)) return 0;
  let removed = 0;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      removed += stripMediaUnder(full);
      if (fs.existsSync(full) && fs.readdirSync(full).length === 0) fs.rmdirSync(full);
    } else if (MEDIA_EXT.has(path.extname(name).toLowerCase())) {
      fs.unlinkSync(full);
      removed += 1;
    }
  }
  return removed;
}

export function cdnMediaPlugin(distDir: string): Plugin {
  let isBuild = false;

  return {
    name: "cdn-media",
    configResolved(config) {
      isBuild = config.command === "build";
    },
    buildStart() {
      // Hard gate: production builds must set the CDN origin (media is not in git).
      // Vitest sets VITEST=true and never runs a real app build through this path
      // for serve; skip when not building.
      if (!isBuild || process.env.VITEST) return;
      const base = readAssetBase();
      if (!base) {
        throw new Error(
          [
            "VITE_ASSET_BASE is required for production builds (toon/card media lives on R2).",
            "Add to .env, e.g.:",
            "  VITE_ASSET_BASE=https://pub-e60c8fa8eea343fbac708bf75981d19c.r2.dev",
            "  VITE_ASSET_BASE=https://assets.twentyseven.pictures",
          ].join("\n")
        );
      }
    },
    transformIndexHtml(html) {
      const base = readAssetBase();
      if (!base) return html;
      return expandAssetBaseToken(html, base);
    },
    closeBundle() {
      if (!isBuild || process.env.VITEST) return;
      const base = readAssetBase();
      if (!base) return;

      const sitemap = path.join(distDir, "sitemap.xml");
      if (fs.existsSync(sitemap)) {
        fs.writeFileSync(sitemap, expandAssetBaseToken(fs.readFileSync(sitemap, "utf8"), base));
      }

      const removed = stripMediaUnder(path.join(distDir, "toons")) + stripMediaUnder(path.join(distDir, "card-art"));
      if (removed) {
        console.log(`[cdn-media] removed ${removed} media file(s) from dist (served from ${base})`);
      }
    },
  };
}
