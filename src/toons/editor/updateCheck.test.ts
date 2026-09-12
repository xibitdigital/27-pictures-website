import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `useUpdateCheck` keeps module-level state (one poll loop, one dismissal, for the whole app) —
 * each test re-imports a fresh module instance via `vi.resetModules()` so they don't leak into
 * each other, and stubs `import.meta.env.VITE_EDITOR_BUILD` before importing since the module
 * reads it once at load time.
 */
async function importFresh(currentBuild: string) {
  vi.resetModules();
  vi.stubEnv("VITE_EDITOR_BUILD", currentBuild);
  return import("./updateCheck");
}

describe("useUpdateCheck", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("does nothing when the fetched build matches the current one", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ build: "26.01.01.00.00" }), { status: 200 }))
    );
    const { useUpdateCheck } = await importFresh("26.01.01.00.00");
    const { available } = useUpdateCheck();
    await vi.waitFor(() => expect(available.value).toBe(false));
  });

  it("flags an update once the fetched build differs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ build: "26.02.02.00.00" }), { status: 200 }))
    );
    const { useUpdateCheck } = await importFresh("26.01.01.00.00");
    const { available } = useUpdateCheck();
    await vi.waitFor(() => expect(available.value).toBe(true));
  });

  it("stops re-flagging the same build after it's dismissed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ build: "26.02.02.00.00" }), { status: 200 }))
    );
    const { useUpdateCheck } = await importFresh("26.01.01.00.00");
    const { available, dismiss } = useUpdateCheck();
    await vi.waitFor(() => expect(available.value).toBe(true));
    dismiss();
    expect(available.value).toBe(false);
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 1000);
    expect(available.value).toBe(false);
  });

  it("silently no-ops on a fetch failure (offline, or not deployed at this origin)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const { useUpdateCheck } = await importFresh("26.01.01.00.00");
    const { available } = useUpdateCheck();
    await vi.waitFor(() => expect(available.value).toBe(false));
  });
});
