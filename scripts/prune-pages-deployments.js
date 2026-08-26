#!/usr/bin/env node
/**
 * Delete superseded Cloudflare Pages deployments for a project.
 * Keeps the newest snapshot (and any that still have a branch alias).
 *
 *   node scripts/prune-pages-deployments.js --project twentyseven-pictures-staging
 *   node scripts/prune-pages-deployments.js --project twentyseven-pictures --dry-run
 */
const { selectPruneTargets, listAllDeployments, deleteDeployment } = require("./lib/pages-deployments");

function parseArgs(argv) {
  const opts = { project: null, keep: 1, dryRun: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-h" || a === "--help") opts.help = true;
    else if (a === "--dry-run") opts.dryRun = true;
    else if (a === "--project") opts.project = argv[++i];
    else if (a.startsWith("--project=")) opts.project = a.slice("--project=".length);
    else if (a === "--keep") opts.keep = Number(argv[++i]);
    else if (a.startsWith("--keep=")) opts.keep = Number(a.slice("--keep=".length));
    else {
      console.error(`Unknown option: ${a}`);
      opts.help = true;
    }
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help || !opts.project) {
    console.log(`Usage: node scripts/prune-pages-deployments.js --project <name> [--keep 1] [--dry-run]`);
    process.exit(opts.project ? 0 : 1);
  }

  const token = process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!token || !accountId) {
    console.error("error: CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are required");
    process.exit(1);
  }

  const deployments = await listAllDeployments({
    token,
    accountId,
    project: opts.project,
  });
  const doomed = selectPruneTargets(deployments, { keep: opts.keep });
  console.log(`${opts.project}: ${deployments.length} deployment(s), ${doomed.length} unused`);

  if (opts.dryRun) {
    for (const d of doomed) {
      console.log(`[dry-run] delete ${d.short_id || d.id} ${d.url || ""}`);
    }
    return;
  }

  let failed = 0;
  for (const d of doomed) {
    const label = `${d.short_id || d.id} ${d.url || ""}`.trim();
    try {
      await deleteDeployment({ token, accountId, project: opts.project, id: d.id });
      console.log(`deleted ${label}`);
    } catch (err) {
      failed += 1;
      console.error(`FAIL ${label}: ${err.message || err}`);
    }
  }
  if (failed) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
