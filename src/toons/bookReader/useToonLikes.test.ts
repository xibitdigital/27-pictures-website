import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { defineComponent, h, nextTick } from "vue";
import {
  LIKE_STORAGE_PREFIX,
  likesApiBase,
  readStoredLike,
  statsEnabled,
  useToonLikes,
  writeStoredLike,
} from "./useToonLikes";

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

  it("falls back to the editor API when VITE_LIKES_API is empty", () => {
    vi.stubEnv("VITE_LIKES_API", "");
    vi.stubEnv("VITE_EDITOR_API", "https://editor.example.dev");
    expect(likesApiBase()).toBe("https://editor.example.dev");
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

  it("does not remember a vote the counter never took", async () => {
    // Was the opposite assertion. A remembered-but-uncounted vote is the worst
    // of both: the heart is filled, `like()` returns early ever after, and the
    // count never moves — which is exactly what a toon missing from the
    // Worker's allow-list produced, one lost vote per device.
    vi.stubEnv("VITE_LIKES_API", "https://likes.example.dev");
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));

    const { api } = useIn("jax");
    await nextTick();
    await api.refresh();
    await api.like();

    expect(api.total.value).toBeNull();
    expect(api.liked.value).toBe(false);
    expect(readStoredLike("jax")).toBe(false);
  });

  it("rolls the count back when the Worker rejects the toon", async () => {
    vi.stubEnv("VITE_LIKES_API", "https://likes.example.dev");
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      if ((init as RequestInit | undefined)?.method === "POST") {
        return new Response(JSON.stringify({ error: "unknown toon" }), { status: 400 });
      }
      return new Response(JSON.stringify({ likes: 4 }), { status: 200 });
    });

    const { api } = useIn("redsmile-marcus");
    await nextTick();
    await api.refresh();
    expect(api.total.value).toBe(4);

    await api.like();
    // Back to the server's figure, not 5 — the vote was refused.
    expect(api.total.value).toBe(4);
    expect(api.liked.value).toBe(false);
    expect(readStoredLike("redsmile-marcus")).toBe(false);
  });

  it("keeps the vote when the Worker saw it but did not add it", async () => {
    // `counted: false` is the per-IP-per-day guard, not a failure.
    vi.stubEnv("VITE_LIKES_API", "https://likes.example.dev");
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) =>
      (init as RequestInit | undefined)?.method === "POST"
        ? new Response(JSON.stringify({ toon: "nero", likes: 8, counted: false }), { status: 200 })
        : new Response(JSON.stringify({ likes: 8 }), { status: 200 })
    );

    const { api } = useIn("nero");
    await nextTick();
    await api.refresh();
    await api.like();

    expect(api.total.value).toBe(8);
    expect(api.liked.value).toBe(true);
    expect(readStoredLike("nero")).toBe(true);
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
