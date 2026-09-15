/** Catalog / public reader visibility, keyed off the calling site hostname. */

import { parsePublishSite, type PublishSite } from "./apiTypes";
import type { RequestLike, ToonStatus } from "./types";

export { parsePublishSite };

/** Hosts that serve the creator-site catalog. Anything else is studio. */
export const COMMUNITY_HOST = "toons.twentyseven.pictures";
export const COMMUNITY_STAGING_HOST = "staging.toons.twentyseven.pictures";
export const COMMUNITY_DEV_HOST = "toons.localhost";

/**
 * Effective catalog destination for a toon row. A grouped episode follows
 * its series; `toons.publish_site` is only used when `series_key` is empty.
 */
export function effectivePublishSite(row: {
  series_key?: string | null;
  publish_site?: string | null;
  series_publish_site?: string | null;
}): PublishSite {
  if (row.series_key) return parsePublishSite(row.series_publish_site ?? row.publish_site);
  return parsePublishSite(row.publish_site);
}

/** SQL: catalog site for a `toons` row `LEFT JOIN series`. */
export const CATALOG_PUBLISH_SITE_SQL = `CASE
  WHEN toons.series_key IS NOT NULL AND toons.series_key != ''
    THEN COALESCE(NULLIF(series.publish_site, ''), 'studio')
  ELSE COALESCE(NULLIF(toons.publish_site, ''), 'studio')
END`;

export function parseStatus(raw: unknown, fallback: ToonStatus): ToonStatus {
  if (raw == null || raw === "") return fallback;
  const s = String(raw).trim().toLowerCase();
  if (s === "published" || s === "public") return "published";
  if (s === "staging") return "staging";
  if (s === "draft") return "draft";
  return fallback;
}

export function hostnameOf(value: unknown): string {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) return new URL(raw).hostname.toLowerCase();
  } catch {
    return "";
  }
  return raw.split("/")[0].split(":")[0].toLowerCase();
}

export function isStagingHostname(host: string): boolean {
  const h = String(host || "").toLowerCase();
  if (h === "localhost" || h === "127.0.0.1") return true;
  if (h === "staging.twentyseven.pictures") return true;
  if (h === COMMUNITY_STAGING_HOST) return true;
  if (h === "local.twentyseven.test") return true;
  if (h.endsWith(".twentyseven-pictures-staging.pages.dev")) return true;
  return false;
}

/**
 * Prefer Origin (cannot be spoofed by a `site` query on a production page).
 * Fall back to `?site=` then Referer — staging Pages and local Vite send those.
 */
export function callerHostname(request: RequestLike): string {
  const originHost = hostnameOf(request.headers?.get("Origin") || "");
  if (originHost) return originHost;
  let site = "";
  try {
    site = new URL(request.url).searchParams.get("site") || "";
  } catch {
    site = "";
  }
  const siteHost = hostnameOf(site);
  if (siteHost) return siteHost;
  const refererHost = hostnameOf(request.headers?.get("Referer") || "");
  if (refererHost) return refererHost;
  return hostnameOf(request.url);
}

/** Draft never. Staging host → published + staging. Production / unknown → published only. */
export function publicStatuses(isStaging: boolean): ToonStatus[] {
  return isStaging ? ["published", "staging"] : ["published"];
}

export function publicStatusesForRequest(request: RequestLike): ToonStatus[] {
  return publicStatuses(isStagingHostname(callerHostname(request)));
}

export function isCommunityHostname(host: string): boolean {
  const h = String(host || "")
    .split(":")[0]
    .toLowerCase();
  return h === COMMUNITY_HOST || h === COMMUNITY_STAGING_HOST || h === COMMUNITY_DEV_HOST;
}

/** Studio catalog unless the caller is the creator-site host. */
export function publishSiteForRequest(request: RequestLike): PublishSite {
  return isCommunityHostname(callerHostname(request)) ? "community" : "studio";
}
