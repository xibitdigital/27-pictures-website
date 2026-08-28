#!/usr/bin/env node
/**
 * Dump the toon-editor D1 to d1-backup/ (gitignored).
 *
 * Staging and production share the remote database. Local Miniflare is separate.
 *
 *   npm run backup-db              # remote (staging + prod)
 *   npm run backup-db -- --local   # wrangler dev copy
 *   npm run backup-db -- --out=/tmp/toon-editor.sql
 */
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const WORKER = path.join(ROOT, "worker/toon-editor");
const DEFAULT_DIR = path.join(ROOT, "d1-backup");

function arg(name) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : "";
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function main() {
  const local = process.argv.includes("--local");
  const remote = !local;
  const outArg = arg("out");
  const dest = outArg
    ? path.resolve(outArg)
    : path.join(DEFAULT_DIR, `toon-editor.${remote ? "remote" : "local"}.${stamp()}.sql`);

  fs.mkdirSync(path.dirname(dest), { recursive: true });

  const wranglerArgs = [
    "wrangler",
    "d1",
    "export",
    "toon-editor",
    "--config",
    path.join(WORKER, "wrangler.toml"),
    "--output",
    dest,
    "--skip-confirmation",
    remote ? "--remote" : "--local",
  ];
  const res = spawnSync("npx", wranglerArgs, {
    cwd: ROOT,
    stdio: "inherit",
    env: process.env,
  });
  if (res.status !== 0) {
    process.exit(res.status || 1);
  }
  const size = fs.existsSync(dest) ? fs.statSync(dest).size : 0;
  console.log(`wrote ${dest} (${size} bytes)`);
}

main();
