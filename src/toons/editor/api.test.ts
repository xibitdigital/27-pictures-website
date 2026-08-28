import { afterEach, describe, expect, it, vi } from "vitest";
import { createToon, editorApiBase, getToken, login, setToken, uploadAudio, withSiteQuery } from "./api";

describe("editor api", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it("returns null when VITE_EDITOR_API is unset under Vitest", () => {
    vi.stubEnv("VITE_EDITOR_API", "");
    expect(editorApiBase()).toBeNull();
  });

  it("uses an explicit VITE_EDITOR_API when set", () => {
    vi.stubEnv("VITE_EDITOR_API", "https://editor.example.dev/");
    expect(editorApiBase()).toBe("https://editor.example.dev");
  });

  it("tags catalog and config URLs with the page origin", () => {
    expect(withSiteQuery("/__editor-api/catalog", "https://staging.twentyseven.pictures")).toBe(
      "/__editor-api/catalog?site=https%3A%2F%2Fstaging.twentyseven.pictures"
    );
    expect(withSiteQuery("/__editor-api/catalog?site=http://localhost:5173", "https://twentyseven.pictures")).toBe(
      "/__editor-api/catalog?site=http://localhost:5173"
    );
  });

  it("maps a network failure to the start-the-Worker hint", async () => {
    vi.stubEnv("VITE_EDITOR_API", "https://editor.example.dev");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(login("a@b.c", "password1")).rejects.toThrow(/make editor-worker/);
  });

  it("logs in without a bearer token and stores the JWT", async () => {
    vi.stubEnv("VITE_EDITOR_API", "https://editor.example.dev/");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ token: "sess-1", user: { id: "u1", email: "a@b.c" } }), { status: 200 })
      );
    vi.stubGlobal("fetch", fetchMock);

    const payload = await login("a@b.c", "password1");
    expect(payload.token).toBe("sess-1");
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(headers.get("Authorization")).toBeNull();
    setToken(payload.token);
    expect(getToken()).toBe("sess-1");
  });

  it("POSTs a new toon with the JWT bearer", async () => {
    vi.stubEnv("VITE_EDITOR_API", "https://editor.example.dev/");
    setToken("sess-1");

    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ id: "t1", slug: "demo", title: "Demo", pages: [] }), { status: 201 })
      );
    vi.stubGlobal("fetch", fetchMock);

    const toon = await createToon({ slug: "demo", title: "Demo", subtitle: "", description: "" });
    expect(toon.id).toBe("t1");
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(headers.get("Authorization")).toBe("Bearer sess-1");
  });

  it("POSTs bubble audio as FormData", async () => {
    vi.stubEnv("VITE_EDITOR_API", "https://editor.example.dev/");
    setToken("sess-1");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          key: "editor/demo/sfx/abc.mp3",
          url: "https://x/media/editor/demo/sfx/abc.mp3",
          audio: "editor/demo/sfx/abc.mp3",
        }),
        {
          status: 201,
        }
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    const file = new File([new Uint8Array([1, 2, 3])], "line.mp3", { type: "audio/mpeg" });
    const out = await uploadAudio("t1", file);
    expect(out.audio).toBe("editor/demo/sfx/abc.mp3");
    expect(fetchMock.mock.calls[0][0]).toBe("https://editor.example.dev/toons/t1/audio");
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.body).toBeInstanceOf(FormData);
    const headers = new Headers(init.headers);
    expect(headers.get("Authorization")).toBe("Bearer sess-1");
    expect(headers.get("Content-Type")).toBeNull();
  });
});
