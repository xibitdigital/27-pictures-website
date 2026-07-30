/**
 * Shared R2 media helpers for upload-r2-assets + add-toon-image.
 * Keys mirror public/ (toons/…, card-art/…) so VITE_ASSET_BASE can prefix 1:1.
 */

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const PUBLIC = path.join(ROOT, "public");
const LOCK_PATH = path.join(ROOT, "scripts", "r2-assets-lock.json");
const CORS_PATH = path.join(ROOT, "scripts", "r2-cors.json");

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
  ".json": "application/json",
};

const CACHE_CONTROL = "public, max-age=31536000, immutable";
const SKIP_DIR_NAMES = new Set([".watermark-backup", "node_modules", ".git"]);

/** public/toons + public/card-art → R2 */
const MEDIA_ROOTS = [path.join(PUBLIC, "toons"), path.join(PUBLIC, "card-art")];

function wrangler(args, { inherit = false } = {}) {
  return spawnSync("npx", ["wrangler", ...args], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: inherit ? "inherit" : ["ignore", "pipe", "pipe"],
    env: process.env,
  });
}

function contentTypeFor(filePath) {
  return CONTENT_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

function keyForFile(absPath) {
  return path.relative(PUBLIC, absPath).split(path.sep).join("/");
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

function collectLocalMedia() {
  const files = [];
  for (const root of MEDIA_ROOTS) {
    if (!fs.existsSync(root)) continue;
    walkMedia(root, files);
  }
  return files.sort();
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

/**
 * Put one object and update the lockfile.
 * @param {string} absPath - local file
 * @param {{ bucket?: string, dryRun?: boolean, updateLock?: boolean, key?: string, contentType?: string, cacheControl?: string }} [opts]
 * @returns {boolean}
 */
function putObject(
  absPath,
  {
    bucket = DEFAULT_BUCKET,
    dryRun = false,
    updateLock = true,
    key = null,
    contentType = null,
    cacheControl = null,
  } = {}
) {
  const objectKey = key || keyForFile(absPath);
  const type = contentType || contentTypeFor(absPath);
  const cache = cacheControl || CACHE_CONTROL;
  if (dryRun) {
    console.log(`[dry-run] put ${bucket}/${objectKey}`);
    return true;
  }
  const res = wrangler([
    "r2",
    "object",
    "put",
    `${bucket}/${objectKey}`,
    `--file=${absPath}`,
    `--content-type=${type}`,
    `--cache-control=${cache}`,
    "--remote",
  ]);
  if (res.status !== 0) {
    console.error(`FAIL ${objectKey}`);
    console.error((res.stderr || res.stdout || "").trim().slice(0, 500));
    return false;
  }
  console.log(`ok   ${objectKey}`);
  if (updateLock) {
    const lock = loadLock();
    if (!lock.keys || typeof lock.keys !== "object") lock.keys = {};
    lock.bucket = bucket;
    lock.keys[objectKey] = {
      size: fs.statSync(absPath).size,
      uploadedAt: new Date().toISOString(),
    };
    saveLock(lock);
  }
  return true;
}

/**
 * Download one R2 object to a local path.
 * @returns {boolean}
 */
function getObject(key, destPath, { bucket = DEFAULT_BUCKET, dryRun = false } = {}) {
  if (dryRun) {
    console.log(`[dry-run] get ${bucket}/${key} → ${destPath}`);
    return true;
  }
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  const res = wrangler(["r2", "object", "get", `${bucket}/${key}`, `--file=${destPath}`, "--remote"]);
  if (res.status !== 0) {
    console.error(`FAIL get ${key}`);
    console.error((res.stderr || res.stdout || "").trim().slice(0, 500));
    return false;
  }
  console.log(`ok   get ${key} → ${path.relative(ROOT, destPath)}`);
  return true;
}

function createBucket(bucket = DEFAULT_BUCKET, dryRun = false) {
  if (dryRun) {
    console.log(`[dry-run] r2 bucket create ${bucket}`);
    return true;
  }
  console.log(`Creating R2 bucket: ${bucket}`);
  return wrangler(["r2", "bucket", "create", bucket], { inherit: true }).status === 0;
}

function setupCors(bucket = DEFAULT_BUCKET, dryRun = false) {
  if (!fs.existsSync(CORS_PATH)) {
    console.error(`Missing CORS config: ${CORS_PATH}`);
    return false;
  }
  if (dryRun) {
    console.log(`[dry-run] r2 bucket cors set ${bucket}`);
    return true;
  }
  console.log(`Setting CORS on ${bucket}`);
  return wrangler(["r2", "bucket", "cors", "set", bucket, `--file=${CORS_PATH}`], { inherit: true }).status === 0;
}

function enableDevUrl(bucket = DEFAULT_BUCKET, dryRun = false) {
  if (dryRun) {
    console.log(`[dry-run] r2 bucket dev-url enable ${bucket}`);
    return true;
  }
  console.log(`Enabling public r2.dev URL for ${bucket}`);
  return wrangler(["r2", "bucket", "dev-url", "enable", bucket], { inherit: true }).status === 0;
}

module.exports = {
  ROOT,
  PUBLIC,
  LOCK_PATH,
  DEFAULT_BUCKET,
  MEDIA_EXT,
  MEDIA_ROOTS,
  CACHE_CONTROL,
  wrangler,
  contentTypeFor,
  keyForFile,
  walkMedia,
  collectLocalMedia,
  loadLock,
  saveLock,
  putObject,
  getObject,
  createBucket,
  setupCors,
  enableDevUrl,
};
