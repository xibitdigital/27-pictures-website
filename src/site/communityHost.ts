/**
 * Hostnames for the creator-site catalog (`publish_site = community`).
 * Studio stays on twentyseven.pictures; this host is a second public surface.
 */
export const COMMUNITY_HOST = "toons.twentyseven.pictures";

/** Staging Pages project — same catalog as production toons, plus Staging visibility. */
export const COMMUNITY_STAGING_HOST = "staging.toons.twentyseven.pictures";

/** Local Vite (`allowedHosts`) so `http://toons.localhost:5173` hits the same SSR. */
export const COMMUNITY_DEV_HOST = "toons.localhost";

export function isCommunityHost(host: string): boolean {
  const h = String(host || "")
    .split(":")[0]
    .toLowerCase();
  return h === COMMUNITY_HOST || h === COMMUNITY_STAGING_HOST || h === COMMUNITY_DEV_HOST;
}

export function isCommunityOrigin(origin: string): boolean {
  try {
    return isCommunityHost(new URL(origin).hostname);
  } catch {
    return false;
  }
}

/** Paths that must never be treated as a creator username on the community host. */
export const COMMUNITY_RESERVED_SEGMENTS = new Set([
  "toons",
  "watch",
  "cosplay",
  "horror-shorts",
  "editor",
  "community",
  "de",
  "it",
  "fr",
  "assets",
  "site",
  "embed",
  "card-art",
  "privacy",
  "qr",
]);
