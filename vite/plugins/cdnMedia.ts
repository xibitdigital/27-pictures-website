/**
 * When VITE_ASSET_BASE is set:
 *  - rewrite card-art URLs in HTML (+ sitemap) to the CDN
 *  - strip toon + card-art binaries from dist (served from R2)
 */
import type { Plugin } from "vite";
import fs from "node:fs";
import path from "node:path";

const MEDIA_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".mp3", ".mp4", ".webm", ".ogg", ".wav"]);

function assetBase(): string {
  return (process.env.VITE_ASSET_BASE || "").trim().replace(/\/+$/, "");
}

/** Rewrite same-origin / absolute card-art refs to the CDN origin. */
export function rewriteStaticMediaToCdn(html: string, base: string): string {
  if (!base) return html;
  return html
    .replaceAll("https://twentyseven.pictures/card-art/", `${base}/card-art/`)
    .replaceAll('"/card-art/', `"${base}/card-art/`)
    .replaceAll("'/card-art/", `'${base}/card-art/`);
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
  return {
    name: "cdn-media",
    apply: "build",
    transformIndexHtml(html) {
      return rewriteStaticMediaToCdn(html, assetBase());
    },
    closeBundle() {
      const base = assetBase();
      if (!base) return;

      const sitemap = path.join(distDir, "sitemap.xml");
      if (fs.existsSync(sitemap)) {
        fs.writeFileSync(sitemap, rewriteStaticMediaToCdn(fs.readFileSync(sitemap, "utf8"), base));
      }

      const removed = stripMediaUnder(path.join(distDir, "toons")) + stripMediaUnder(path.join(distDir, "card-art"));
      if (removed) {
        console.log(`[cdn-media] removed ${removed} media file(s) from dist (served from ${base})`);
      }
    },
  };
}
