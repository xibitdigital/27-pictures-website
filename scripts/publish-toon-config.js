#!/usr/bin/env node
/**
 * Publish content/toons/<toon>/config.json → R2 as config.<md5>.json
 * and update src/toons/config-lock.json.
 *
 * Runtime readers load only from CDN (VITE_ASSET_BASE + lock).
 * Puts happen locally (pre-commit on staged configs). CI only --check's the lock.
 *
 *   npm run publish-toon-config
 *   npm run publish-toon-config -- --toon jax
 *   npm run publish-toon-config -- --dry-run
 *   npm run publish-toon-config -- --lock-only   # hash + lock, skip R2
 *   npm run publish-toon-config -- --skip-unchanged  # R2 put only when the md5 is new
 *   npm run publish-toon-config -- --check       # verify lock matches hashes (CI)
 *   npm run publish-toon-config -- --staged      # pre-commit: publish staged configs, git-add locks
 */
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const {
  publishToonConfig,
  checkToonConfig,
  listToonsWithConfig,
  loadConfigLock,
  LOCK_PATH,
  ROOT,
  referenceConfigPath,
  toonFromConfigPath,
} = require("./lib/toon-config");
const { LOCK_PATH: R2_ASSETS_LOCK } = require("./lib/r2-media");

function parseArgs(argv) {
  const opts = {
    toon: null,
    dryRun: false,
    lockOnly: false,
    skipUnchanged: false,
    check: false,
    staged: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-h" || a === "--help") opts.help = true;
    else if (a === "--dry-run") opts.dryRun = true;
    else if (a === "--lock-only") opts.lockOnly = true;
    else if (a === "--skip-unchanged") opts.skipUnchanged = true;
    else if (a === "--check") opts.check = true;
    else if (a === "--staged") opts.staged = true;
    else if (a === "--toon") opts.toon = argv[++i];
    else if (a.startsWith("--toon=")) opts.toon = a.slice("--toon=".length);
    else {
      console.error(`Unknown option: ${a}`);
      opts.help = true;
    }
  }
  return opts;
}

function stagedConfigToons() {
  const res = spawnSync("git", ["diff", "--cached", "--name-only", "--", "content/toons"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  if (res.status !== 0) {
    throw new Error((res.stderr || res.stdout || "git diff --cached failed").trim());
  }
  const toons = new Set();
  for (const line of (res.stdout || "").split("\n")) {
    const toon = toonFromConfigPath(line.trim());
    if (toon) toons.add(toon);
  }
  return [...toons];
}

function gitAddLocks() {
  const files = [path.relative(ROOT, LOCK_PATH), path.relative(ROOT, R2_ASSETS_LOCK)];
  const res = spawnSync("git", ["add", "--", ...files], { cwd: ROOT, encoding: "utf8" });
  if (res.status !== 0) {
    throw new Error((res.stderr || res.stdout || "git add lock files failed").trim());
  }
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(`Usage: node scripts/publish-toon-config.js [--toon jax|erin] [--dry-run] [--lock-only] [--skip-unchanged] [--check] [--staged]

  Reference: content/toons/<toon>/config.json  (edit this)
  CDN key:   toons/<toon>/config.<md5>.json
  Lock:      ${path.relative(ROOT, LOCK_PATH)}

  --check    verify lock matches hashes (no R2). CI uses this.
  --staged   publish only toons with a staged config.json, then git-add locks.
`);
    process.exit(0);
  }

  let toons;
  if (opts.staged) {
    toons = stagedConfigToons();
    if (!toons.length) process.exit(0);
  } else if (opts.toon) {
    toons = [opts.toon.toLowerCase()];
  } else {
    toons = listToonsWithConfig();
  }
  if (!toons.length) {
    console.log("No reference configs under content/toons/*/config.json");
    process.exit(0);
  }

  if (opts.dryRun) console.log("(dry-run)");
  if (opts.lockOnly) console.log("(lock-only — no R2 upload)");
  if (opts.skipUnchanged) console.log("(skip-unchanged — R2 put only when the md5 is new)");
  if (opts.check) console.log("(check — lock must match hashes, no R2)");
  if (opts.staged) console.log("(staged — publish configs in this commit)");

  let uploadedAny = false;
  for (const toon of toons) {
    try {
      if (opts.check) {
        const result = checkToonConfig(toon);
        console.log(`${toon}: ${result.fileName} (lock ok)`);
        continue;
      }
      const result = publishToonConfig(toon, {
        dryRun: opts.dryRun,
        skipUpload: opts.lockOnly,
        skipUnchanged: opts.skipUnchanged || opts.staged,
      });
      if (result.uploaded) uploadedAny = true;
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

  if (opts.check) return;

  if (!opts.dryRun) {
    console.log(`\nLock: ${path.relative(ROOT, LOCK_PATH)}`);
    console.log(JSON.stringify(loadConfigLock(), null, 2));
  }

  if (opts.staged && !opts.dryRun) {
    gitAddLocks();
    if (uploadedAny) console.log("staged lock files for this commit");
  }
}

main();
