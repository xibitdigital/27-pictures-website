#!/usr/bin/env node
/**
 * Convert the page plates referenced by content/toons/<toon>/config.json to
 * WebP, into converted/<toon>/ (gitignored). Filenames are kept — only the
 * extension changes — so each output lines up 1:1 with the config entry it
 * came from.
 *
 * A black band is painted across the bottom first, covering the watermark
 * that scripts/watermark-images.sh bakes into the pixels (southeast, +20+16,
 * pointsize 22). On these plates the watermark sits on the black outer
 * border, so the band is invisible; where the border is not dark the band is
 * skipped rather than stamping a bar over artwork. Re-watermark afterwards
 * if the CDN copy should keep one — the band just clears space for it:
 *   npm run watermark -- converted/<toon> --backup
 *
 *   npm run convert-plates -- --toon nero --dry-run
 *   npm run convert-plates -- --toon nero
 *   npm run convert-plates -- --toon nero --quality 85 --no-band
 *   npm run convert-plates -- --toon nero --upload           # hash + push to R2, rewrite config
 *
 * Sources come from cdn-backup/ only (npm run backup-cdn -- --images-only) —
 * the CDN is the source of truth. public/toons/<toon>/assets is a gitignored
 * dev-serving / add-image staging area; conversions never read or write
 * there. --upload hashes straight out of converted/<toon>/ and pushes to R2
 * directly, so public/ never becomes a detour for CDN-bound files.
 */

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { ROOT, putObject } = require("./lib/r2-media");

const DESIGN_W = 800;
const DESIGN_H = 1424;
// Watermark box measured on an 800x1424 plate: 203x21 at +576+1386.
const WM_TOP = 1386;
// Never scan for artwork under the watermark itself — it is bright too.
const WM_LEFT = 560;
const ART_THRESHOLD = 40;
const DARK_MAX = 24;

function parseArgs(argv) {
  const opts = {
    toon: null,
    quality: 90,
    band: true,
    bandTop: null,
    out: null,
    upload: false,
    dryRun: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--toon") opts.toon = argv[++i];
    else if (a.startsWith("--toon=")) opts.toon = a.slice("--toon=".length);
    else if (a === "--quality") opts.quality = Number(argv[++i]);
    else if (a.startsWith("--quality=")) opts.quality = Number(a.slice("--quality=".length));
    else if (a === "--band-top") opts.bandTop = Number(argv[++i]);
    else if (a.startsWith("--band-top=")) opts.bandTop = Number(a.slice("--band-top=".length));
    else if (a === "--out") opts.out = argv[++i];
    else if (a.startsWith("--out=")) opts.out = a.slice("--out=".length);
    else if (a === "--no-band") opts.band = false;
    else if (a === "--upload") opts.upload = true;
    else if (a === "--dry-run") opts.dryRun = true;
    else if (a === "--help" || a === "-h") opts.help = true;
  }
  return opts;
}

function printHelp() {
  console.log(`Usage: node scripts/convert-toon-plates.js --toon <name> [options]

  --toon NAME     jax | erin | nero (required)
  --quality N     WebP quality, default 90
  --no-band       Keep the watermark; convert only
  --band-top N    Force the band's top row (default: per page, below the artwork)
  --out DIR       Output root, default converted/
  --upload        Hash + push to R2 from converted/, rewrite config.json
  --dry-run       Report what would happen, write nothing

Only plates listed in the config are converted. Output keeps the source
filename with a .webp extension. Without --upload nothing is uploaded or
rewritten. Re-watermark converted/<toon> yourself first if the CDN copy
should carry one:  npm run watermark -- converted/<toon> --backup
`);
}

