#!/usr/bin/env node
/**
 * Add a toon page: watermark → content-hash → public/toons/<toon>/assets/
 * Optional --manifest / --upload (R2 via shared lib).
 */

const { spawnSync } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { ROOT, putObject } = require("./lib/r2-media");

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

  --no-watermark | --manifest | --upload | --force | --dry-run
  --text TEXT | --dest DIR

  make add-image SRC=~/page.jpg TOON=jax MANIFEST=1 UPLOAD=1
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
  console.log(`manifest: appended (pages=${data.pages})`);
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

  let destDir;
  if (opts.destDir) {
    destDir = path.resolve(
      opts.destDir.startsWith("~/") ? path.join(os.homedir(), opts.destDir.slice(2)) : opts.destDir
    );
  } else if (opts.toon) {
    const toon = opts.toon.toLowerCase();
    if (!DEFAULT_TOONS.has(toon)) {
      console.warn(`warning: unknown toon "${toon}"`);
    }
    destDir = path.join(ROOT, "public", "toons", toon, "assets");
  } else {
    console.error("error: pass --toon or --dest");
    process.exit(1);
  }

  console.log(`Source: ${src}`);
  console.log(`Dest:   ${path.relative(ROOT, destDir)}`);

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
      console.log("[dry-run] hash + write + optional manifest/upload");
      return;
    }

    const hash = md5File(workFile);
    const destName = `${hash}${ext}`;
    const absDest = path.join(destDir, destName);
    const relAsset = `assets/${destName}`;

    if (fs.existsSync(absDest) && !opts.force) {
      console.log(`Already present: ${path.relative(ROOT, absDest)}`);
      if (opts.manifest && opts.toon) appendManifest(opts.toon.toLowerCase(), relAsset);
      if (opts.upload) putObject(absDest);
      return;
    }

    fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(workFile, absDest);
    console.log(`→ Wrote ${path.relative(ROOT, absDest)}`);
    console.log(`  manifest entry: "${relAsset}"`);

    if (opts.manifest) {
      if (!opts.toon) {
        console.error("error: --manifest requires --toon");
        process.exit(1);
      }
      appendManifest(opts.toon.toLowerCase(), relAsset);
    }
    if (opts.upload) putObject(absDest);
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
