/**
 * Role/ownership gates layered on top of the existing JWT-only auth gate.
 * Admin bypasses every check here unconditionally.
 */

import type { EditorUser, ToonStatus } from "./types";

export function isAdmin(session: EditorUser | null): boolean {
  return session?.role === "admin";
}

export function canManageSeries(session: EditorUser | null, series: { owner_id?: string | null }): boolean {
  if (isAdmin(session)) return true;
  return Boolean(session && series.owner_id && series.owner_id === session.id);
}

/**
 * A grouped toon's permission follows its series' owner, not the toon's own
 * `owner_id` — "own series only" means every episode under a series an
 * editor created, not a per-episode ownership flag.
 */
export function canManageToon(
  session: EditorUser | null,
  toon: { owner_id?: string | null; series_key?: string | null },
  seriesOwnerId: string | null
): boolean {
  if (isAdmin(session)) return true;
  if (!session) return false;
  const ownerId = toon.series_key ? seriesOwnerId : toon.owner_id ?? null;
  return Boolean(ownerId && ownerId === session.id);
}

export function publishError(session: EditorUser | null, requestedStatus: ToonStatus): string | null {
  if (isAdmin(session)) return null;
  if (requestedStatus === "published") return "editors cannot publish";
  return null;
}
