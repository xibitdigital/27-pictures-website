import { onMounted, ref } from "vue";

/**
 * Like counter for a toon.
 *
 * Two sources of truth, on purpose:
 * - **the reader's own vote** lives in localStorage, so the heart stays filled
 *   across reloads even when the network is gone or the API is not configured;
 * - **the total** lives in the Worker (KV), fetched on mount and refreshed by
 *   the POST response.
 *
 * With no `VITE_LIKES_API` the composable degrades to local-only: the heart
 * still toggles and remembers, `total` simply stays null and the stats readout
 * has nothing to show.
 */

export const LIKE_STORAGE_PREFIX = "toon-like:";

export interface ToonLikesApi {
  liked: ReturnType<typeof ref<boolean>>;
  total: ReturnType<typeof ref<number | null>>;
  pending: ReturnType<typeof ref<boolean>>;
  toggle: () => Promise<void>;
  refresh: () => Promise<void>;
}

function storageKey(toonId: string) {
  return `${LIKE_STORAGE_PREFIX}${toonId}`;
}

/** Reads the remembered vote; storage can throw in private mode / embedded webviews. */
export function readStoredLike(toonId: string): boolean {
  try {
    return window.localStorage.getItem(storageKey(toonId)) === "1";
  } catch {
    return false;
  }
}

export function writeStoredLike(toonId: string, liked: boolean): void {
  try {
    if (liked) window.localStorage.setItem(storageKey(toonId), "1");
    else window.localStorage.removeItem(storageKey(toonId));
  } catch {
    /* storage unavailable — the in-memory ref still drives this session */
  }
}

/** Base URL of the likes Worker, or null when unset (local-only mode). */
export function likesApiBase(): string | null {
  const raw = import.meta.env?.VITE_LIKES_API;
  const base = typeof raw === "string" ? raw.trim().replace(/\/+$/, "") : "";
  return base || null;
}

function parseTotal(body: unknown): number | null {
  if (!body || typeof body !== "object") return null;
  const n = (body as { likes?: unknown }).likes;
  return typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : null;
}

export function useToonLikes(toonId: string): ToonLikesApi {
  const liked = ref(false);
  const total = ref<number | null>(null);
  const pending = ref(false);

  async function refresh(): Promise<void> {
    const base = likesApiBase();
    if (!base || !toonId) return;
    try {
      const res = await fetch(`${base}/likes?toon=${encodeURIComponent(toonId)}`, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return;
      total.value = parseTotal(await res.json());
    } catch {
      /* counter is decorative — never break the reader over it */
    }
  }

  async function toggle(): Promise<void> {
    // Deliberately not gated on `pending`: the vote is local state and the POST
    // is fire-and-forget, so a request still in flight must never stop someone
    // taking their like back. Blocking here made an un-like impossible whenever
    // the POST was slow or the origin was not on the Worker's CORS list — the
    // request hangs, the button keeps pointer-events:none, and the heart looks
    // stuck on.
    const next = !liked.value;

    // Optimistic: the vote is the reader's own state, not the server's.
    liked.value = next;
    writeStoredLike(toonId, next);
    if (total.value != null) total.value = Math.max(0, total.value + (next ? 1 : -1));

    const base = likesApiBase();
    // Only likes are counted server-side. Un-liking is local: without identity
    // there is no honest way to take a vote back, and allowing decrements is a
    // free way for anyone to zero the counter.
    if (!base || !next || !toonId) return;

    pending.value = true;
    try {
      const res = await fetch(`${base}/likes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toon: toonId }),
        // A counter must never hang the control that draws it.
        signal: AbortSignal.timeout(8000),
      });
      // Only trust the server total if the reader still has the like: they may
      // have taken it back while the POST was in flight, and overwriting their
      // state with a count that includes the vote would put the heart back on.
      if (res.ok && liked.value) {
        const server = parseTotal(await res.json());
        if (server != null) total.value = server;
      }
    } catch {
      /* keep the optimistic local state */
    } finally {
      pending.value = false;
    }
  }

  onMounted(() => {
    liked.value = readStoredLike(toonId);
    void refresh();
  });

  return { liked, total, pending, toggle, refresh };
}

/** `?stats=true` reveals the running total next to the heart. */
export function statsEnabled(search?: string): boolean {
  const raw = search ?? (typeof window === "undefined" ? "" : window.location.search);
  const value = new URLSearchParams(raw).get("stats");
  return value === "true" || value === "1";
}
