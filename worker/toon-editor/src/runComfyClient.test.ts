import { afterEach, describe, expect, it, vi } from "vitest";
import { runComfyDownload, runComfyListModels, runComfyResult, runComfySubmit } from "./runComfyClient";
import type { Env } from "./types";

function env(partial: Partial<Env>): Env {
  return partial as Env;
}

describe("runComfySubmit", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("errors without asking RunComfy when no key is configured", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const out = await runComfySubmit(env({}), {
      prompt: "Erin walks in.",
      images: ["https://x/a.png"],
      model: "bytedance/seedream-5.0-pro",
      width: 1152,
      height: 1728,
    });
    expect(out).toEqual({ ok: false, error: "RunComfy is not configured (RUNCOMFY_API_KEY missing)" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("errors when the series has no model configured", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const out = await runComfySubmit(env({ RUNCOMFY_API_KEY: "k" }), {
      prompt: "p",
      images: ["https://x/a.png"],
      model: "  ",
    });
    expect(out).toEqual({ ok: false, error: "series has no RunComfy model configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("errors with no reference images", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const out = await runComfySubmit(env({ RUNCOMFY_API_KEY: "k" }), {
      prompt: "p",
      images: [],
      model: "bytedance/seedream-5.0-pro",
    });
    expect(out).toEqual({ ok: false, error: "RunComfy needs at least one reference image" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts to /models/{model_id} verbatim (no extra mode segment) with a Bearer key and the nearest portrait aspect_ratio", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ request_id: "req-1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const out = await runComfySubmit(env({ RUNCOMFY_API_KEY: "secret" }), {
      prompt: "Erin walks in.",
      images: ["https://x/a.png", "https://x/b.png"],
      model: "bytedance/seedream-5.0-pro",
      width: 1152,
      height: 1728, // 2:3 portrait
    });
    expect(out).toEqual({ ok: true, id: "req-1", pollingUrl: "req-1" });
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://model-api.runcomfy.net/v1/models/bytedance/seedream-5.0-pro"
    );
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer secret");
    expect(JSON.parse(String(init.body))).toEqual({
      prompt: "Erin walks in.",
      image: ["https://x/a.png", "https://x/b.png"],
      resolution: "1K",
      output_format: "png",
      aspect_ratio: "2:3",
    });
  });

  it("posts to a model_id that already carries its own variant/mode suffix unchanged", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ request_id: "req-x" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await runComfySubmit(env({ RUNCOMFY_API_KEY: "k" }), {
      prompt: "p",
      images: ["https://x/a.png"],
      model: "bytedance/seedream-5.0-pro/image-to-image",
    });
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://model-api.runcomfy.net/v1/models/bytedance/seedream-5.0-pro/image-to-image"
    );
  });

  it("omits aspect_ratio when no width/height is known", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ request_id: "req-2" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await runComfySubmit(env({ RUNCOMFY_API_KEY: "k" }), {
      prompt: "p",
      images: ["https://x/a.png"],
      model: "bytedance/seedream-5.0-pro",
    });
    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(body.aspect_ratio).toBeUndefined();
  });

  it("caps references at 10", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ request_id: "req-3" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const images = Array.from({ length: 14 }, (_, i) => `https://x/${i}.png`);
    await runComfySubmit(env({ RUNCOMFY_API_KEY: "k" }), {
      prompt: "p",
      images,
      model: "bytedance/seedream-5.0-pro",
    });
    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(body.image).toHaveLength(10);
  });

  it("maps a 401 to a key-rejected error", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("nope", { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);
    const out = await runComfySubmit(env({ RUNCOMFY_API_KEY: "bad" }), {
      prompt: "p",
      images: ["https://x/a.png"],
      model: "bytedance/seedream-5.0-pro",
    });
    expect(out).toEqual({ ok: false, error: "RunComfy rejected the API key" });
  });

  it("maps a 400 UserAccountError (RunComfy's own auth-failure code) to a key-rejected error", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ code: 400004, error: "UserAccountError" }), { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);
    const out = await runComfySubmit(env({ RUNCOMFY_API_KEY: "bad" }), {
      prompt: "p",
      images: ["https://x/a.png"],
      model: "bytedance/seedream-5.0-pro",
    });
    expect(out).toEqual({ ok: false, error: "RunComfy rejected the API key" });
  });

  it("errors if the response has no request_id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const out = await runComfySubmit(env({ RUNCOMFY_API_KEY: "k" }), {
      prompt: "p",
      images: ["https://x/a.png"],
      model: "bytedance/seedream-5.0-pro",
    });
    expect(out).toEqual({ ok: false, error: "RunComfy request returned no request_id" });
  });
});

