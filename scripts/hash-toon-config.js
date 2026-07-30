#!/usr/bin/env node
/**
 * Deprecated alias for publish-toon-config --lock-only.
 * Prefer: npm run publish-toon-config
 */
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const args = ["scripts/publish-toon-config.js", "--lock-only", ...process.argv.slice(2)];
const res = spawnSync(process.execPath, args, {
  cwd: path.resolve(__dirname, ".."),
  stdio: "inherit",
  env: process.env,
});
process.exit(res.status || 0);
