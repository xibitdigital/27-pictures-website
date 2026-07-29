/**
 * Resolve media URLs against optional CDN base (VITE_ASSET_BASE).
 *
 * Empty base → leave path as-is (same-origin from Pages / public/).
 * With base → root-absolute and relative paths become `${base}/…`.
 *
 * Relative paths require an explicit `pageDir` (e.g. `/toons/jax/`) when
 * the CDN is enabled — no window.location guessing.
 */

export function getAssetBase(): string {
  const raw = (import.meta.env.VITE_ASSET_BASE as string | undefined) ?? "";
  return String(raw).trim().replace(/\/+$/, "");
}

/** `/toons/jax` and `/toons/jax/index.html` → `/toons/jax/`. */
export function pageDirFromPathname(pathname: string): string {
  if (!pathname || pathname === "/") return "/";
  if (pathname.endsWith("/")) return pathname;
  const last = pathname.lastIndexOf("/");
  if (last <= 0) return "/";
  const leaf = pathname.slice(last + 1);
  if (leaf.includes(".")) return pathname.slice(0, last + 1);
  return pathname + "/";
}

function normalizeSitePath(p: string): string {
  if (!p) return "/";
  const withLead = p.startsWith("/") ? p : `/${p}`;
  return withLead.replace(/\/{2,}/g, "/");
}

/** Root-absolute site path (`/toons/jax/assets/x.jpg`). */
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
 * Relative paths need `pageDir` when VITE_ASSET_BASE is set.
 */
export function resolveAssetUrl(path: string, pageDir?: string): string {
  if (!path) return path;
  if (/^https?:\/\//i.test(path) || path.startsWith("data:") || path.startsWith("blob:")) {
    return path;
  }

  const base = getAssetBase();
  if (!base) return path;

  // Relative paths need pageDir to become CDN absolute; without it leave
  // relative (same-origin / tests). Readers always pass asset-page-dir.
  if (!path.startsWith("/") && (pageDir == null || pageDir === "")) {
    return path;
  }

  return base + toSitePath(path, pageDir);
}

export function resolvePageUrls(paths: string[], pageDir?: string): string[] {
  return paths.map((p) => resolveAssetUrl(String(p), pageDir));
}
