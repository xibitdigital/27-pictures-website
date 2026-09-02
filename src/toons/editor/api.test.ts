import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createToon,
  editorApiBase,
  getToken,
  getSeries,
  listSeries,
  login,
  replacePage,
  saveSeries,
  uploadSeriesFlow,
  setToken,
  fetchCredits,
  generateAudio,
  generatePage,
  uploadAudio,
  withSiteQuery,
} from "./api";

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

  it("surfaces a Worker 5xx body instead of the unreachable-API hint", async () => {
    vi.stubEnv("VITE_EDITOR_API", "https://editor.example.dev");
    setToken("sess-1");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "ComfyUI is not configured" }), { status: 503 }))
    );
    await expect(generatePage("t1", { prompt: "Erin walks in.", includePrevious: false })).rejects.toThrow(
      "ComfyUI is not configured"
    );
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

  it("lists series for the meta form", async () => {
    vi.stubEnv("VITE_EDITOR_API", "https://editor.example.dev/");
    setToken("sess-1");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ series: [{ key: "erin", title: "Erin & the Goblins" }] }), { status: 200 })
      );
    vi.stubGlobal("fetch", fetchMock);
    const rows = await listSeries();
    expect(rows).toEqual([{ key: "erin", title: "Erin & the Goblins" }]);
    expect(fetchMock.mock.calls[0][0]).toBe("https://editor.example.dev/series");
  });

  it("GETs one series with its toons", async () => {
    vi.stubEnv("VITE_EDITOR_API", "https://editor.example.dev/");
    setToken("sess-1");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          series: { key: "erin", title: "Erin & the Goblins" },
          toons: [{ id: "a", slug: "erin", title: "Erin", coverUrl: null }],
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    const body = await getSeries("erin");
    expect(body.series.key).toBe("erin");
    expect(body.toons).toHaveLength(1);
    expect(fetchMock.mock.calls[0][0]).toBe("https://editor.example.dev/series/erin");
  });

  it("PUTs series metadata", async () => {
    vi.stubEnv("VITE_EDITOR_API", "https://editor.example.dev/");
    setToken("sess-1");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ key: "erin", title: "Erin & the Goblins" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const row = await saveSeries({
      key: "erin",
      title: "Erin & the Goblins",
      tagline: "Dark fantasy",
      description: "",
    });
    expect(row.key).toBe("erin");
    expect(fetchMock.mock.calls[0][0]).toBe("https://editor.example.dev/series");
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe("PUT");
  });

  it("POSTs a series Comfy flow as FormData", async () => {
    vi.stubEnv("VITE_EDITOR_API", "https://editor.example.dev/");
    setToken("sess-1");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          key: "erin",
          generate: { flowKey: "editor/_series/erin/flow/a.json", slots: [{ alias: "erin", kind: "sheet" }] },
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    const file = new File([new Uint8Array([123, 125])], "erin.api.json", { type: "application/json" });
    const out = await uploadSeriesFlow("erin", file);
    expect(out.generate?.flowKey).toContain("/flow/");
    expect(fetchMock.mock.calls[0][0]).toBe("https://editor.example.dev/series/erin/flow");
    expect((fetchMock.mock.calls[0][1] as RequestInit).body).toBeInstanceOf(FormData);
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

  it("GETs monthly credits with the JWT bearer", async () => {
    vi.stubEnv("VITE_EDITOR_API", "https://editor.example.dev/");
    setToken("sess-1");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          audio: { used: 10, limit: 100, unit: "chars" },
          image: { used: 0, limit: null, unit: "credits" },
          periodEnd: null,
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    const out = await fetchCredits();
    expect(out.audio.used).toBe(10);
    expect(fetchMock.mock.calls[0][0]).toBe("https://editor.example.dev/credits");
    const headers = new Headers((fetchMock.mock.calls[0][1] as RequestInit).headers);
    expect(headers.get("Authorization")).toBe("Bearer sess-1");
  });

  it("POSTs ElevenLabs generate as JSON", async () => {
    vi.stubEnv("VITE_EDITOR_API", "https://editor.example.dev/");
    setToken("sess-1");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          key: "editor/demo/sfx/gen.mp3",
          url: "https://x/media/editor/demo/sfx/gen.mp3",
          audio: "editor/demo/sfx/gen.mp3",
        }),
        { status: 201 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    const out = await generateAudio("t1", { text: "[whispers] Hi", voice: "erin", model: "eleven_v3", stability: 0.3 });
    expect(out.audio).toBe("editor/demo/sfx/gen.mp3");
    expect(fetchMock.mock.calls[0][0]).toBe("https://editor.example.dev/toons/t1/audio/generate");
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      text: "[whispers] Hi",
      voice: "erin",
      model: "eleven_v3",
      stability: 0.3,
    });
    const headers = new Headers(init.headers);
    expect(headers.get("Authorization")).toBe("Bearer sess-1");
    expect(headers.get("Content-Type")).toBe("application/json");
  });

  it("POSTs a page generate job as JSON", async () => {
    vi.stubEnv("VITE_EDITOR_API", "https://editor.example.dev/");
    setToken("sess-1");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ id: "job-1", status: "running" }), { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    const out = await generatePage("t1", { prompt: "Erin walks in.", includePrevious: true });
    expect(out.id).toBe("job-1");
    expect(fetchMock.mock.calls[0][0]).toBe("https://editor.example.dev/toons/t1/pages/generate");
    expect(JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body))).toEqual({
      prompt: "Erin walks in.",
      includePrevious: true,
    });
  });

  it("POSTs a replacement plate as FormData onto the existing page", async () => {
    vi.stubEnv("VITE_EDITOR_API", "https://editor.example.dev/");
    setToken("sess-1");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "t1", pages: [{ id: "p1", fileKey: "editor/demo/assets/new.webp" }] }), {
        status: 200,
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const file = new File([new Uint8Array([1, 2, 3])], "plate.webp", { type: "image/webp" });
    const out = await replacePage("p1", file, { width: 1152, height: 1728 });
    expect(out.pages[0].fileKey).toBe("editor/demo/assets/new.webp");
    expect(fetchMock.mock.calls[0][0]).toBe("https://editor.example.dev/pages/p1/file");
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    const body = init.body as FormData;
    expect(body.get("file")).toBe(file);
    expect(body.get("width")).toBe("1152");
    expect(body.get("height")).toBe("1728");
    const headers = new Headers(init.headers);
    expect(headers.get("Authorization")).toBe("Bearer sess-1");
    expect(headers.get("Content-Type")).toBeNull();
  });
});
