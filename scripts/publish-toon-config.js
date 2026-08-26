#!/usr/bin/env node
/**
 * Publish content/toons/<toon>/config.json → R2 as config.<md5>.json
 * and update src/toons/config-lock.json.
 *
 * Runtime readers load only from CDN (VITE_ASSET_BASE + lock).
 *
 *   npm run publish-toon-config
 *   npm run publish-toon-config -- --toon jax
 *   npm run publish-toon-config -- --dry-run
 *   npm run publish-toon-config -- --lock-only   # hash + lock, skip R2
 *   npm run publish-toon-config -- --skip-unchanged  # R2 put only when the md5 is new
 */
const path = require("node:path");
const {
  publishToonConfig,
  listToonsWithConfig,
  loadConfigLock,
  LOCK_PATH,
  ROOT,
  referenceConfigPath,
} = require("./lib/toon-config");

function parseArgs(argv) {
  const opts = { toon: null, dryRun: false, lockOnly: false, skipUnchanged: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-h" || a === "--help") opts.help = true;
    else if (a === "--dry-run") opts.dryRun = true;
    else if (a === "--lock-only") opts.lockOnly = true;
    else if (a === "--skip-unchanged") opts.skipUnchanged = true;
    else if (a === "--toon") opts.toon = argv[++i];
    else if (a.startsWith("--toon=")) opts.toon = a.slice("--toon=".length);
    else {
      console.error(`Unknown option: ${a}`);
      opts.help = true;
    }
  }
  return opts;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(`Usage: node scripts/publish-toon-config.js [--toon jax|erin] [--dry-run] [--lock-only] [--skip-unchanged]

  Reference: content/toons/<toon>/config.json  (edit this)
  CDN key:   toons/<toon>/config.<md5>.json
  Lock:      ${path.relative(ROOT, LOCK_PATH)}
`);
    process.exit(0);
  }

  const toons = opts.toon ? [opts.toon.toLowerCase()] : listToonsWithConfig();
  if (!toons.length) {
    console.log("No reference configs under content/toons/*/config.json");
    process.exit(0);
  }

  if (opts.dryRun) console.log("(dry-run)");
  if (opts.lockOnly) console.log("(lock-only — no R2 upload)");
  if (opts.skipUnchanged) console.log("(skip-unchanged — R2 put only when the md5 is new)");

  for (const toon of toons) {
    try {
      const result = publishToonConfig(toon, {
        dryRun: opts.dryRun,
        skipUpload: opts.lockOnly,
        skipUnchanged: opts.skipUnchanged,
      });
      console.log(
        `${toon}: ${result.fileName}` +
          (result.changed ? " (updated lock)" : " (unchanged hash)") +
          (result.uploaded ? " + uploaded" : "")
      );
      console.log(`  ref:  ${path.relative(ROOT, referenceConfigPath(toon))}`);
      console.log(`  cdn:  ${result.r2Key}`);
      console.log(`  site: ${result.sitePath}`);
    } catch (err) {
      console.error(`${toon}: ${err.message || err}`);
      process.exit(1);
    }
  }

  if (!opts.dryRun) {
    console.log(`\nLock: ${path.relative(ROOT, LOCK_PATH)}`);
    console.log(JSON.stringify(loadConfigLock(), null, 2));
  }
}

main();
