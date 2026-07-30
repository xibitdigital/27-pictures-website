#!/usr/bin/env node
/**
 * Pull current CDN config into the local reference file.
 *
 *   npm run download-toon-config
 *   npm run download-toon-config -- --toon jax
 *
 * Uses src/toons/config-lock.json to know which config.<md5>.json is live.
 */
const path = require("node:path");
const {
  downloadToonConfig,
  listToonsWithConfig,
  loadConfigLock,
  ROOT,
  referenceConfigPath,
} = require("./lib/toon-config");

function parseArgs(argv) {
  const opts = { toon: null, dryRun: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-h" || a === "--help") opts.help = true;
    else if (a === "--dry-run") opts.dryRun = true;
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
    console.log(`Usage: node scripts/download-toon-config.js [--toon jax|erin] [--dry-run]

  Writes content/toons/<toon>/config.json from R2 (lock → config.<md5>.json).
`);
    process.exit(0);
  }

  const lock = loadConfigLock();
  const toons = opts.toon
    ? [opts.toon.toLowerCase()]
    : Object.keys(lock).length
      ? Object.keys(lock).sort()
      : listToonsWithConfig();

  if (!toons.length) {
    console.log("No toons in config-lock.json");
    process.exit(0);
  }

  if (opts.dryRun) console.log("(dry-run)");

  for (const toon of toons) {
    try {
      const result = downloadToonConfig(toon, { dryRun: opts.dryRun });
      console.log(`${toon}: ${result.r2Key} → ${path.relative(ROOT, result.dest || referenceConfigPath(toon))}`);
    } catch (err) {
      console.error(`${toon}: ${err.message || err}`);
      process.exit(1);
    }
  }
}

main();
