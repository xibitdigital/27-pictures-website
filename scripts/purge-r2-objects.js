#!/usr/bin/env node
/**
 * Delete specific R2 objects and drop their entries from
 * scripts/r2-assets-lock.json. Irreversible on the bucket — check
 * cdn-backup/ (npm run backup-cdn) covers the keys before running.
 *
 *   node scripts/purge-r2-objects.js key1 key2 ...
 *   node scripts/purge-r2-objects.js --file keys.txt   # one key per line
 */
const fs = require("node:fs");
const { wrangler, loadLock, saveLock, DEFAULT_BUCKET } = require("./lib/r2-media");

const argv = process.argv.slice(2);
const fileIdx = argv.indexOf("--file");
const keys =
  fileIdx !== -1
    ? fs
        .readFileSync(argv[fileIdx + 1], "utf8")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
    : argv;
if (!keys.length) {
  console.error("usage: node scripts/purge-r2-objects.js <key> [key...]");
  console.error("   or: node scripts/purge-r2-objects.js --file keys.txt");
  process.exit(1);
}
console.log(`${keys.length} key(s) to delete`);

const lock = loadLock();
let ok = 0;
let failed = 0;

for (const key of keys) {
  const res = wrangler(["r2", "object", "delete", `${DEFAULT_BUCKET}/${key}`, "--remote"]);
  if (res.status !== 0) {
    console.error(`FAIL ${key}`);
    console.error((res.stderr || res.stdout || "").trim().slice(0, 300));
    failed++;
    continue;
  }
  console.log(`deleted ${key}`);
  if (lock.keys && lock.keys[key]) delete lock.keys[key];
  ok++;
}

saveLock(lock);
console.log(`\n${ok} deleted, ${failed} failed. Lock updated.`);
if (failed) process.exitCode = 1;
