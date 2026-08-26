/**
 * Pick Cloudflare Pages deployments that are safe to delete: anything that
 * is not the live alias and not the newest snapshot (the one we just shipped).
 *
 * The unique `<hash>.<project>.pages.dev` URL is the deployment itself —
 * deleting the current one takes the custom domain down with it.
 */
function selectPruneTargets(deployments, { keep = 1 } = {}) {
  const keepCount = Number.isInteger(keep) && keep > 0 ? keep : 1;
  const list = Array.isArray(deployments) ? deployments : [];
  const live = list
    .filter((d) => d && d.id && !d.is_skipped)
    .sort((a, b) => Date.parse(b.created_on || 0) - Date.parse(a.created_on || 0));
  const keepIds = new Set(live.slice(0, keepCount).map((d) => d.id));
  for (const d of list) {
    if (d && d.id && Array.isArray(d.aliases) && d.aliases.length) keepIds.add(d.id);
  }
  return list.filter((d) => d && d.id && !keepIds.has(d.id));
}

async function cfJson(url, { token, method = "GET" }) {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}` },
  });
  let data;
  try {
    data = await res.json();
  } catch {
    data = { success: false, errors: [{ message: await res.text() }] };
  }
  if (!res.ok || data.success === false) {
    const msg =
      (data.errors || [])
        .map((e) => e.message)
        .filter(Boolean)
        .join("; ") || res.statusText;
    throw new Error(`Cloudflare Pages API ${method} ${res.status}: ${msg}`);
  }
  return data;
}

async function listAllDeployments({ token, accountId, project }) {
  const all = [];
  let page = 1;
  for (;;) {
    const url =
      `https://api.cloudflare.com/client/v4/accounts/${accountId}` +
      `/pages/projects/${encodeURIComponent(project)}/deployments?page=${page}&per_page=25`;
    const data = await cfJson(url, { token });
    const batch = Array.isArray(data.result) ? data.result : [];
    all.push(...batch);
    const info = data.result_info || {};
    const totalPages = info.total_pages || (batch.length < 25 ? page : page + 1);
    if (page >= totalPages || batch.length === 0) break;
    page += 1;
  }
  return all;
}

async function deleteDeployment({ token, accountId, project, id }) {
  const url =
    `https://api.cloudflare.com/client/v4/accounts/${accountId}` +
    `/pages/projects/${encodeURIComponent(project)}/deployments/${encodeURIComponent(id)}`;
  await cfJson(url, { token, method: "DELETE" });
}

module.exports = {
  selectPruneTargets,
  listAllDeployments,
  deleteDeployment,
};
