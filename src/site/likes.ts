/**
 * Heart counts from the editor Worker (D1), shared by everything on /toons/
 * that shows them.
 *
 * The result is memoised per page load: series cards and episode cards
 * want the same numbers, and asking the Worker twice for every book would
 * double the requests to show one figure twice.
 */

import { likesApiBase } from "../toons/bookReader/useToonLikes";

let inflight: Promise<Map<string, number>> | null = null;

async function load(ids: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const base = likesApiBase();
  if (!base) return out;
  try {
    const res = await fetch(`${base}/likes`, { headers: { Accept: "application/json" } });
    if (res.ok) {
      const data = (await res.json()) as { likes?: Record<string, unknown>; toon?: string };
      if (data.likes && typeof data.likes === "object" && !Array.isArray(data.likes) && data.toon == null) {
        for (const id of ids) {
          const n = data.likes[id];
          if (typeof n === "number" && n > 0) out.set(id, n);
        }
        return out;
      }
    }
  } catch {
    /* fall through to one-request-per-book (legacy likes Worker) */
  }

  await Promise.all(
    ids.map(async (id) => {
      try {
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
