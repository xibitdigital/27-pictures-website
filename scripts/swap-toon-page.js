#!/usr/bin/env node
/**
 * One-shot: image -> watermark -> WebP -> R2 -> config.json.
 *
 * Takes a source plate, bakes the site watermark, converts to WebP,
 * content-hashes it, uploads straight to R2 (public/ is never touched —
 * it's dev-serving / add-image staging, not a CDN detour), then either
 * replaces an existing page's `file` (keeping its captions) or appends a
 * new page.
 *
 *   node scripts/swap-toon-page.js ~/Downloads/plate.png --toon nero --page 1
 *   node scripts/swap-toon-page.js ~/Downloads/plate.png --toon nero            # appends
 *   node scripts/swap-toon-page.js ~/Downloads/plate.png --toon nero --page 1 --publish
 *   node scripts/swap-toon-page.js ~/Downloads/plate.png --toon nero --dry-run
 *
 * --page N: 1-based. N <= current page count replaces that page's file and
 * keeps its words[] untouched. N == count+1 (or omitting --page) appends a
 * new page with words: []. Anything past that is an error — no gaps.
 *
 * Does NOT auto-publish the config to R2 (the live reader needs the
 * published config, not just the repo file) unless --publish is passed —
 * mirrors every other tool here, which print the publish command instead of
 * running it, so a batch of edits can be reviewed before going live.
 *
 * Does NOT delete the page's previous asset from R2 — printed as a note for
 * a later `purge-r2-objects.js` pass, after confirming the replacement looks
 * right (and after `npm run backup-cdn`, per project convention).
 */

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync, spawnSync } = require("node:child_process");
const { ROOT, putObject } = require("./lib/r2-media");
const { readConfig, replacePageInReference, publishToonConfig } = require("./lib/toon-config");

const WATERMARK_SH = path.join(ROOT, "scripts", "watermark-images.sh");
const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function parseArgs(argv) {
  const opts = {
    src: null,
    toon: null,
    page: null,
    quality: 90,
    watermark: true,
    text: "twentyseven.pictures",
    publish: false,
    dryRun: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-h" || a === "--help") opts.help = true;
    else if (a === "--toon") opts.toon = argv[++i];
    else if (a.startsWith("--toon=")) opts.toon = a.slice("--toon=".length);
    else if (a === "--page") opts.page = Number(argv[++i]);
    else if (a.startsWith("--page=")) opts.page = Number(a.slice("--page=".length));
    else if (a === "--quality") opts.quality = Number(argv[++i]);
    else if (a.startsWith("--quality=")) opts.quality = Number(a.slice("--quality=".length));
    else if (a === "--no-watermark") opts.watermark = false;
    else if (a === "--text") opts.text = argv[++i];
    else if (a.startsWith("--text=")) opts.text = a.slice("--text=".length);
    else if (a === "--publish") opts.publish = true;
    else if (a === "--dry-run") opts.dryRun = true;
    else if (a.startsWith("-")) {
      console.error(`error: unknown option ${a}`);
      opts.help = true;
    } else if (!opts.src) opts.src = a;
    else {
      console.error(`error: unexpected argument ${a}`);
      opts.help = true;
    }
  }
  return opts;
}

function printHelp() {
  console.log(`Usage: node scripts/swap-toon-page.js <image> --toon <folder> [options]

  --toon          content/toons/<folder> slug (erin-the-revenge, nero, jax, …)
  --page N        1-based page to REPLACE. Omit, or pass count+1, to append.
                  N <= count replaces. There is no insert — PAGE=4 on a 17-page
                  book overwrites page 4. Mid-list insert: Claude.md
                  → “Adding a new toon page image”.
  --quality N     WebP quality, default 90
  --no-watermark  Skip baking the site watermark (use on already-stamped files)
  --text TEXT     Watermark text, default "twentyseven.pictures"
  --publish       Also publish config.json to R2 (default: prints the command)
  --dry-run       Report what would happen, write and upload nothing

Pipeline: flatten the source yourself, then this script watermarks, converts
to WebP, content-hashes, uploads to R2, and rewrites config.json.
Replacing a page keeps its existing captions — check panel gutters still match
or captions drift (see content/toons/<toon>/README.md).
`);
}

