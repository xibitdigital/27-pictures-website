#!/usr/bin/env node
/**
 * Cache-busts shared CSS/JS assets by content hash instead of a manually
 * incremented ?v=N — rewrites every reference across every public/*.html
 * file to ?v=<hash of that asset's current content>. Run before each deploy.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PUBLIC_DIR = path.join(__dirname, "..", "public");

const ASSETS = [
  "styles.css",
  "script.js",
  "toons/reader-shared.css",
  "toons/book-reader.js",
  "toons/view-mode.js",
  "toons/jax/words.js",
];

function hashFile(relPath) {
  const buf = fs.readFileSync(path.join(PUBLIC_DIR, relPath));
  return crypto.createHash("sha256").update(buf).digest("hex").slice(0, 10);
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findHtmlFiles(dir) {
  let out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out = out.concat(findHtmlFiles(full));
    else if (entry.name.endsWith(".html")) out.push(full);
  }
  return out;
}

const hashes = {};
for (const asset of ASSETS) hashes[asset] = hashFile(asset);

const htmlFiles = findHtmlFiles(PUBLIC_DIR);
let touchedFiles = 0;

for (const file of htmlFiles) {
  let content = fs.readFileSync(file, "utf8");
  let fileChanged = false;
  for (const asset of ASSETS) {
    const basename = escapeRegex(path.basename(asset));
    const hash = hashes[asset];
    const re = new RegExp(`((?:href|src)="[^"]*${basename})\\?v=[^"]*(")`, "g");
    const next = content.replace(re, (_m, prefix, suffix) => `${prefix}?v=${hash}${suffix}`);
    if (next !== content) {
      content = next;
      fileChanged = true;
    }
  }
  if (fileChanged) {
    fs.writeFileSync(file, content);
    touchedFiles++;
    console.log(`updated ${path.relative(PUBLIC_DIR, file)}`);
  }
}

console.log(`\n${touchedFiles} file(s) updated. Hashes:`);
for (const [asset, hash] of Object.entries(hashes)) console.log(`  ${asset} -> ${hash}`);
