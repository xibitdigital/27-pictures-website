import { afterEach, describe, expect, it, vi } from "vitest";
import { comfyHistory, comfySubmitPrompt } from "./comfyClient";
import type { Env } from "./types";

function env(partial: Partial<Env>): Env {
  return partial as Env;
}

describe("comfyBase", () => {
  it("defaults to Comfy Cloud when COMFY_URL is unset", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ prompt_id: "p1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await comfySubmitPrompt(env({}), { "1": { class_type: "LoadImage" } });
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://cloud.comfy.org/api/prompt");
  });
});

describe("comfySubmitPrompt", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends the Comfy account key as extra_data for partner nodes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ prompt_id: "p1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const out = await comfySubmitPrompt(env({ COMFY_URL: "https://comfy.example", COMFY_API_KEY: "comfyui-secret" }), {
      "1": { class_type: "LoadImage" },
    });
    expect(out).toEqual({ ok: true, promptId: "p1" });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual({
      prompt: { "1": { class_type: "LoadImage" } },
      extra_data: { api_key_comfy_org: "comfyui-secret" },
    });
    const headers = new Headers(init.headers);
    expect(headers.get("Authorization")).toBe("Bearer comfyui-secret");
    expect(headers.get("X-API-Key")).toBe("comfyui-secret");
  });
});

describe("comfyHistory", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("tries /jobs first and parses a flat JobDetailResponse", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ outputs: { "1": { images: [{ filename: "a.png" }] } }, status: "completed" }), {
        status: 200,
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const out = await comfyHistory(env({ COMFY_URL: "https://comfy.example" }), "p1");
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://comfy.example/jobs/p1");
    expect(out).toEqual({ ok: true, images: [{ filename: "a.png" }], pending: false });
  });

  it("falls back to /history then /history_v2 when /jobs 404s", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: "NOT_FOUND" }), { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: "NOT_FOUND" }), { status: 404 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            p1: { outputs: { "1": { images: [{ filename: "b.png" }] } }, status: { completed: true } },
          }),
          { status: 200 }
        )
      );
    vi.stubGlobal("fetch", fetchMock);
    const out = await comfyHistory(env({ COMFY_URL: "https://comfy.example" }), "p1");
    expect(fetchMock.mock.calls.map((c) => String(c[0]))).toEqual([
      "https://comfy.example/jobs/p1",
      "https://comfy.example/history/p1",
      "https://comfy.example/history_v2/p1",
    ]);
    expect(out).toEqual({ ok: true, images: [{ filename: "b.png" }], pending: false });
  });

  it("reports a job failure from a plain status string", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ outputs: {}, status: "error" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const out = await comfyHistory(env({ COMFY_URL: "https://comfy.example" }), "p1");
    expect(out).toEqual({ ok: false, error: "Comfy job failed" });
  });
});
