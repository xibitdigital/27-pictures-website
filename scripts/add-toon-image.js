#!/usr/bin/env node
/**
 * Add a new toon page image: watermark → content-hash → place under public/toons/.
 *
 * Usage:
 *   npm run add-image -- ~/Downloads/page.jpg --toon jax
 *   npm run add-image -- ./export.png --toon erin --upload --manifest
 *   make add-image SRC=~/Downloads/page.jpg TOON=jax
 *   make add-image SRC=./page.jpg TOON=jax UPLOAD=1 MANIFEST=1
 *
 * Steps:
 *   1. Copy source into a temp work dir
 *   2. Bake "twentyseven.pictures" watermark (unless --no-watermark)
 *   3. Rename by md5 of the final bytes → public/toons/<toon>/assets/<md5>.<ext>
 *   4. Optionally append to that toon's manifest.json (--manifest)
 *   5. Optionally put the object in R2 (--upload)
 *
 * Prints the relative path to paste into manifest/words if you skip --manifest.
 */

const { spawnSync } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const WATERMARK = path.join(__dirname, "watermark-images.sh");

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp"]);

const DEFAULT_TOONS = new Set(["jax", "erin"]);

function parseArgs(argv) {
  const opts = {
    src: null,
    toon: null,
    destDir: null,
    watermark: true,
    upload: false,
    manifest: false,
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
    else if (a === "--manifest") opts.manifest = true;
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

Add a toon page image: watermark, content-hash, place under public/toons/.

Options:
  --toon NAME       Target toon (jax | erin). Required unless --dest is set.
  --dest DIR        Explicit output directory (overrides --toon assets path)
  --no-watermark    Skip watermark step
  --text TEXT       Watermark text (default: twentyseven.pictures)
  --manifest        Append assets/<hash>.ext to that toon's manifest.json
  --upload          Upload the new file to R2 (and update r2-assets-lock.json)
  --force           Overwrite if the hashed dest file already exists
  --dry-run         Show actions without writing
  -h, --help        Show this help

Examples:
  npm run add-image -- ~/Downloads/page17.jpg --toon jax
  npm run add-image -- ./page.png --toon erin --manifest --upload
  make add-image SRC=~/Downloads/page.jpg TOON=jax
  make add-image SRC=./page.jpg TOON=jax UPLOAD=1 MANIFEST=1
`);
}

function resolveSrc(src) {
  if (!src) return null;
  const expanded = src.startsWith("~/") ? path.join(os.homedir(), src.slice(2)) : src;
  return path.resolve(expanded);
}

function md5File(filePath) {
  const hash = crypto.createHash("md5");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

function contentTypeFor(ext) {
  const map = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
  };
  return map[ext.toLowerCase()] || "application/octet-stream";
}

function run(cmd, args, { inherit = true } = {}) {
  const res = spawnSync(cmd, args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: inherit ? "inherit" : ["ignore", "pipe", "pipe"],
    env: process.env,
  });
  if (res.status !== 0) {
    const err = (res.stderr || res.stdout || "").trim();
    if (err) console.error(err);
    process.exit(res.status || 1);
  }
  return res;
}

function appendManifest(toon, relAssetPath) {
  const manifestPath = path.join(ROOT, "public", "toons", toon, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    console.error(`error: no manifest at ${path.relative(ROOT, manifestPath)}`);
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const files = Array.isArray(data.files) ? data.files.slice() : [];
  if (files.includes(relAssetPath)) {
    console.log(`manifest: already lists ${relAssetPath}`);
    return;
  }
  files.push(relAssetPath);
  data.files = files;
  data.pages = files.length;
  fs.writeFileSync(manifestPath, JSON.stringify(data, null, 2) + "\n");
  console.log(`manifest: appended → ${path.relative(ROOT, manifestPath)} (pages=${data.pages})`);
}

function uploadOne(absDest) {
  const key = path.relative(path.join(ROOT, "public"), absDest).split(path.sep).join("/");
  const bucket = process.env.R2_BUCKET || "twentyseven-assets";
  const ext = path.extname(absDest).toLowerCase();
  console.log(`→ R2 put ${bucket}/${key}`);
  run("npx", [
    "wrangler",
    "r2",
    "object",
    "put",
    `${bucket}/${key}`,
    `--file=${absDest}`,
    `--content-type=${contentTypeFor(ext)}`,
    "--cache-control=public, max-age=31536000, immutable",
    "--remote",
  ]);

  // Keep lock in sync so bulk upload-assets skips this key later
  const lockPath = path.join(__dirname, "r2-assets-lock.json");
  let lock = { bucket, keys: {} };
  try {
    lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
  } catch {
    /* new lock */
  }
  if (!lock.keys || typeof lock.keys !== "object") lock.keys = {};
  lock.bucket = bucket;
  lock.keys[key] = {
    size: fs.statSync(absDest).size,
    uploadedAt: new Date().toISOString(),
  };
  fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + "\n");
  console.log(`lock: updated scripts/r2-assets-lock.json`);
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help || !opts.src) {
    printHelp();
    process.exit(opts.help ? 0 : 1);
  }

  const src = resolveSrc(opts.src);
  if (!src || !fs.existsSync(src) || !fs.statSync(src).isFile()) {
    console.error(`error: source image not found: ${opts.src}`);
    process.exit(1);
  }

  let ext = path.extname(src).toLowerCase();
  if (!IMAGE_EXT.has(ext)) {
    console.error(`error: unsupported image type "${ext}" (use jpg/jpeg/png/webp)`);
    process.exit(1);
  }
  // Normalize jpeg → .jpg for site convention
  if (ext === ".jpeg") ext = ".jpg";

  let destDir;
  if (opts.destDir) {
    destDir = path.resolve(
      opts.destDir.startsWith("~/") ? path.join(os.homedir(), opts.destDir.slice(2)) : opts.destDir
    );
  } else if (opts.toon) {
    const toon = opts.toon.toLowerCase();
    if (!DEFAULT_TOONS.has(toon)) {
      console.warn(`warning: unknown toon "${toon}" — writing to public/toons/${toon}/assets/`);
    }
    destDir = path.join(ROOT, "public", "toons", toon, "assets");
  } else {
    console.error("error: pass --toon <jax|erin> or --dest <dir>");
    printHelp();
    process.exit(1);
  }

  console.log(`Source:  ${src}`);
  console.log(`Dest:    ${path.relative(ROOT, destDir) || destDir}`);
  console.log(`Watermark: ${opts.watermark ? opts.text : "(skipped)"}`);
  if (opts.manifest) console.log(`Manifest: yes`);
  if (opts.upload) console.log(`Upload:  R2`);
  if (opts.dryRun) console.log(`(dry-run)`);

  const work = fs.mkdtempSync(path.join(os.tmpdir(), "add-toon-image-"));
  const workFile = path.join(work, `input${ext === ".jpg" ? ".jpg" : ext}`);
  try {
    fs.copyFileSync(src, workFile);

    if (opts.watermark) {
      if (!fs.existsSync(WATERMARK)) {
        console.error(`error: missing ${WATERMARK}`);
        process.exit(1);
      }
      if (opts.dryRun) {
        console.log(`[dry-run] watermark ${workFile}`);
      } else {
        console.log("→ Watermarking…");
        run("bash", [WATERMARK, work, "--text", opts.text, "--force"]);
      }
    }

    if (opts.dryRun) {
      console.log(`[dry-run] md5 + write → ${path.relative(ROOT, destDir)}/<hash>${ext}`);
      if (opts.manifest) console.log(`[dry-run] append to manifest`);
      if (opts.upload) console.log(`[dry-run] upload to R2`);
      return;
    }

    const hash = md5File(workFile);
    const destName = `${hash}${ext}`;
    const absDest = path.join(destDir, destName);
    const relFromPublic = path.relative(path.join(ROOT, "public"), absDest).split(path.sep).join("/");
    const relAsset = `assets/${destName}`;

    if (fs.existsSync(absDest) && !opts.force) {
      console.log(`Already present (same content): ${path.relative(ROOT, absDest)}`);
      console.log(`  manifest path: ${relAsset}`);
      if (opts.manifest && opts.toon) appendManifest(opts.toon.toLowerCase(), relAsset);
      if (opts.upload) uploadOne(absDest);
      console.log("\nDone (no rewrite).");
      return;
    }

    fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(workFile, absDest);
    console.log(`→ Wrote ${path.relative(ROOT, absDest)}`);
    console.log(`  md5: ${hash}`);
    console.log(`  manifest entry: "${relAsset}"`);
    console.log(`  site path: /${relFromPublic}`);

    if (opts.manifest) {
      if (!opts.toon) {
        console.error("error: --manifest requires --toon");
        process.exit(1);
      }
      appendManifest(opts.toon.toLowerCase(), relAsset);
    }

    if (opts.upload) uploadOne(absDest);

    console.log("\nDone.");
    if (!opts.manifest) {
      console.log(`Add to manifest files[] if needed:\n  "${relAsset}"`);
    }
  } finally {
    try {
      fs.rmSync(work, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

main();
