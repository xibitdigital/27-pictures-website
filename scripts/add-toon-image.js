#!/usr/bin/env node
/**
 * Add a toon page image: watermark → content-hash → R2 (CDN).
 *
 * By default with --upload, the file does NOT stay under public/ — only on CDN.
 * Use --keep-local to also stage under public/toons/<toon>/assets/ (gitignored).
 *
 * Optional --config: append to content/toons/…/config.json + publish hashed config to R2.
 * --manifest is an alias for --config.
 */

const { spawnSync } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { ROOT, PUBLIC, putObject, contentTypeFor } = require("./lib/r2-media");
const { appendPageToReference, publishToonConfig } = require("./lib/toon-config");

const WATERMARK = path.join(ROOT, "scripts", "watermark-images.sh");
const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const DEFAULT_TOONS = new Set(["jax", "erin"]);

function parseArgs(argv) {
  const opts = {
    src: null,
    toon: null,
    destDir: null,
    watermark: true,
    upload: false,
    keepLocal: false,
    config: false,
    text: "twentyseven.pictures",
    force: false,
    dryRun: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-h" || a === "--help") opts.help = true;
    else if (a === "--toon") opts.toon = argv[++i];
    else if (a.startsWith("--toon=")) opts.toon = a.slice("--toon=".length);
    else if (a === "--dest") opts.destDir = argv[++i];
    else if (a.startsWith("--dest=")) opts.destDir = a.slice("--dest=".length);
    else if (a === "--no-watermark") opts.watermark = false;
    else if (a === "--upload") opts.upload = true;
    else if (a === "--keep-local") opts.keepLocal = true;
    else if (a === "--config" || a === "--manifest") opts.config = true;
    else if (a === "--force") opts.force = true;
    else if (a === "--dry-run") opts.dryRun = true;
    else if (a === "--text") opts.text = argv[++i];
    else if (a.startsWith("--text=")) opts.text = a.slice("--text=".length);
    else if (a.startsWith("-")) {
      console.error(`Unknown option: ${a}`);
      opts.help = true;
    } else if (!opts.src) opts.src = a;
    else {
      console.error(`Unexpected argument: ${a}`);
      opts.help = true;
    }
  }
  return opts;
}

function printHelp() {
  console.log(`Usage: node scripts/add-toon-image.js <image> --toon <jax|erin> [options]

  --upload       Put on R2 (CDN). Does not leave a file under public/ unless --keep-local
  --keep-local   Also write public/toons/<toon>/assets/<md5>.ext (gitignored staging)
  --config       Append page to content/ config + publish config to R2
  --no-watermark | --force | --dry-run | --text TEXT | --dest DIR

  --manifest is an alias for --config

  make add-image SRC=~/page.jpg TOON=jax CONFIG=1 UPLOAD=1
`);
}

function resolveSrc(src) {
  if (!src) return null;
  const expanded = src.startsWith("~/") ? path.join(os.homedir(), src.slice(2)) : src;
  return path.resolve(expanded);
}

function md5File(filePath) {
  return crypto.createHash("md5").update(fs.readFileSync(filePath)).digest("hex");
}

function run(cmd, args) {
  const res = spawnSync(cmd, args, { cwd: ROOT, encoding: "utf8", stdio: "inherit", env: process.env });
  if (res.status !== 0) process.exit(res.status || 1);
}

function contentTypeForExt(ext) {
  return contentTypeFor(`x${ext}`);
}

/**
 * Append page to content/ reference config, then publish hashed config to R2.
 */
