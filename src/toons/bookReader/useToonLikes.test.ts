import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { defineComponent, h, nextTick } from "vue";
import { LIKE_STORAGE_PREFIX, readStoredLike, statsEnabled, useToonLikes, writeStoredLike } from "./useToonLikes";

/** Mount a throwaway component so onMounted hooks in the composable run. */
function useIn(toonId: string) {
  let api!: ReturnType<typeof useToonLikes>;
  const wrapper = mount(
    defineComponent({
      setup() {
        api = useToonLikes(toonId);
        return () => h("div");
      },
    })
  );
  return { api, wrapper };
}

describe("useToonLikes", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("remembers the reader's own vote in localStorage", () => {
    writeStoredLike("jax", true);
    expect(window.localStorage.getItem(`${LIKE_STORAGE_PREFIX}jax`)).toBe("1");
    expect(readStoredLike("jax")).toBe(true);

    writeStoredLike("jax", false);
    expect(readStoredLike("jax")).toBe(false);
  });

  it("restores a stored vote on mount", async () => {
    writeStoredLike("nero", true);
    const { api } = useIn("nero");
    await nextTick();
    expect(api.liked.value).toBe(true);
  });

  it("records and persists a vote without an API configured", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { api } = useIn("erin");
    await nextTick();

    await api.like();
    expect(api.liked.value).toBe(true);
    expect(readStoredLike("erin")).toBe(true);
    // No VITE_LIKES_API → local-only, never touches the network.
    expect(fetchSpy).not.toHaveBeenCalled();

    // A vote is final on this device: pressing again cannot take it back.
    await api.like();
    expect(api.liked.value).toBe(true);
    expect(readStoredLike("erin")).toBe(true);
  });

  it("posts a like and adopts the server total", async () => {
    vi.stubEnv("VITE_LIKES_API", "https://likes.example.dev/");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(((
      input: RequestInfo | URL,
      init?: RequestInit
    ) => {
      const url = String(input);
      const likes = init?.method === "POST" ? 42 : 41;
      return Promise.resolve(
        new Response(JSON.stringify({ toon: "jax", likes }), { status: 200 })
      ) as Promise<Response>;
    }) as typeof fetch);

    const { api } = useIn("jax");
    await nextTick();
    await api.refresh();
    expect(api.total.value).toBe(41);

    await api.like();
    expect(api.liked.value).toBe(true);
    expect(api.total.value).toBe(42);

    const posted = fetchSpy.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === "POST");
    expect(posted?.[0]).toBe("https://likes.example.dev/likes");
    expect(JSON.parse(String((posted?.[1] as RequestInit).body))).toEqual({ toon: "jax" });
  });

  // The button is disabled once voted, so this covers the keyboard and
  // programmatic paths: a second call must not double-count.
  it("never POSTs twice for a vote already cast", async () => {
    vi.stubEnv("VITE_LIKES_API", "https://likes.example.dev");
    writeStoredLike("nero", true);
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ toon: "nero", likes: 7 }), { status: 200 }));

    const { api } = useIn("nero");
    await nextTick();
    fetchSpy.mockClear();

    await api.like();
    expect(api.liked.value).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("survives a failing counter API", async () => {
    vi.stubEnv("VITE_LIKES_API", "https://likes.example.dev");
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));

    const { api } = useIn("jax");
    await nextTick();
    await api.refresh();
    await api.like();

    expect(api.total.value).toBeNull();
    expect(api.liked.value).toBe(true);
    expect(readStoredLike("jax")).toBe(true);
  });
});

describe("statsEnabled", () => {
  it("reads ?stats=true / ?stats=1", () => {
    expect(statsEnabled("?stats=true")).toBe(true);
    expect(statsEnabled("?stats=1")).toBe(true);
  });

  it("stays off otherwise", () => {
    expect(statsEnabled("")).toBe(false);
    expect(statsEnabled("?stats=false")).toBe(false);
    expect(statsEnabled("?page=3")).toBe(false);
  });
});
