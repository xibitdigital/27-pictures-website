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
 * still fills and is remembered, `total` simply stays null and the stats
 * readout has nothing to show.
 *
 * **A vote is final on this device.** There is no un-like: only likes are
 * counted server-side, so taking one back could never be more than a local
 * fiction — the heart would empty while the total it had already contributed to
 * stayed put. One vote per reader per book, and the control retires once cast.
 */

export const LIKE_STORAGE_PREFIX = "toon-like:";

export interface ToonLikesApi {
  liked: ReturnType<typeof ref<boolean>>;
  total: ReturnType<typeof ref<number | null>>;
  pending: ReturnType<typeof ref<boolean>>;
  like: () => Promise<void>;
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

  async function like(): Promise<void> {
    // Already voted — nothing to do. The button is disabled once `liked` is
    // true, so this only catches a keyboard or programmatic second call, but a
    // double POST would inflate the counter for a reader who pressed twice.
    if (liked.value) return;

    // Optimistic: the vote is the reader's own state, not the server's.
    const priorTotal = total.value;
    liked.value = true;
    writeStoredLike(toonId, true);
    if (total.value != null) total.value += 1;

    const base = likesApiBase();
    if (!base || !toonId) return;

    /**
     * The vote never reached the counter, so nothing about it should look
     * final. The remembered flag is what makes a rejected POST permanent: the
     * heart stays filled, `like()` returns early ever after, and the reader is
     * left looking at a count that never moved. A toon missing from the
     * Worker's ALLOWED_TOONS did exactly that — 400 on every attempt, one vote
     * silently dropped per device.
     */
    const rollback = (): void => {
      liked.value = false;
      writeStoredLike(toonId, false);
      total.value = priorTotal;
    };

    pending.value = true;
    try {
      const res = await fetch(`${base}/likes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toon: toonId }),
        // A counter must never hang the control that draws it.
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        rollback();
        return;
      }
      const server = parseTotal(await res.json());
      // `counted: false` is a success: the Worker saw the vote and declined to
      // add it (one per IP per toon per day). The reader's own vote stands.
      if (server != null) total.value = server;
    } catch {
      // Offline, timeout, CORS — all indistinguishable from here, and all mean
      // the same thing: try again next visit rather than pretend it landed.
      rollback();
    } finally {
      pending.value = false;
    }
  }

  onMounted(() => {
    liked.value = readStoredLike(toonId);
    void refresh();
  });

  return { liked, total, pending, like, refresh };
}

/** `?stats=true` reveals the running total next to the heart. */
export function statsEnabled(search?: string): boolean {
  const raw = search ?? (typeof window === "undefined" ? "" : window.location.search);
  const value = new URLSearchParams(raw).get("stats");
  return value === "true" || value === "1";
}
