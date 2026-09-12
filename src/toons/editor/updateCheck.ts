import { ref } from "vue";

/**
 * Polls `dist/toons/editor/version.json` (written by vite/plugins/editorVersion.ts) against this
 * tab's own baked-in build stamp (VITE_EDITOR_BUILD, vite.config.ts) so a long-open editor tab
 * notices a newer deploy instead of silently running stale JS until someone hard-refreshes.
 * Module-level state — every `useUpdateCheck()` caller shares one poll loop and one dismissal,
 * since EditorApp.vue only ever mounts one UpdateAvailableDialog for the whole app.
 */

const POLL_MS = 5 * 60 * 1000; // 5 minutes — a deploy landing mid-session is not urgent to the second
const VERSION_URL = "/toons/editor/version.json";

const currentBuild = (import.meta.env.VITE_EDITOR_BUILD || "").trim();
const available = ref(false);
let lastLatest = "";
let dismissedBuild = "";
let started = false;

async function checkOnce(): Promise<void> {
  if (!currentBuild) return; // no build stamp (e.g. local dev without a build) — nothing to compare
  try {
    const res = await fetch(`${VERSION_URL}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return;
    const body = (await res.json()) as { build?: unknown };
    const latest = typeof body.build === "string" ? body.build.trim() : "";
    if (!latest) return;
    lastLatest = latest;
    if (latest !== currentBuild && latest !== dismissedBuild) available.value = true;
  } catch {
    /* offline, or the editor isn't deployed at this origin (local dev) — try again next tick */
  }
}

export function useUpdateCheck(): { available: typeof available; dismiss: () => void; reload: () => void } {
  if (!started) {
    started = true;
    void checkOnce();
    window.setInterval(() => void checkOnce(), POLL_MS);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") void checkOnce();
    });
  }
  function dismiss(): void {
    dismissedBuild = lastLatest;
    available.value = false;
  }
  function reload(): void {
    window.location.reload();
  }
  return { available, dismiss, reload };
}
