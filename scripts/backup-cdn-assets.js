#!/usr/bin/env node
/**
 * Pull R2/CDN media listed in scripts/r2-assets-lock.json into cdn-backup/
 * (gitignored). Prefer public VITE_ASSET_BASE HTTPS; optional --via-r2 uses wrangler.
 *
 *   npm run backup-cdn
 *   npm run backup-cdn -- --images-only
 *   npm run backup-cdn -- --dry-run
 *   npm run backup-cdn -- --force   # re-download even if local file exists
 */

const fs = require("node:fs");
const path = require("node:path");
const https = require("node:https");
const http = require("node:http");
const { ROOT, LOCK_PATH, DEFAULT_BUCKET, loadLock, getObject } = require("./lib/r2-media");

const BACKUP_ROOT = path.join(ROOT, "cdn-backup");
const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

function parseArgs(argv) {
  const opts = {
    dryRun: false,
    force: false,
    imagesOnly: false,
    viaR2: false,
    out: BACKUP_ROOT,
    help: false,
    concurrency: 6,
  };
  for (const arg of argv) {
    if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--force") opts.force = true;
    else if (arg === "--images-only" || arg === "--images") opts.imagesOnly = true;
    else if (arg === "--via-r2") opts.viaR2 = true;
    else if (arg.startsWith("--out=")) opts.out = path.resolve(arg.slice("--out=".length));
    else if (arg.startsWith("--concurrency=")) opts.concurrency = Math.max(1, Number(arg.slice(15)) || 6);
    else if (arg === "--help" || arg === "-h") opts.help = true;
  }
  return opts;
}

function printHelp() {
  console.log(`Usage: node scripts/backup-cdn-assets.js [options]

  --images-only   Only .jpg/.png/.webp/.gif (default: all lock keys)
  --force         Re-download even when local file exists with matching size
  --dry-run       List actions only
  --via-r2        Use wrangler r2 object get (needs auth); default is public CDN URL
  --out=DIR       Destination root (default: cdn-backup/)
  --concurrency=N Parallel downloads (default: 6)

Reads keys from scripts/r2-assets-lock.json.
CDN base: VITE_ASSET_BASE from .env (required unless --via-r2).
`);
}

function loadEnvBase() {
  const fromEnv = (process.env.VITE_ASSET_BASE || "").replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  // Best-effort read .env without dumping secrets
  try {
    const envPath = path.join(ROOT, ".env");
    const text = fs.readFileSync(envPath, "utf8");
    for (const line of text.split("\n")) {
      const m = line.match(/^\s*VITE_ASSET_BASE\s*=\s*(.+?)\s*$/);
      if (m) return m[1].replace(/^["']|["']$/g, "").replace(/\/$/, "");
    }
  } catch {
    /* ignore */
  }
  return "";
}

function downloadUrl(url, destPath) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    const req = client.get(url, { timeout: 120000 }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        downloadUrl(res.headers.location, destPath).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      const tmp = `${destPath}.part`;
      const out = fs.createWriteStream(tmp);
      res.pipe(out);
      out.on("finish", () => {
        out.close(() => {
          fs.renameSync(tmp, destPath);
          resolve(fs.statSync(destPath).size);
        });
      });
      out.on("error", (err) => {
        try {
          fs.unlinkSync(tmp);
        } catch {
          /* ignore */
        }
        reject(err);
      });
    });
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy(new Error(`timeout ${url}`));
    });
  });
}

async function mapPool(items, concurrency, worker) {
  let i = 0;
  const results = new Array(items.length);
  async function run() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await worker(items[idx], idx);
    }
  }
  const n = Math.min(concurrency, Math.max(1, items.length));
  await Promise.all(Array.from({ length: n }, () => run()));
  return results;
}

function isImageKey(key) {
  return IMAGE_EXT.has(path.extname(key).toLowerCase());
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    printHelp();
    process.exit(0);
  }

  const lock = loadLock();
  const keys = Object.keys(lock.keys || {}).sort();
  if (!keys.length) {
    console.error(`No keys in ${path.relative(ROOT, LOCK_PATH)}`);
    process.exit(1);
  }

  const selected = opts.imagesOnly ? keys.filter(isImageKey) : keys;
  const base = loadEnvBase();
  if (!opts.viaR2 && !base) {
    console.error("Set VITE_ASSET_BASE in .env (public CDN origin), or pass --via-r2");
    process.exit(1);
  }

  console.log(`Backup → ${path.relative(ROOT, opts.out)}`);
  console.log(`Source: ${opts.viaR2 ? `r2://${DEFAULT_BUCKET}` : base}`);
  console.log(`Keys:   ${selected.length}${opts.imagesOnly ? " images" : ""} (lock has ${keys.length})`);

  let downloaded = 0;
  let skippedExisting = 0;
  let failed = 0;
  const failures = [];

  await mapPool(selected, opts.concurrency, async (key) => {
    const dest = path.join(opts.out, key);
    const expectedSize = lock.keys[key]?.size;

    if (!opts.force && fs.existsSync(dest)) {
      try {
        const st = fs.statSync(dest);
        if (!expectedSize || st.size === expectedSize) {
          skippedExisting += 1;
          return;
        }
      } catch {
        /* re-download */
      }
    }

    if (opts.dryRun) {
      console.log(`[dry-run] ${key}`);
      downloaded += 1;
      return;
    }

    try {
      if (opts.viaR2) {
        const ok = getObject(key, dest, { bucket: lock.bucket || DEFAULT_BUCKET });
        if (!ok) throw new Error("wrangler get failed");
      } else {
        const url = `${base}/${key}`;
        await downloadUrl(url, dest);
      }
      downloaded += 1;
      if (downloaded % 20 === 0 || downloaded === 1) {
        console.log(`… ${downloaded} downloaded, ${skippedExisting} skipped`);
      }
    } catch (err) {
      failed += 1;
      failures.push({ key, error: String(err.message || err) });
      console.error(`FAIL ${key}: ${err.message || err}`);
    }
  });

  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
  const manifest = {
    stamp,
    source: opts.viaR2 ? `r2://${lock.bucket || DEFAULT_BUCKET}` : base,
    bucket: lock.bucket || DEFAULT_BUCKET,
    imagesOnly: opts.imagesOnly,
    downloaded,
    skippedExisting,
    failed,
    failures,
    totalSelected: selected.length,
    totalKeysInLock: keys.length,
  };

  if (!opts.dryRun) {
    fs.mkdirSync(opts.out, { recursive: true });
    const stamped = path.join(opts.out, `BACKUP-MANIFEST-${stamp}.json`);
    const latest = path.join(opts.out, "BACKUP-MANIFEST-latest.json");
    fs.writeFileSync(stamped, JSON.stringify(manifest, null, 2) + "\n");
    fs.writeFileSync(latest, JSON.stringify(manifest, null, 2) + "\n");
    console.log(`Manifest: ${path.relative(ROOT, stamped)}`);
  }

  console.log(`Done: downloaded=${downloaded} skipped=${skippedExisting} failed=${failed} selected=${selected.length}`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
