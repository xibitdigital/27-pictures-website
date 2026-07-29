#!/usr/bin/env node
/**
 * Sync toon media from public/toons/** into a Cloudflare R2 bucket.
 *
 * Object keys mirror the site path under public/ so VITE_ASSET_BASE can prefix
 * them 1:1, e.g.:
 *   public/toons/jax/assets/<hash>.jpg
 *   → r2 key: toons/jax/assets/<hash>.jpg
 *   → URL:    ${VITE_ASSET_BASE}/toons/jax/assets/<hash>.jpg
 *
 * Usage:
 *   npm run create-assets-bucket       # one-time: create the R2 bucket
 *   npm run upload-assets              # upload missing keys only
 *   npm run upload-assets -- --dry-run
 *   npm run upload-assets -- --force   # re-upload everything
 *   npm run upload-assets -- --bucket=my-bucket
 *   npm run upload-assets -- --setup-cors
 *   npm run upload-assets -- --enable-dev-url
 *
 * Env:
 *   R2_BUCKET   default twentyseven-assets
 *
 * After the first upload:
 *   1. Custom domain (dashboard or CLI):
 *        npx wrangler r2 bucket domain add twentyseven-assets --domain assets.twentyseven.pictures
 *   2. Build with CDN base:
 *        VITE_ASSET_BASE=https://assets.twentyseven.pictures npm run build
 *
 * Requires: wrangler logged in (`npx wrangler login`).
 *
 * Skip state is stored in scripts/r2-assets-lock.json (size per key) so re-runs
 * stay cheap without needing a remote object listing API.
 */

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const PUBLIC = path.join(ROOT, "public");
const MEDIA_ROOT = path.join(PUBLIC, "toons");
const LOCK_PATH = path.join(__dirname, "r2-assets-lock.json");
const CORS_PATH = path.join(__dirname, "r2-cors.json");

const DEFAULT_BUCKET = process.env.R2_BUCKET || "twentyseven-assets";

const MEDIA_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".mp3", ".mp4", ".webm", ".ogg", ".wav"]);

const CONTENT_TYPES = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
};

const CACHE_CONTROL = "public, max-age=31536000, immutable";

/** Directories never uploaded (backups, editor junk). */
const SKIP_DIR_NAMES = new Set([".watermark-backup", "node_modules", ".git"]);

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

function walkMedia(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    if (name === ".DS_Store") continue;
    if (SKIP_DIR_NAMES.has(name)) continue;
    if (name.startsWith(".") && name !== ".") continue;
    const full = path.join(dir, name);
    let st;
    try {
      st = fs.statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) walkMedia(full, out);
    else if (MEDIA_EXT.has(path.extname(name).toLowerCase())) out.push(full);
  }
  return out;
}

function keyForFile(absPath) {
  // public/toons/... → toons/...
  const rel = path.relative(PUBLIC, absPath);
  return rel.split(path.sep).join("/");
}

function fileFingerprint(absPath) {
  const st = fs.statSync(absPath);
  // Content-hashed filenames already encode payload; size catches accidental overwrite of same name.
  return { size: st.size };
}

function wrangler(args, { inherit = false } = {}) {
  return spawnSync("npx", ["wrangler", ...args], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: inherit ? "inherit" : ["ignore", "pipe", "pipe"],
    env: process.env,
  });
}

function loadLock() {
  try {
    return JSON.parse(fs.readFileSync(LOCK_PATH, "utf8"));
  } catch {
    return { bucket: null, keys: {} };
  }
}

function saveLock(lock) {
  fs.writeFileSync(LOCK_PATH, JSON.stringify(lock, null, 2) + "\n");
}