function magick(args) {
  return execFileSync("magick", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

/** Mean brightness 0-255 of a crop, used to prove the band area is already dark. */
function meanBrightness(src, geom) {
  const txt = magick([src, "-crop", geom, "+repage", "-colorspace", "gray", "-scale", "1x1!", "-depth", "8", "txt:-"]);
  const m = txt.match(/\(\s*(\d+)/);
  return m ? Number(m[1]) : 255;
}

/** Lowest row containing artwork, ignoring the watermark's own columns. */
function lowestArtRow(src, height) {
  const from = Math.max(0, height - 120);
  const txt = magick([
    src,
    "-crop",
    `${WM_LEFT}x${height - from}+0+${from}`,
    "+repage",
    "-colorspace",
    "gray",
    "-resize",
    `1x${height - from}!`,
    "-depth",
    "8",
    "txt:-",
  ]);
  let lowest = null;
  for (const line of txt.split("\n").slice(1)) {
    const m = line.match(/^\s*\d+,(\d+):\s*\(\s*(\d+)/);
    if (m && Number(m[2]) > ART_THRESHOLD) lowest = from + Number(m[1]);
  }
  return lowest;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help || !opts.toon) {
    printHelp();
    process.exit(opts.toon ? 0 : 1);
  }
  if (!Number.isFinite(opts.quality) || opts.quality < 1 || opts.quality > 100) {
    console.error(`error: --quality must be 1-100, got ${opts.quality}`);
    process.exit(1);
  }

  const configPath = path.join(ROOT, "content", "toons", opts.toon, "config.json");
  if (!fs.existsSync(configPath)) {
    console.error(`error: no config at ${path.relative(ROOT, configPath)}`);
    process.exit(1);
  }
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

  const backupDir = path.join(ROOT, "cdn-backup", "toons", opts.toon, "assets");
  const outDir = path.resolve(ROOT, opts.out || "converted", opts.toon);
  if (!opts.dryRun) fs.mkdirSync(outDir, { recursive: true });

  console.log(`Convert ${opts.toon}: WebP q${opts.quality}${opts.band ? " + watermark band" : ""}`);
  console.log(`  source: ${path.relative(ROOT, backupDir)}/`);
  console.log(`  output: ${path.relative(ROOT, outDir)}/\n`);

  let totalBefore = 0;
  let totalAfter = 0;
  let done = 0;
  let missing = 0;

  config.pages.forEach((page, idx) => {
    const name = page.file.split("/").pop();
    const stem = name.replace(/\.[^.]+$/, "");
    // Source of truth is the CDN, mirrored locally by `npm run backup-cdn`.
    // public/toons is only an upload/dev staging area and is not read here.
    const src = path.join(backupDir, name);
    if (!fs.existsSync(src)) {
      console.log(`  ${String(idx + 1).padStart(2)}: MISSING ${name} — run: npm run backup-cdn -- --images-only`);
      missing++;
      return;
    }

    const [w, h] = magick([src, "-format", "%w %h", "info:"]).trim().split(/\s+/).map(Number);

    let bandTop = null;
    let note = "";
    if (opts.band) {
      if (opts.bandTop != null) bandTop = opts.bandTop;
      else if (w === DESIGN_W && h === DESIGN_H) {
        const art = lowestArtRow(src, h);
        bandTop = Math.min(art == null ? WM_TOP - 1 : art + 1, WM_TOP - 1);
        const mean = meanBrightness(src, `${WM_LEFT}x${h - bandTop}+0+${bandTop}`);
        if (mean > DARK_MAX) {
          note = `  band skipped (area not dark, mean ${mean})`;
          bandTop = null;
        }
      } else {
        note = `  band skipped (${w}x${h})`;
      }
    }

    const dest = path.join(outDir, `${stem}.webp`);
    const before = fs.statSync(src).size;

    if (opts.dryRun) {
      console.log(
        `  ${String(idx + 1).padStart(2)}: ${stem}.webp${bandTop != null ? `  band y>=${bandTop}` : ""}${note}`
      );
      return;
    }

    const args = [src];
    if (bandTop != null) args.push("-fill", "black", "-draw", `rectangle 0,${bandTop} ${w - 1},${h - 1}`);
    args.push("-quality", String(opts.quality), "-define", "webp:method=6", dest);
    magick(args);

    const after = fs.statSync(dest).size;
    totalBefore += before;
    totalAfter += after;
    done++;

    let uploadNote = "";
    if (opts.upload) {
      // Hash straight out of converted/, and go directly to R2 — public/
      // is never used as a detour for CDN-bound files.
      const bytes = fs.readFileSync(dest);
      const hash = crypto.createHash("md5").update(bytes).digest("hex");
      const hashedName = `${hash}.webp`;
      const hashedPath = path.join(outDir, hashedName);
      fs.copyFileSync(dest, hashedPath);
      const key = `toons/${opts.toon}/assets/${hashedName}`;
      const ok = putObject(hashedPath, { key });
      if (!ok) {
        uploadNote = "  UPLOAD FAILED";
        process.exitCode = 1;
      } else {
        page.file = `assets/${hashedName}`;
        uploadNote = `  -> ${key}`;
      }
    }

    console.log(
      `  ${String(idx + 1).padStart(2)}: ${stem}.webp  ${String(Math.round(before / 1024)).padStart(4)}KB -> ${String(
        Math.round(after / 1024)
      ).padStart(4)}KB` +
        ` (-${Math.round((1 - after / before) * 100)}%)${
          bandTop != null ? `  band y>=${bandTop}` : ""
        }${note}${uploadNote}`
    );
  });

  if (opts.dryRun) {
    console.log(
      `\n[dry-run] ${config.pages.length - missing} plate(s) would be written to ${path.relative(ROOT, outDir)}/`
    );
    return;
  }
  if (opts.upload && done > 0) {
    fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
    console.log(`\nRewrote ${path.relative(ROOT, configPath)} — publish with:`);
    console.log(`  npm run publish-toon-config -- --toon ${opts.toon}`);
  }
  console.log(
    `\nDone: ${done} converted${missing ? `, ${missing} missing` : ""} — ` +
      `${(totalBefore / 1048576).toFixed(1)}MB -> ${(totalAfter / 1048576).toFixed(1)}MB ` +
      `(-${Math.round((1 - totalAfter / totalBefore) * 100)}%)`
  );
  console.log(`Output: ${path.relative(ROOT, outDir)}/  (gitignored, nothing uploaded)`);
}

main();
