/**
 * Heart counts from the likes Worker (KV), shared by everything on /toons/
 * that shows them.
 *
 * The result is memoised per page load: the "most loved" rail and the vote
 * counts on the series cards want the same numbers, and asking the Worker
 * twice for every book would double the requests to show one figure twice.
 */

import { likesApiBase } from "../toons/bookReader/useToonLikes";

let inflight: Promise<Map<string, number>> | null = null;

async function load(ids: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const base = likesApiBase();
  if (!base) return out;
  await Promise.all(
    ids.map(async (id) => {
      try {
        // The Worker serves /likes; VITE_LIKES_API is only its origin. Asking
        // the origin directly returns {"error":"not found"}, which is how the
        // "most loved" row quietly showed nothing at all.
        const res = await fetch(`${base}/likes?toon=${encodeURIComponent(id)}`, {
          headers: { Accept: "application/json" },
        });
        if (!res.ok) return;
        const data = (await res.json()) as { likes?: number };
        if (typeof data.likes === "number" && data.likes > 0) out.set(id, data.likes);
      } catch {
        /* a book whose count cannot load simply has no count */
      }
    })
  );
  return out;
}

/** Heart count per toon id. Missing ids mean zero, never an error. */
export function fetchLikes(ids: string[]): Promise<Map<string, number>> {
  inflight ??= load(ids);
  return inflight;
}

/** Test seam — the memo would otherwise leak between cases. */
export function resetLikesCache(): void {
  inflight = null;
}
