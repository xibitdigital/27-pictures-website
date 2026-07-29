/**
 * Resolve media URLs against an optional CDN / R2 base (VITE_ASSET_BASE).
 *
 * When unset (local dev + default production), paths are left as-is so the
 * browser loads them same-origin from Cloudflare Pages (`public/`).
 *
 * When set (e.g. https://assets.twentyseven.pictures), relative and
 * site-root paths become absolute URLs under that origin, mirroring the
 * `public/` key layout (toons/jax/assets/…, toons/erin/assets/…).
 */

/** Trim trailing slashes from the configured base. Empty string = same-origin. */
export function getAssetBase(): string {
  const raw = (import.meta.env.VITE_ASSET_BASE as string | undefined) ?? "";
  return String(raw).trim().replace(/\/+$/, "");
}

/**
 * Directory of the current document, always with a trailing slash.
 * `/toons/jax` and `/toons/jax/index.html` → `/toons/jax/`.
 */
export function pageDirFromPathname(pathname: string): string {
  if (!pathname || pathname === "/") return "/";
  if (pathname.endsWith("/")) return pathname;
  const last = pathname.lastIndexOf("/");
  if (last <= 0) return "/";
  // Drop a trailing file segment (index.html, etc.)
  const leaf = pathname.slice(last + 1);
  if (leaf.includes(".")) return pathname.slice(0, last + 1);
  return pathname + "/";
}

function currentPageDir(): string {
  if (typeof window === "undefined" || !window.location?.pathname) return "/";
  return pageDirFromPathname(window.location.pathname);
}

/** Collapse duplicate slashes in a path (keep leading single /). */
function normalizeSitePath(path: string): string {
  if (!path) return "/";
  const withLead = path.startsWith("/") ? path : `/${path}`;
  return withLead.replace(/\/{2,}/g, "/");
}

/**
 * Turn a relative or site-root path into a full site path (`/toons/jax/assets/x.jpg`).
 */
export function toSitePath(path: string, pageDir?: string): string {
  if (!path) return path;
  if (path.startsWith("/")) return normalizeSitePath(path);
  const dir = (pageDir ?? currentPageDir()).replace(/\/?$/, "/");
  return normalizeSitePath(dir + path.replace(/^\.\//, ""));
}

/**
 * Resolve a media URL for img/audio src.
 *
 * - Absolute http(s) / data: / blob: URLs pass through unchanged.
 * - With no VITE_ASSET_BASE: returns `path` unchanged (relative stays relative).
 * - With VITE_ASSET_BASE: returns `${base}${sitePath}` where sitePath is
 *   root-absolute (relative paths resolve against `pageDir` or the current URL).
 */
export function resolveAssetUrl(path: string, pageDir?: string): string {
  if (!path) return path;
  if (/^https?:\/\//i.test(path) || path.startsWith("data:") || path.startsWith("blob:")) {
    return path;
  }

  const base = getAssetBase();
  if (!base) return path;

  return base + toSitePath(path, pageDir);
}

/** Map every page URL from a manifest through resolveAssetUrl. */
export function resolvePageUrls(paths: string[], pageDir?: string): string[] {
  return paths.map((p) => resolveAssetUrl(String(p), pageDir));
}
