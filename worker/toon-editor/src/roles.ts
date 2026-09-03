/**
 * Role/ownership gates layered on top of the existing JWT-only auth gate.
 * Admin bypasses every check here unconditionally.
 */

import type { EditorUser, ToonStatus } from "./types";

export function isAdmin(session: EditorUser | null): boolean {
  return session?.role === "admin";
}

export function canManageSeries(session: EditorUser | null, isMember: boolean): boolean {
  if (isAdmin(session)) return true;
  return Boolean(session) && isMember;
}

/**
 * A grouped toon's permission follows its series' assigned-editors list, not
 * the toon's own `owner_id` — an editor manages every episode under a series
 * they're assigned to, not a per-episode ownership flag. Ungrouped toons
 * still use their own `owner_id` (the creator) — unchanged single-owner model.
 */
export function canManageToon(
  session: EditorUser | null,
  toon: { owner_id?: string | null; series_key?: string | null },
  isSeriesMember: boolean
): boolean {
  if (isAdmin(session)) return true;
  if (!session) return false;
  if (toon.series_key) return isSeriesMember;
  return Boolean(toon.owner_id && toon.owner_id === session.id);
}

export function publishError(session: EditorUser | null, requestedStatus: ToonStatus): string | null {
  if (isAdmin(session)) return null;
  if (requestedStatus === "published") return "editors cannot publish";
  return null;
}
