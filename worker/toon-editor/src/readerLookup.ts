/** Path matching for unlisted (staging) readers. Drafts never match. */
import type { ToonStatus } from "./types";

/** Config JSON and a known reader URL: Public and Staging. Never Draft. */
export const READER_STATUSES: ToonStatus[] = ["published", "staging"];

export function readerStatuses(): ToonStatus[] {
  return READER_STATUSES;
}

export function normalizeReaderPath(pathname: string): string {
  let p = (pathname || "/").split("?")[0].toLowerCase();
  p = p.replace(/^\/(de|it|fr)(?=\/)/, "");
  if (!p.startsWith("/")) p = `/${p}`;
  if (!p.endsWith("/")) p += "/";
  return p;
}

export function isReaderLookupPath(pathname: string): boolean {
  const p = normalizeReaderPath(pathname);
  if (!p.startsWith("/toons/")) return false;
  if (p === "/toons/" || p.startsWith("/toons/editor") || p.startsWith("/toons/_")) return false;
  const rest = p.slice("/toons/".length).replace(/\/$/, "");
  return rest.includes("/");
}

export function toonMatchesReaderPath(row: { reader_url?: string | null; slug: string }, pathname: string): boolean {
  const want = normalizeReaderPath(pathname);
  const listed = row.reader_url ? normalizeReaderPath(row.reader_url) : "";
  const fallback = normalizeReaderPath(`/toons/${row.slug}/`);
  return listed === want || fallback === want;
}
