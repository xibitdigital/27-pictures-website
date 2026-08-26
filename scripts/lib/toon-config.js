/**
 * Toon config workflow:
 *
 * - Reference (edit in repo): content/toons/<toon>/config.json
 * - Runtime (CDN only):       toons/<toon>/config.<md5>.json on R2
 * - Pointer in app:           src/toons/config-lock.json → { "jax": "config.<md5>.json" }
 *
 * Never put config under public/ — Pages must not ship it; readers fetch via VITE_ASSET_BASE.
 */
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { putObject, getObject, DEFAULT_BUCKET } = require("./r2-media");

const ROOT = path.resolve(__dirname, "../..");
const CONTENT_TOONS = path.join(ROOT, "content", "toons");
const LOCK_PATH = path.join(ROOT, "src", "toons", "config-lock.json");

const CONFIG_HASH_RE = /^config\.([a-f0-9]{32})\.json$/i;

function md5Bytes(buf) {
  return crypto.createHash("md5").update(buf).digest("hex");
}

function loadConfigLock() {
  try {
    return JSON.parse(fs.readFileSync(LOCK_PATH, "utf8"));
  } catch {
    return {};
  }
}

function saveConfigLock(lock) {
  fs.mkdirSync(path.dirname(LOCK_PATH), { recursive: true });
  const sorted = {};
  for (const key of Object.keys(lock).sort()) sorted[key] = lock[key];
  fs.writeFileSync(LOCK_PATH, JSON.stringify(sorted, null, 2) + "\n");
}

function contentToonDir(toon) {
  return path.join(CONTENT_TOONS, toon);
}

/** Editable reference: content/toons/<toon>/config.json */
function referenceConfigPath(toon) {
  return path.join(contentToonDir(toon), "config.json");
}

function readConfig(toon) {
  const abs = referenceConfigPath(toon);
  if (!fs.existsSync(abs)) return null;
  return JSON.parse(fs.readFileSync(abs, "utf8"));
}

/** Pretty-print + write reference config (repo). Does not touch CDN. */
function writeReferenceConfig(toon, data) {
  const abs = referenceConfigPath(toon);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  const body = JSON.stringify(data, null, 2) + "\n";
  fs.writeFileSync(abs, body);
  return abs;
}

/**
 * Hash reference config bytes → { fileName, md5, body, r2Key, sitePath }.
 * Does not write or upload.
 */
function hashConfigContent(toon, data) {
  const body = JSON.stringify(data, null, 2) + "\n";
  const md5 = md5Bytes(Buffer.from(body, "utf8"));
  const fileName = `config.${md5}.json`;
  return {
    fileName,
    md5,
    body,
    r2Key: `toons/${toon}/${fileName}`,
    sitePath: `/toons/${toon}/${fileName}`,
  };
}

/**
 * Publish reference config to R2 as config.<md5>.json and update config-lock.json.
 * @returns {{ fileName: string, r2Key: string, sitePath: string, md5: string, changed: boolean, uploaded: boolean }}
 */
function publishToonConfig(
  toon,
  { dryRun = false, bucket = DEFAULT_BUCKET, skipUpload = false, skipUnchanged = false } = {}
) {
  const data = readConfig(toon);
  if (!data) {
    throw new Error(`no reference config at ${path.relative(ROOT, referenceConfigPath(toon))}`);
  }

  const { fileName, md5, body, r2Key, sitePath } = hashConfigContent(toon, data);
  const lock = loadConfigLock();
  const changed = lock[toon] !== fileName;

  if (dryRun) {
    console.log(`[dry-run] ${toon}: ${fileName}${changed ? " (new)" : " (same hash)"}`);
    console.log(`[dry-run] r2 put ${bucket}/${r2Key}`);
    return { fileName, r2Key, sitePath, md5, changed, uploaded: false };
  }

  let uploaded = false;
  if (!skipUpload && !(skipUnchanged && !changed)) {
    const tmp = path.join(os.tmpdir(), `toon-config-${toon}-${md5}.json`);
    fs.writeFileSync(tmp, body);
    try {
      const ok = putObject(tmp, {
        bucket,
        key: r2Key,
        contentType: "application/json",
        updateLock: true,
      });
      if (!ok) throw new Error(`R2 upload failed for ${r2Key}`);
      uploaded = true;
    } finally {
      try {
        fs.unlinkSync(tmp);
      } catch {
        /* ignore */
      }
    }
  }

  lock[toon] = fileName;
  saveConfigLock(lock);

  return { fileName, r2Key, sitePath, md5, changed, uploaded };
}

/**
 * Download current locked config from R2 into content/toons/<toon>/config.json.
 */