function contentTypeFor(filePath) {
  return CONTENT_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

function uploadOne(bucket, key, filePath, dryRun) {
  if (dryRun) {
    console.log(`[dry-run] put ${bucket}/${key}`);
    return true;
  }
  const args = [
    "r2",
    "object",
    "put",
    `${bucket}/${key}`,
    `--file=${filePath}`,
    `--content-type=${contentTypeFor(filePath)}`,
    `--cache-control=${CACHE_CONTROL}`,
    "--remote",
  ];
  const res = wrangler(args);
  if (res.status !== 0) {
    console.error(`FAIL ${key}`);
    console.error((res.stderr || res.stdout || "").trim().slice(0, 500));
    return false;
  }
  console.log(`ok   ${key}`);
  return true;
}

function createBucket(bucket, dryRun) {
  if (dryRun) {
    console.log(`[dry-run] r2 bucket create ${bucket}`);
    return true;
  }
  console.log(`Creating R2 bucket: ${bucket}`);
  const res = wrangler(["r2", "bucket", "create", bucket], { inherit: true });
  return res.status === 0;
}

function setupCors(bucket, dryRun) {
  if (!fs.existsSync(CORS_PATH)) {
    console.error(`Missing CORS config: ${CORS_PATH}`);
    return false;
  }
  if (dryRun) {
    console.log(`[dry-run] r2 bucket cors set ${bucket} --file ${CORS_PATH}`);
    return true;
  }
  console.log(`Setting CORS on ${bucket} from ${path.basename(CORS_PATH)}`);
  const res = wrangler(["r2", "bucket", "cors", "set", bucket, `--file=${CORS_PATH}`], {
    inherit: true,
  });
  return res.status === 0;
}

function enableDevUrl(bucket, dryRun) {
  if (dryRun) {
    console.log(`[dry-run] r2 bucket dev-url enable ${bucket}`);
    return true;
  }
  console.log(`Enabling public r2.dev URL for ${bucket}`);
  const res = wrangler(["r2", "bucket", "dev-url", "enable", bucket], { inherit: true });
  return res.status === 0;
}

function printHelp() {
  console.log(`Usage: node scripts/upload-r2-assets.js [options]

Options:
  --bucket=NAME     R2 bucket (default: ${DEFAULT_BUCKET} or $R2_BUCKET)
  --dry-run         Print actions without uploading
  --force           Re-upload even if lock says the key is current
  --create-bucket   Create the R2 bucket
  --setup-cors      Apply scripts/r2-cors.json to the bucket
  --enable-dev-url  Enable public access via *.r2.dev (temporary testing)
  -h, --help        Show this help

Examples:
  npm run create-assets-bucket
  npm run upload-assets -- --dry-run
  npm run upload-assets -- --setup-cors
  VITE_ASSET_BASE=https://assets.twentyseven.pictures npm run build
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

  // If only admin flags were passed (create / cors / dev-url), stop after those steps.
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

  if (!fs.existsSync(MEDIA_ROOT)) {
    console.error(`No media root at ${MEDIA_ROOT}`);
    process.exit(1);
  }

  const files = walkMedia(MEDIA_ROOT).sort();
  if (!files.length) {
    console.log("No media files found under public/toons.");
    process.exit(0);
  }

  console.log(`Bucket: ${opts.bucket}`);
  console.log(`Local media files: ${files.length}`);
  if (opts.dryRun) console.log("(dry-run mode)");
  if (opts.force) console.log("(force: re-upload all)");

  const lock = loadLock();
  if (lock.bucket && lock.bucket !== opts.bucket) {
    console.warn(`warning: lock file was for bucket "${lock.bucket}", now using "${opts.bucket}"`);
  }
  const keys = lock.keys && typeof lock.keys === "object" ? lock.keys : {};

  let uploaded = 0;
  let skipped = 0;
  let failed = 0;
  let lockDirty = false;

  for (const file of files) {
    const key = keyForFile(file);
    const fp = fileFingerprint(file);
    const prev = keys[key];
    if (!opts.force && prev && prev.size === fp.size) {
      skipped += 1;
      continue;
    }
    const ok = uploadOne(opts.bucket, key, file, opts.dryRun);
    if (ok) {
      uploaded += 1;
      if (!opts.dryRun) {
        keys[key] = { size: fp.size, uploadedAt: new Date().toISOString() };
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

  console.log(`
Next steps:
  1. Custom domain (once):
       npx wrangler r2 bucket domain add ${opts.bucket} --domain assets.twentyseven.pictures
     or enable temporary public URL:
       npm run upload-assets -- --enable-dev-url
  2. CORS (once, if not already):
       npm run upload-assets -- --setup-cors
  3. Build with CDN base:
       VITE_ASSET_BASE=https://assets.twentyseven.pictures npm run build
  4. Deploy Pages: make deploy
`);
}

main();
