#!/usr/bin/env node
/**
 * Cache-bust static CSS (and any listed public assets) via content hash.
 *
 * - Hashes each asset under public/
 * - Rewrites every HTML under src/ and public/ that references those files
 * - Inserts ?v=<hash> when missing; updates when present
 * - Safe against YouTube `watch?v=` etc. (only matches our asset basenames
 *   at the end of the URL path, before optional query)
 *
 * Usage:
 *   npm run hash-assets          # rewrite HTML to match current file hashes
 *   npm run hash-assets -- --check   # exit 1 if HTML hashes are stale (CI)
 *   npm run build                # runs hash-assets first (see package.json)
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.join(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT, "public");
const SRC_DIR = path.join(ROOT, "src");

/** Static files served from public/ that HTML may cache-bust. */
const ASSETS = ["styles.css", "toons/reader-shared.css"];

const CHECK = process.argv.includes("--check");

function hashFile(absPath) {
  const buf = fs.readFileSync(absPath);
  return crypto.createHash("sha256").update(buf).digest("hex").slice(0, 10);
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findHtmlFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  let out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name === ".git" || entry.name === "worker") {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out = out.concat(findHtmlFiles(full));
    else if (entry.name.endsWith(".html")) out.push(full);
  }
  return out;
}

/**
 * Rewrite href/src that point at this asset basename.
 * Matches:
 *   href="/styles.css"
 *   href="/styles.css?v=old"
 *   href="styles.css?v=old"
 *   src='/toons/reader-shared.css?v=x'
 * Does not match:
 *   https://youtube.com/watch?v=...
 */
function rewriteAssetRefs(content, basename, hash) {
  const base = escapeRegex(basename);
  // attr=".../basename" or attr=".../basename?v=anything"
  const re = new RegExp(`((?:href|src)=["'])([^"']*?/${base}|${base})(?:\\?[^"']*)?(["'])`, "g");
  let changed = false;
  const next = content.replace(re, (_m, prefix, urlPath, suffix) => {
    const updated = `${prefix}${urlPath}?v=${hash}${suffix}`;
    if (updated !== _m) changed = true;
    return updated;
  });
  return { content: next, changed };
}

// --- hash assets ---
const hashes = {};
for (const asset of ASSETS) {
  const full = path.join(PUBLIC_DIR, asset);
  if (!fs.existsSync(full)) {
    console.warn(`skip missing asset: ${asset}`);
    continue;
  }
  hashes[asset] = hashFile(full);
}

const htmlFiles = [...new Set([...findHtmlFiles(SRC_DIR), ...findHtmlFiles(PUBLIC_DIR)])];

let touchedFiles = 0;
let stale = false;

for (const file of htmlFiles) {
  let content = fs.readFileSync(file, "utf8");
  let fileChanged = false;

  for (const [asset, hash] of Object.entries(hashes)) {
    const basename = path.basename(asset);
    const { content: next, changed } = rewriteAssetRefs(content, basename, hash);
    if (changed) {
      content = next;
      fileChanged = true;
    }
  }

  if (fileChanged) {
    stale = true;
    if (CHECK) {
      console.error(`stale: ${path.relative(ROOT, file)}`);
    } else {
      fs.writeFileSync(file, content);
      touchedFiles++;
      console.log(`updated ${path.relative(ROOT, file)}`);
    }
  }
}

console.log(`\nHashes:`);
for (const [asset, hash] of Object.entries(hashes)) {
  console.log(`  ${asset} -> ${hash}`);
}

if (CHECK) {
  if (stale) {
    console.error("\nAsset version queries are out of date. Run: npm run hash-assets");
    process.exit(1);
  }
  console.log("\nAll HTML asset versions match content hashes.");
  process.exit(0);
}

console.log(`\n${touchedFiles} file(s) updated.` + (touchedFiles === 0 ? " (already up to date)" : ""));