function downloadToonConfig(toon, { dryRun = false, bucket = DEFAULT_BUCKET } = {}) {
  const lock = loadConfigLock();
  const fileName = lock[toon];
  if (!fileName || !CONFIG_HASH_RE.test(fileName)) {
    throw new Error(`no lock entry for "${toon}" in ${path.relative(ROOT, LOCK_PATH)}`);
  }
  const r2Key = `toons/${toon}/${fileName}`;
  const dest = referenceConfigPath(toon);

  if (dryRun) {
    console.log(`[dry-run] get ${bucket}/${r2Key} → ${path.relative(ROOT, dest)}`);
    return { r2Key, dest };
  }

  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const ok = getObject(r2Key, dest, { bucket });
  if (!ok) throw new Error(`R2 download failed for ${r2Key}`);
  return { r2Key, dest };
}

function listToonsWithConfig() {
  if (!fs.existsSync(CONTENT_TOONS)) return [];
  return fs
    .readdirSync(CONTENT_TOONS, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) => fs.existsSync(referenceConfigPath(name)));
}

/** `content/toons/<toon>/config.json` → toon folder name, or null. */
function toonFromConfigPath(filePath) {
  const norm = String(filePath || "")
    .replace(/\\/g, "/")
    .replace(/^\.\//, "");
  const m = norm.match(/(?:^|\/)content\/toons\/([^/]+)\/config\.json$/);
  return m ? m[1] : null;
}

/**
 * Fail if the lock does not point at this toon's current config hash.
 * No R2. Used by CI so a forgotten local publish cannot ship.
 */
function checkToonConfig(toon) {
  const data = readConfig(toon);
  if (!data) {
    throw new Error(`no reference config at ${path.relative(ROOT, referenceConfigPath(toon))}`);
  }
  const { fileName, r2Key, sitePath, md5 } = hashConfigContent(toon, data);
  const lock = loadConfigLock();
  const locked = lock[toon] || null;
  if (locked !== fileName) {
    throw new Error(
      `${toon}: lock has ${locked || "(none)"}, config hashes to ${fileName}. ` +
        `Publish locally (pre-commit, or npm run publish-toon-config -- --toon ${toon}) ` +
        `and commit src/toons/config-lock.json.`
    );
  }
  return { fileName, r2Key, sitePath, md5, locked: true };
}

/** Site path for fetch: /toons/jax/config.<md5>.json (served from CDN). */
function siteConfigPath(toon) {
  const lock = loadConfigLock();
  const file = lock[toon];
  if (!file) return null;
  return `/toons/${toon}/${file}`;
}

/** Append a page image to the reference config (local only). */
function appendPageToReference(toon, relAssetPath) {
  const data = readConfig(toon);
  if (!data) {
    throw new Error(`no reference config for "${toon}"`);
  }
  const pages = Array.isArray(data.pages) ? data.pages.slice() : [];
  if (pages.some((p) => p && p.file === relAssetPath)) {
    return { data, pages, already: true };
  }
  pages.push({ file: relAssetPath, words: [] });
  data.pages = pages;
  if (data.files != null) delete data.files;
  writeReferenceConfig(toon, data);
  return { data, pages, already: false };
}

/**
 * Replace an existing page's `file` in place (1-based `pageNum`), keeping its
 * `words` untouched. `pageNum === pages.length + 1` appends a new page
 * instead — same one-past-the-end convention as a normal array push.
 * @returns {{ data: object, oldFile: string|null, appended: boolean }}
 */
function replacePageInReference(toon, pageNum, relAssetPath) {
  const data = readConfig(toon);
  if (!data) {
    throw new Error(`no reference config for "${toon}"`);
  }
  const pages = Array.isArray(data.pages) ? data.pages : (data.pages = []);
  if (!Number.isInteger(pageNum) || pageNum < 1 || pageNum > pages.length + 1) {
    throw new Error(
      `page ${pageNum} out of range — ${toon} has ${pages.length} page(s), max valid is ${pages.length + 1}`
    );
  }
  const idx = pageNum - 1;
  if (idx === pages.length) {
    pages.push({ file: relAssetPath, words: [] });
    writeReferenceConfig(toon, data);
    return { data, oldFile: null, appended: true };
  }
  const oldFile = pages[idx].file;
  pages[idx] = { ...pages[idx], file: relAssetPath };
  writeReferenceConfig(toon, data);
  return { data, oldFile, appended: false };
}

module.exports = {
  ROOT,
  CONTENT_TOONS,
  LOCK_PATH,
  CONFIG_HASH_RE,
  md5Bytes,
  loadConfigLock,
  saveConfigLock,
  contentToonDir,
  referenceConfigPath,
  readConfig,
  writeReferenceConfig,
  hashConfigContent,
  publishToonConfig,
  downloadToonConfig,
  listToonsWithConfig,
  toonFromConfigPath,
  checkToonConfig,
  siteConfigPath,
  appendPageToReference,
  replacePageInReference,
};
