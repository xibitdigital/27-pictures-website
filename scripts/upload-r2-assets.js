#!/usr/bin/env node
/**
 * Sync public/toons + public/card-art into Cloudflare R2.
 *
 * Keys mirror public/ so VITE_ASSET_BASE prefixes 1:1.
 * Skip state: scripts/r2-assets-lock.json
 *
 *   npm run create-assets-bucket
 *   npm run upload-assets
 *   npm run upload-assets -- --dry-run | --force | --setup-cors
 */

const path = require("node:path");
const {
  ROOT,
  LOCK_PATH,
  DEFAULT_BUCKET,
  collectLocalMedia,
  keyForFile,
  loadLock,
  saveLock,
  putObject,
  createBucket,
  setupCors,
  enableDevUrl,
} = require("./lib/r2-media");

function parseArgs(argv) {
  const opts = {
    dryRun: false,
    force: false,
    bucket: DEFAULT_BUCKET,
    createBucket: false,
    setupCors: false,
    enableDevUrl: false,
    help: false,
  };
  for (const arg of argv) {
    if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--force") opts.force = true;
    else if (arg === "--create-bucket") opts.createBucket = true;
    else if (arg === "--setup-cors") opts.setupCors = true;
    else if (arg === "--enable-dev-url") opts.enableDevUrl = true;
    else if (arg.startsWith("--bucket=")) opts.bucket = arg.slice("--bucket=".length);
    else if (arg === "--help" || arg === "-h") opts.help = true;
  }
  return opts;
}

function printHelp() {
  console.log(`Usage: node scripts/upload-r2-assets.js [options]

  --bucket=NAME     (default: ${DEFAULT_BUCKET} or $R2_BUCKET)
  --dry-run | --force | --create-bucket | --setup-cors | --enable-dev-url

Requires: npx wrangler login
Build with: VITE_ASSET_BASE=https://… npm run build
`);
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    printHelp();
    process.exit(0);
  }

  let didAdmin = false;
  if (opts.createBucket) {
    if (!createBucket(opts.bucket, opts.dryRun)) process.exit(1);
    didAdmin = true;
  }
  if (opts.setupCors) {
    if (!setupCors(opts.bucket, opts.dryRun)) process.exit(1);
    didAdmin = true;
  }
  if (opts.enableDevUrl) {
    if (!enableDevUrl(opts.bucket, opts.dryRun)) process.exit(1);
    didAdmin = true;
  }

  const argvFlags = process.argv.slice(2).filter((a) => a.startsWith("--"));
  const uploadFlags = new Set(["--force", "--dry-run"]);
  const adminFlags = new Set(["--create-bucket", "--setup-cors", "--enable-dev-url"]);
  const onlyAdmin =
    argvFlags.length > 0 &&
    argvFlags.every((a) => adminFlags.has(a) || a.startsWith("--bucket=")) &&
    !argvFlags.some((a) => uploadFlags.has(a));

  if (onlyAdmin && didAdmin) {
    console.log("Admin steps done.");
    process.exit(0);
  }

  const files = collectLocalMedia();
  if (!files.length) {
    console.log("No media under public/toons or public/card-art.");
    process.exit(0);
  }

  console.log(`Bucket: ${opts.bucket}`);
  console.log(`Local media files: ${files.length}`);
  if (opts.dryRun) console.log("(dry-run)");
  if (opts.force) console.log("(force)");

  const lock = loadLock();
  if (lock.bucket && lock.bucket !== opts.bucket) {
    console.warn(`warning: lock was for "${lock.bucket}", now "${opts.bucket}"`);
  }
  const keys = lock.keys && typeof lock.keys === "object" ? lock.keys : {};

  let uploaded = 0;
  let skipped = 0;
  let failed = 0;
  let lockDirty = false;

  for (const file of files) {
    const key = keyForFile(file);
    const size = require("node:fs").statSync(file).size;
    const prev = keys[key];
    if (!opts.force && prev && prev.size === size) {
      skipped += 1;
      continue;
    }
    // putObject updates lock per file; we batch-save at end for fewer writes
    const ok = putObject(file, { bucket: opts.bucket, dryRun: opts.dryRun, updateLock: false });
    if (ok) {
      uploaded += 1;
      if (!opts.dryRun) {
        keys[key] = { size, uploadedAt: new Date().toISOString() };
        lockDirty = true;
      }
    } else {
      failed += 1;
    }
  }

  if (lockDirty) {
    saveLock({ bucket: opts.bucket, keys });
    console.log(`Updated ${path.relative(ROOT, LOCK_PATH)}`);
  }

  console.log(`\nDone. uploaded=${uploaded} skipped=${skipped} failed=${failed}`);
  if (failed) process.exit(1);
}

main();
