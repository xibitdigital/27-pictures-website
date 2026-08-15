#!/usr/bin/env node
/**
 * Ship a toon: upload assets → verify → publish config → deploy.
 *
 * The four steps have to happen in this order and all four have to happen.
 * Publishing a config whose plates are not on R2 yet puts a broken page live;
 * publishing without deploying changes nothing at all, because the config hash
 * the reader asks for is compiled into the JS bundle — that is how RED SMILE
 * served 7 pages while the repo had 12.
 *
 *   npm run ship-toon -- --toon erin-the-revenge              # → staging
 *   npm run ship-toon -- --toon erin-the-revenge --production # → twentyseven.pictures
 *   npm run ship-toon -- --toon erin-the-revenge --dry-run    # report, change nothing
 *   npm run ship-toon -- --toon erin-the-revenge --skip-upload
 *
 * Production refuses to run on a dirty tree: `wrangler pages deploy` ships the
 * working directory, so a caption fix would carry whatever else is half-done.
 */
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { ROOT, readConfig, referenceConfigPath, loadConfigLock } = require("./lib/toon-config");

/** r2.dev rate-limits bursts, so verification walks the list a few at a time. */
const VERIFY_CONCURRENCY = 4;

function parseArgs(argv) {
  const opts = { toon: null, production: false, skipUpload: false, dryRun: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-h" || a === "--help") opts.help = true;
    else if (a === "--production" || a === "--prod") opts.production = true;
    else if (a === "--skip-upload") opts.skipUpload = true;
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

function printHelp() {
  console.log(`Usage: npm run ship-toon -- --toon <id> [options]

  --production   Deploy to twentyseven.pictures instead of staging
  --skip-upload  Assets are already on R2 (skips npm run upload-assets)
  --dry-run      Print the plan and the asset check; upload/publish/deploy nothing

Steps: upload assets → verify every referenced file resolves → publish config
       (updates src/toons/config-lock.json) → build + deploy.
`);
}

function run(cmd, args, { label }) {
  console.log(`\n→ ${label}`);
  const res = spawnSync(cmd, args, { cwd: ROOT, stdio: "inherit", env: process.env });
  if (res.status !== 0) {
    console.error(`\nerror: ${label} failed (exit ${res.status})`);
    process.exit(res.status || 1);
  }
}

function gitDirty() {
  const res = spawnSync("git", ["status", "--porcelain"], { cwd: ROOT, encoding: "utf8" });
  if (res.status !== 0) return null;
  return res.stdout
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

/** Every plate and clip a config references, as CDN paths under the toon dir. */
function referencedAssets(config) {
  const out = new Set();
  for (const page of config.pages || []) {
    if (page.file) out.add(page.file);
    for (const word of page.words || []) {
      if (word.audio) out.add(word.audio);
    }
  }
  return [...out];
}

async function headOk(url) {
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

async function verifyOnCdn(base, toon, assets) {
  const missing = [];
  for (let i = 0; i < assets.length; i += VERIFY_CONCURRENCY) {
    const batch = assets.slice(i, i + VERIFY_CONCURRENCY);
    const results = await Promise.all(batch.map((rel) => headOk(`${base}/toons/${toon}/${rel}`)));
    batch.forEach((rel, n) => {
      if (!results[n]) missing.push(rel);
    });
  }
  return missing;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help || !opts.toon) {
    printHelp();
    process.exit(opts.toon ? 0 : 1);
  }

  const base = (process.env.VITE_ASSET_BASE || "").replace(/\/+$/, "");
  if (!base) {
    console.error("error: VITE_ASSET_BASE not set — `set -a; source .env; set +a` first");
    process.exit(1);
  }

  const cfgPath = referenceConfigPath(opts.toon);
  if (!fs.existsSync(cfgPath)) {
    console.error(`error: no config at ${path.relative(ROOT, cfgPath)}`);
    process.exit(1);
  }
  const config = readConfig(opts.toon);
  const assets = referencedAssets(config);
  const target = opts.production ? "production (twentyseven.pictures)" : "staging (staging.twentyseven.pictures)";

  console.log(`toon:    ${opts.toon}`);
  console.log(`pages:   ${(config.pages || []).length}`);
  console.log(`assets:  ${assets.length} referenced`);
  console.log(`target:  ${target}`);

  if (opts.production) {
    const dirty = gitDirty();
    if (dirty && dirty.length) {
      console.error(`\nerror: working tree is dirty — production deploys ship dist/ built from it.`);
      for (const line of dirty.slice(0, 8)) console.error(`  ${line}`);
      if (dirty.length > 8) console.error(`  … and ${dirty.length - 8} more`);
      console.error("Commit (or stash) first, then re-run.");
      process.exit(1);
    }
  }

  if (!opts.skipUpload && !opts.dryRun) {
    run("npm", ["run", "upload-assets"], { label: "Upload local assets to R2" });
  }

  console.log(`\n→ Verify ${assets.length} referenced asset(s) on the CDN`);
  const missing = await verifyOnCdn(base, opts.toon, assets);
  if (missing.length) {
    console.error(`error: ${missing.length} referenced file(s) are not on R2:`);
    for (const rel of missing.slice(0, 10)) console.error(`  ${rel}`);
    console.error("Publishing now would put a broken page live. Upload them first.");
    process.exit(1);
  }
  console.log(`  all ${assets.length} resolve`);

  if (opts.dryRun) {
    const lock = loadConfigLock();
    console.log(`\n[dry-run] would publish config and deploy to ${target}`);
    console.log(`[dry-run] current lock: ${lock[opts.toon] || "(none)"}`);
    return;
  }

  run("npm", ["run", "publish-toon-config", "--", "--toon", opts.toon], {
    label: "Publish config to R2 + update lock",
  });
  run("make", [opts.production ? "deploy" : "preview-deploy"], { label: `Build + deploy → ${target}` });

  const lock = loadConfigLock();
  console.log(`\n✓ ${opts.toon} shipped to ${target}`);
  console.log(`  config: ${lock[opts.toon]}`);
  if (!opts.production) console.log("  production still serves the previous config until `--production`");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
