#!/usr/bin/env node
/**
 * Cache-busts shared CSS assets by content hash.
 * Frontend JS is built by Vite (hashed under dist/assets/).
 *
 *   npm run hash-assets && npm run build
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.join(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT, "public");
const SRC_DIR = path.join(ROOT, "src");

/** Static CSS still served from public/ */
const ASSETS = ["styles.css", "toons/reader-shared.css"];

function hashFile(relPath) {
  const buf = fs.readFileSync(path.join(PUBLIC_DIR, relPath));
  return crypto.createHash("sha256").update(buf).digest("hex").slice(0, 10);
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findHtmlFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  let out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (
      entry.name === "node_modules" ||
      entry.name === "dist" ||
      entry.name === ".git"
    ) {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out = out.concat(findHtmlFiles(full));
    else if (entry.name.endsWith(".html")) out.push(full);
  }
  return out;
}

const hashes = {};
for (const asset of ASSETS) {
  const full = path.join(PUBLIC_DIR, asset);
  if (!fs.existsSync(full)) {
    console.warn(`skip missing asset: ${asset}`);
    continue;
  }
  hashes[asset] = hashFile(asset);
}

const htmlFiles = [
  ...new Set([...findHtmlFiles(SRC_DIR), ...findHtmlFiles(PUBLIC_DIR)]),
];
let touchedFiles = 0;

for (const file of htmlFiles) {
  let content = fs.readFileSync(file, "utf8");
  let fileChanged = false;
  for (const [asset, hash] of Object.entries(hashes)) {
    const basename = escapeRegex(path.basename(asset));
    const re = new RegExp(
      `((?:href|src)="[^"]*${basename})\\?v=[^"]*(")`,
      "g"
    );
    const next = content.replace(
      re,
      (_m, prefix, suffix) => `${prefix}?v=${hash}${suffix}`
    );
    if (next !== content) {
      content = next;
      fileChanged = true;
    }
  }
  if (fileChanged) {
    fs.writeFileSync(file, content);
    touchedFiles++;
    console.log(`updated ${path.relative(ROOT, file)}`);
  }
}

console.log(`\n${touchedFiles} file(s) updated. Hashes:`);
for (const [asset, hash] of Object.entries(hashes)) {
  console.log(`  ${asset} -> ${hash}`);
}
