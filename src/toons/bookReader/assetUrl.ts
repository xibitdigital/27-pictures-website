/**
 * Resolve media URLs against VITE_ASSET_BASE (CDN).
 *
 * Production builds require VITE_ASSET_BASE (see vite/plugins/cdnMedia.ts).
 * Unit tests force an empty base via vitest config so paths stay relative.
 *
 * Relative paths need an explicit `pageDir` (e.g. `/toons/jax/`) when the CDN
 * base is set — readers pass this via `asset-page-dir`.
 */

export function getAssetBase(): string {
  const raw = (import.meta.env.VITE_ASSET_BASE as string | undefined) ?? "";
  return String(raw).trim().replace(/\/+$/, "");
}

function normalizeSitePath(p: string): string {
  if (!p) return "/";
  const withLead = p.startsWith("/") ? p : `/${p}`;
  return withLead.replace(/\/{2,}/g, "/");
}

/**
 * Root-absolute site path (`/toons/jax/assets/x.jpg`).
 * Relative paths require `pageDir`.
 */
export function toSitePath(path: string, pageDir?: string): string {
  if (!path) return path;
  if (path.startsWith("/")) return normalizeSitePath(path);
  if (pageDir == null || pageDir === "") {
    throw new Error(`toSitePath: pageDir required for relative path "${path}"`);
  }
  const dir = pageDir.replace(/\/?$/, "/");
  return normalizeSitePath(dir + path.replace(/^\.\//, ""));
}

/**
 * Resolve a media URL for img/audio src.
 * - Absolute http(s) / data: / blob: pass through
 * - Empty CDN base: return path unchanged
 * - With CDN base: prefix root-absolute or pageDir-relative paths
 */
export function resolveAssetUrl(path: string, pageDir?: string): string {
  if (!path) return path;
  if (/^https?:\/\//i.test(path) || path.startsWith("data:") || path.startsWith("blob:")) {
    return path;
  }

  const base = getAssetBase();
  if (!base) return path;

  if (!path.startsWith("/") && (pageDir == null || pageDir === "")) {
    throw new Error(`resolveAssetUrl: pageDir required for relative path "${path}" when VITE_ASSET_BASE is set`);
  }

  return base + toSitePath(path, pageDir);
}

export function resolvePageUrls(paths: string[], pageDir?: string): string[] {
  return paths.map((p) => resolveAssetUrl(String(p), pageDir));
}