function magick(args) {
  return execFileSync("magick", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help || !opts.src || !opts.toon) {
    printHelp();
    process.exit(opts.src && opts.toon ? 0 : 1);
  }
  const src = path.resolve(opts.src);
  if (!fs.existsSync(src)) {
    console.error(`error: no such file: ${src}`);
    process.exit(1);
  }
  if (!IMAGE_EXT.has(path.extname(src).toLowerCase())) {
    console.error(`error: unsupported extension ${path.extname(src)} (want .jpg/.jpeg/.png/.webp)`);
    process.exit(1);
  }
  if (!Number.isFinite(opts.quality) || opts.quality < 1 || opts.quality > 100) {
    console.error(`error: --quality must be 1-100, got ${opts.quality}`);
    process.exit(1);
  }

  const config = readConfig(opts.toon);
  if (!config) {
    console.error(`error: no config at content/toons/${opts.toon}/config.json`);
    process.exit(1);
  }
  const pageCount = Array.isArray(config.pages) ? config.pages.length : 0;
  const targetPage = opts.page ?? pageCount + 1;
  if (!Number.isInteger(targetPage) || targetPage < 1 || targetPage > pageCount + 1) {
    console.error(
      `error: --page ${opts.page} out of range — ${opts.toon} has ${pageCount} page(s), max valid is ${pageCount + 1}`
    );
    process.exit(1);
  }
  const willAppend = targetPage === pageCount + 1;
  const oldFile = willAppend ? null : config.pages[targetPage - 1].file;

  console.log(`${opts.toon} page ${targetPage}${willAppend ? " (new)" : ` (replacing ${oldFile})`}`);
  console.log(`  source: ${path.relative(process.cwd(), src)}`);

  const [w, h] = magick([src, "-format", "%w %h", "info:"]).trim().split(/\s+/).map(Number);
  if (config.designWidth && config.designHeight && (w !== config.designWidth || h !== config.designHeight)) {
    console.log(`  ! ${w}x${h} does not match the book's design size ${config.designWidth}x${config.designHeight}`);
    console.log(`    panel gutters likely won't line up with existing captions on this page`);
  }

  if (opts.dryRun) {
    console.log(`  watermark: ${opts.watermark ? `"${opts.text}"` : "skipped"}`);
    console.log(`  convert:   webp q${opts.quality}`);
    console.log(`  upload:    toons/${opts.toon}/assets/<md5>.webp`);
    console.log(
      `  config:    ${willAppend ? "append page" : `replace pages[${targetPage - 1}].file`}, words[] untouched`
    );
    console.log(`  publish:   ${opts.publish ? "yes" : "no (prints the command instead)"}`);
    console.log("\n[dry-run] nothing written.");
    return;
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "swap-toon-page-"));
  try {
    const staged = path.join(tmp, `plate${path.extname(src)}`);
    fs.copyFileSync(src, staged);

    if (opts.watermark) {
      const res = spawnSync(WATERMARK_SH, [tmp, "--text", opts.text], { encoding: "utf8" });
      if (res.status !== 0) {
        console.error(res.stderr || res.stdout);
        throw new Error("watermark step failed");
      }
      console.log("  watermarked");
    }

    const webpPath = path.join(tmp, "plate.webp");
    magick([staged, "-quality", String(opts.quality), "-define", "webp:method=6", webpPath]);
    const bytes = fs.readFileSync(webpPath);
    const hash = crypto.createHash("md5").update(bytes).digest("hex");
    const hashedName = `${hash}.webp`;
    const hashedPath = path.join(tmp, hashedName);
    fs.renameSync(webpPath, hashedPath);
    console.log(
      `  webp: ${Math.round(fs.statSync(src).size / 1024)}KB -> ${Math.round(bytes.length / 1024)}KB (q${opts.quality})`
    );

    const key = `toons/${opts.toon}/assets/${hashedName}`;
    if (!putObject(hashedPath, { key })) {
      throw new Error(`upload failed for ${key}`);
    }

    const relAsset = `assets/${hashedName}`;
    const result = replacePageInReference(opts.toon, targetPage, relAsset);
    console.log(`  config: ${result.appended ? "appended" : "replaced"} -> ${relAsset}`);

    if (opts.publish) {
      const pub = publishToonConfig(opts.toon);
      console.log(`  published: ${pub.fileName}${pub.changed ? "" : " (unchanged hash)"}`);
    } else {
      console.log(`\nPublish when ready:  npm run publish-toon-config -- --toon ${opts.toon}`);
    }

    if (result.oldFile) {
      console.log(`\nSuperseded (not deleted): toons/${opts.toon}/${result.oldFile}`);
      console.log("Purge later with scripts/purge-r2-objects.js once verified — after npm run backup-cdn.");
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

main();