function appendAndPublishConfig(toon, relAssetPath, { dryRun = false, skipUpload = false } = {}) {
  try {
    const { pages, already } = appendPageToReference(toon, relAssetPath);
    if (already) {
      console.log(`config: already lists ${relAssetPath}`);
    } else {
      console.log(`config: appended to content/toons/${toon}/config.json (pages=${pages.length})`);
    }
    const result = publishToonConfig(toon, { dryRun, skipUpload });
    console.log(`config: published ${result.fileName} → ${result.r2Key}`);
    return result;
  } catch (err) {
    console.error(`error: ${err.message || err}`);
    process.exit(1);
  }
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help || !opts.src) {
    printHelp();
    process.exit(opts.help ? 0 : 1);
  }

  const src = resolveSrc(opts.src);
  if (!src || !fs.existsSync(src) || !fs.statSync(src).isFile()) {
    console.error(`error: source not found: ${opts.src}`);
    process.exit(1);
  }

  let ext = path.extname(src).toLowerCase();
  if (!IMAGE_EXT.has(ext)) {
    console.error(`error: unsupported type "${ext}"`);
    process.exit(1);
  }
  if (ext === ".jpeg") ext = ".jpg";

  let toon = opts.toon ? opts.toon.toLowerCase() : null;
  let destDir;
  if (opts.destDir) {
    destDir = path.resolve(
      opts.destDir.startsWith("~/") ? path.join(os.homedir(), opts.destDir.slice(2)) : opts.destDir
    );
  } else if (toon) {
    if (!DEFAULT_TOONS.has(toon)) {
      console.warn(`warning: unknown toon "${toon}"`);
    }
    destDir = path.join(ROOT, "public", "toons", toon, "assets");
  } else {
    console.error("error: pass --toon or --dest");
    process.exit(1);
  }

  // Prefer CDN-only path: upload from temp unless --keep-local or no --upload (stage only)
  const stageLocal = opts.keepLocal || !opts.upload;

  console.log(`Source: ${src}`);
  console.log(`CDN:    toons/${toon || "?"}/assets/<md5>${ext}`);
  if (stageLocal) console.log(`Local:  ${path.relative(ROOT, destDir)} (--keep-local or no --upload)`);
  else console.log(`Local:  (none — CDN only)`);

  const work = fs.mkdtempSync(path.join(os.tmpdir(), "add-toon-image-"));
  const workFile = path.join(work, `input${ext}`);
  try {
    fs.copyFileSync(src, workFile);

    if (opts.watermark) {
      if (opts.dryRun) console.log("[dry-run] watermark");
      else {
        console.log("→ Watermarking…");
        run("bash", [WATERMARK, work, "--text", opts.text, "--force"]);
      }
    }

    if (opts.dryRun) {
      console.log("[dry-run] hash + optional local stage / upload / config");
      return;
    }

    const hash = md5File(workFile);
    const destName = `${hash}${ext}`;
    const absDest = path.join(destDir, destName);
    const relAsset = `assets/${destName}`;
    const r2Key = toon ? `toons/${toon}/assets/${destName}` : path.relative(PUBLIC, absDest).split(path.sep).join("/");

    console.log(`→ ${relAsset}`);

    if (opts.upload) {
      const ok = putObject(workFile, {
        key: r2Key,
        contentType: contentTypeForExt(ext),
      });
      if (!ok) process.exit(1);
      console.log(`→ CDN ${r2Key}`);
    }

    if (stageLocal) {
      fs.mkdirSync(destDir, { recursive: true });
      if (fs.existsSync(absDest) && !opts.force) {
        console.log(`Local already present: ${path.relative(ROOT, absDest)}`);
      } else {
        fs.copyFileSync(workFile, absDest);
        console.log(`→ Wrote ${path.relative(ROOT, absDest)}`);
      }
    } else if (fs.existsSync(absDest)) {
      // CDN-only run: drop any leftover local staging copy
      fs.unlinkSync(absDest);
      console.log(`→ Removed local staging copy ${path.relative(ROOT, absDest)}`);
    }

    if (opts.config) {
      if (!toon) {
        console.error("error: --config requires --toon");
        process.exit(1);
      }
      appendAndPublishConfig(toon, relAsset, { dryRun: false });
    } else if (!opts.upload && !stageLocal) {
      console.log(`  (config entry when ready: "${relAsset}")`);
    } else {
      console.log(`  config path: "${relAsset}"`);
    }

    console.log("Done.");
  } finally {
    try {
      fs.rmSync(work, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

main();
