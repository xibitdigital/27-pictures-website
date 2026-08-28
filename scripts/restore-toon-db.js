#!/usr/bin/env node
/**
 * Load a toon-editor D1 SQL dump into the local Miniflare database
 * (`wrangler d1 execute --local`). Staging/prod stay untouched.
 *
 *   npm run restore-db                 # newest d1-backup/toon-editor.remote.*.sql
 *   npm run restore-db -- --dump       # export remote first, then restore
 *   npm run restore-db -- --file=path.sql
 */
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const WORKER = path.join(ROOT, "worker/toon-editor");
const BACKUP_DIR = path.join(ROOT, "d1-backup");
const CONFIG = path.join(WORKER, "wrangler.toml");

const WIPE = `PRAGMA defer_foreign_keys=TRUE;
DROP TABLE IF EXISTS toon_like_votes;
DROP TABLE IF EXISTS toon_likes;
DROP TABLE IF EXISTS bubbles;
DROP TABLE IF EXISTS pages;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS series;
DROP TABLE IF EXISTS toons;
DROP TABLE IF EXISTS d1_migrations;
`;

function arg(name) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : "";
}

function wrangler(args, cwd = WORKER) {
  const res = spawnSync("npx", ["wrangler", ...args], {
    cwd,
    stdio: "inherit",
    env: process.env,
  });
  if (res.status !== 0) process.exit(res.status || 1);
}

function latestRemoteDump() {
  if (!fs.existsSync(BACKUP_DIR)) return "";
  const files = fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith("toon-editor.remote.") && f.endsWith(".sql"))
    .map((f) => path.join(BACKUP_DIR, f))
    .sort();
  return files.at(-1) || "";
}

function dumpRemote() {
  const dest = path.join(BACKUP_DIR, `toon-editor.remote.${new Date().toISOString().replace(/[:.]/g, "-")}.sql`);
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  wrangler(
    ["d1", "export", "toon-editor", "--config", CONFIG, "--output", dest, "--skip-confirmation", "--remote"],
    ROOT
  );
  return dest;
}

function main() {
  let file = arg("file");
  if (process.argv.includes("--dump")) file = dumpRemote();
  if (!file) file = latestRemoteDump();
  if (!file) {
    console.error("No dump found. Run `npm run backup-db` or `npm run restore-db -- --dump`.");
    process.exit(1);
  }
  file = path.resolve(file);
  if (!fs.existsSync(file)) {
    console.error(`missing dump: ${file}`);
    process.exit(1);
  }

  console.log(`wiping local D1, then loading ${file}`);
  wrangler(["d1", "execute", "toon-editor", "--local", "--yes", "--command", WIPE]);
  wrangler(["d1", "execute", "toon-editor", "--local", "--yes", "--file", file]);

  const count = execFileSync(
    "npx",
    [
      "wrangler",
      "d1",
      "execute",
      "toon-editor",
      "--local",
      "--yes",
      "--json",
      "--command",
      "SELECT COUNT(*) AS toons FROM toons; SELECT COUNT(*) AS pages FROM pages; SELECT COUNT(*) AS bubbles FROM bubbles;",
    ],
    { cwd: WORKER, encoding: "utf8", env: process.env }
  );
  console.log(count.trim());
}

main();