describe("runComfyResult", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports running for in_queue/in_progress queue status", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ status: "in_progress" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const out = await runComfyResult(env({ RUNCOMFY_API_KEY: "k" }), "req-1");
    expect(out).toEqual({ ok: true, phase: "running" });
    expect(fetchMock).toHaveBeenCalledTimes(1); // only the status check, no result fetch yet
  });

  it("reports an error for a cancelled queue status", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "cancelled" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const out = await runComfyResult(env({ RUNCOMFY_API_KEY: "k" }), "req-1");
    expect(out).toEqual({ ok: false, error: "RunComfy job was cancelled" });
  });

  it("fetches the result and returns the output image URL once the queue status is completed and the result succeeded", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "completed" }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "succeeded", output: { image: "https://out.example/plate.png" } }), {
          status: 200,
        })
      );
    vi.stubGlobal("fetch", fetchMock);
    const out = await runComfyResult(env({ RUNCOMFY_API_KEY: "k" }), "req-1");
    expect(out).toEqual({ ok: true, phase: "done", imageUrl: "https://out.example/plate.png" });
    expect(String(fetchMock.mock.calls[1][0])).toBe("https://model-api.runcomfy.net/v1/requests/req-1/result");
  });

  it("errors when the queue status is completed but the result's own status is not succeeded", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "completed" }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "failed", error: "model refused the prompt" }), { status: 200 })
      );
    vi.stubGlobal("fetch", fetchMock);
    const out = await runComfyResult(env({ RUNCOMFY_API_KEY: "k" }), "req-1");
    expect(out).toEqual({ ok: false, error: "RunComfy job failed: model refused the prompt" });
  });

  it("excludes the submitted reference URLs the result payload echoes back", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "completed" }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "succeeded",
            input: { image: ["https://x/ref.png"] },
            output: { image: "https://out.example/plate.png" },
          }),
          { status: 200 }
        )
      );
    vi.stubGlobal("fetch", fetchMock);
    const out = await runComfyResult(env({ RUNCOMFY_API_KEY: "k" }), "req-1", ["https://x/ref.png"]);
    expect(out).toEqual({ ok: true, phase: "done", imageUrl: "https://out.example/plate.png" });
  });

  it("errors when completed/succeeded but no non-reference image URL is found", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "completed" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "succeeded", output: {} }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const out = await runComfyResult(env({ RUNCOMFY_API_KEY: "k" }), "req-1");
    expect(out).toEqual({ ok: false, error: "RunComfy result had no image" });
  });
});

describe("runComfyDownload", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the image bytes", async () => {
    const bytes = new Uint8Array([1, 2, 3]).buffer;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(bytes, { status: 200 })));
    const out = await runComfyDownload("https://out.example/plate.png");
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.bytes.byteLength).toBe(3);
  });

  it("errors on a non-2xx response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 404 })));
    const out = await runComfyDownload("https://out.example/missing.png");
    expect(out).toEqual({ ok: false, error: "RunComfy image download failed (404)" });
  });
});

describe("runComfyListModels", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("errors without asking RunComfy when no key is configured", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const out = await runComfyListModels(env({}));
    expect(out).toEqual({ ok: false, error: "RunComfy is not configured (RUNCOMFY_API_KEY missing)" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("GETs the image-to-image catalog and maps to {id, label}, sorted by label", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          models: [
            { model_id: "b/model-b", display_name: "Model B" },
            { model_id: "a/model-a", display_name: "Model A" },
            { model_id: "no-name/x" }, // no display_name — falls back to the id
          ],
          total: 3,
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    const out = await runComfyListModels(env({ RUNCOMFY_API_KEY: "k" }));
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://model-api.runcomfy.net/v1/models?category=image-to-image&limit=100"
    );
    expect(out).toEqual({
      ok: true,
      models: [
        { id: "a/model-a", label: "Model A" },
        { id: "b/model-b", label: "Model B" },
        { id: "no-name/x", label: "no-name/x" },
      ],
    });
  });

  it("maps a 401 to a key-rejected error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 401 })));
    const out = await runComfyListModels(env({ RUNCOMFY_API_KEY: "bad" }));
    expect(out).toEqual({ ok: false, error: "RunComfy rejected the API key" });
  });
});
