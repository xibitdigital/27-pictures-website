import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

/**
 * Content-hash the stylesheets that live in `public/`, in the built output.
 *
 * These files cannot go through Vite's own asset pipeline: they are plain
 * `public/` files referenced by hand from every HTML entry, and Vite copies
 * `public/` verbatim. They were versioned instead with `?v=<hash>` written into
 * the HTML by `scripts/hash-assets.js`.
 *
 * That combination is unsafe. `_headers` serves them `immutable, max-age=1y`,
 * and a CDN keys on the full URL including the query — so the query is a new
 * cache key while the path still points at a file whose contents change. If any
 * request for a new `?v=` lands before a deploy has finished propagating, the
 * edge caches the *old* body under the *new* key and holds it for a year. There
 * is no busting an immutable entry: every page then loads a stylesheet from
 * before the change, and the only way out is to change the content again to get
 * a different key. That happened in production, and the request that poisoned
 * the entry was the one verifying the deploy.
 *
 * Hashing the filename removes the class of bug rather than the instance: a
 * given URL now has exactly one possible body, so `immutable` is true. A stale
 * fetch can only ever land under a name nothing references any more.
 *
 * Source HTML keeps plain `/styles.css`, which is also what the dev server
 * serves; the rewrite happens only in `dist/`.
 */

/** Public stylesheets to hash, as paths relative to the output root. */
const SHEETS = ["styles.css", "toons/reader-shared.css"];

function walkHtml(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkHtml(full, out);
    else if (entry.name.endsWith(".html")) out.push(full);
  }
  return out;
}

export function hashedCss(): Plugin {
  let outDir = "dist";

  return {
    name: "hashed-public-css",
    apply: "build",

    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },

    closeBundle() {
      if (!fs.existsSync(outDir)) return;
      const htmlFiles = walkHtml(outDir);

      for (const sheet of SHEETS) {
        const source = path.join(outDir, sheet);
        if (!fs.existsSync(source)) {
          this.warn(`hashed-public-css: ${sheet} not found in ${outDir}`);
          continue;
        }

        const bytes = fs.readFileSync(source);
        const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 10);
        const dir = path.dirname(sheet);
        const base = path.basename(sheet, ".css");
        const hashedRel = path.join(dir === "." ? "" : dir, `${base}.${hash}.css`);

        fs.writeFileSync(path.join(outDir, hashedRel), bytes);
        // The unhashed copy is removed: left in place it would still be served
        // as immutable under a path whose contents change on the next deploy,
        // which is the exact trap this plugin exists to close.
        fs.rmSync(source);

        // Match the reference with or without an existing ?v=, so a stale
        // hash-assets rewrite left in a source file still gets corrected.
        const escaped = sheet.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const pattern = new RegExp(`(["'(]|^)((?:\\.{0,2}/)?)${escaped}(\\?v=[a-f0-9]+)?`, "g");

        for (const file of htmlFiles) {
          const html = fs.readFileSync(file, "utf8");
          const next = html.replace(pattern, (_m, lead: string, prefix: string) => `${lead}${prefix}${hashedRel}`);
          if (next !== html) fs.writeFileSync(file, next);
        }
      }
    },
  };
}
