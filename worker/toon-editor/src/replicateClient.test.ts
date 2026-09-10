import { afterEach, describe, expect, it, vi } from "vitest";
import { replicateDownload, replicateResult, replicateSubmit } from "./replicateClient";
import type { Env } from "./types";

function env(partial: Partial<Env>): Env {
  return partial as Env;
}

describe("replicateSubmit", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("errors without asking Replicate when no token is configured", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const out = await replicateSubmit(env({}), "replicate-flux", { prompt: "Erin walks in.", images: [] });
    expect(out).toEqual({ ok: false, error: "Replicate is not configured (REPLICATE_API_TOKEN missing)" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("caps replicate-flux (Kontext) at 2 numbered reference images and hits the multi-image-kontext-pro model", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ id: "pred-1", urls: { get: "https://api.replicate.com/v1/predictions/pred-1" } }),
          { status: 201 }
        )
      );
    vi.stubGlobal("fetch", fetchMock);
    const out = await replicateSubmit(env({ REPLICATE_API_TOKEN: "r8_secret" }), "replicate-flux", {
      prompt: "Erin walks in.",
      images: ["https://x/a.png", "https://x/b.png", "https://x/c.png"],
    });
    expect(out).toEqual({
      ok: true,
      id: "pred-1",
      pollingUrl: "https://api.replicate.com/v1/predictions/pred-1",
    });
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api.replicate.com/v1/models/flux-kontext-apps/multi-image-kontext-pro/predictions"
    );
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer r8_secret");
    expect(JSON.parse(String(init.body))).toEqual({
      input: {
        prompt: "Erin walks in.",
        input_image_1: "https://x/a.png",
        input_image_2: "https://x/b.png",
        // Third image dropped — Kontext's multi-image variant only accepts two.
      },
    });
  });

  it("sends up to 8 references as image_input for replicate-seedream, hitting the seedream-4 model", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ id: "pred-2", urls: { get: "https://api.replicate.com/v1/predictions/pred-2" } }),
          { status: 201 }
        )
      );
    vi.stubGlobal("fetch", fetchMock);
    const images = Array.from({ length: 9 }, (_, i) => `https://x/${i}.png`);
    const out = await replicateSubmit(env({ REPLICATE_API_TOKEN: "r8_secret" }), "replicate-seedream", {
      prompt: "A close-up.",
      images,
    });
    expect(out.ok).toBe(true);
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api.replicate.com/v1/models/bytedance/seedream-4/predictions"
    );
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(String(init.body)) as { input: { image_input: string[] } };
    expect(body.input.image_input).toHaveLength(8);
    expect(body.input.image_input).toEqual(images.slice(0, 8));
  });

  it("omits image_input entirely for replicate-seedream with no references (pure text-to-image)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "pred-3", urls: { get: "https://api.replicate.com/v1/predictions/pred-3" } }), {
        status: 201,
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    await replicateSubmit(env({ REPLICATE_API_TOKEN: "k" }), "replicate-seedream", { prompt: "p", images: [] });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual({ input: { prompt: "p" } });
  });

  it("maps the series design size to the nearest aspect_ratio enum value", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "pred-4", urls: { get: "https://api.replicate.com/v1/predictions/pred-4" } }), {
        status: 201,
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    await replicateSubmit(env({ REPLICATE_API_TOKEN: "k" }), "replicate-seedream", {
      prompt: "p",
      images: [],
      width: 1008,
      height: 1792,
    });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual({ input: { prompt: "p", aspect_ratio: "9:16" } });
  });

  it("omits aspect_ratio when no design size is given", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "pred-5", urls: { get: "https://api.replicate.com/v1/predictions/pred-5" } }), {
        status: 201,
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    await replicateSubmit(env({ REPLICATE_API_TOKEN: "k" }), "replicate-seedream", { prompt: "p", images: [] });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual({ input: { prompt: "p" } });
  });

  it("surfaces a non-2xx response as an error", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("bad request", { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);
    const out = await replicateSubmit(env({ REPLICATE_API_TOKEN: "k" }), "replicate-flux", { prompt: "p", images: [] });
    expect(out).toEqual({ ok: false, error: "Replicate request failed (400) bad request" });
  });

  it("errors if the response has no urls.get to poll", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "pred-1" }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const out = await replicateSubmit(env({ REPLICATE_API_TOKEN: "k" }), "replicate-flux", { prompt: "p", images: [] });
    expect(out).toEqual({ ok: false, error: "Replicate request returned no polling url" });
  });
});

describe("replicateResult", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const pollingUrl = "https://api.replicate.com/v1/predictions/pred-1";

  it("fetches the exact polling URL it was given", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ status: "processing" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const out = await replicateResult(env({ REPLICATE_API_TOKEN: "k" }), pollingUrl);
    expect(out).toEqual({ ok: true, phase: "running" });
    expect(String(fetchMock.mock.calls[0][0])).toBe(pollingUrl);
  });

  it("returns the output URL when succeeded", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ status: "succeeded", output: "https://out/a.png" }), { status: 200 })
      );
    vi.stubGlobal("fetch", fetchMock);
    const out = await replicateResult(env({ REPLICATE_API_TOKEN: "k" }), pollingUrl);
    expect(out).toEqual({ ok: true, phase: "done", imageUrl: "https://out/a.png" });
  });

  it("takes the first element when output is an array", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: "succeeded", output: ["https://out/a.png", "https://out/b.png"] }), {
        status: 200,
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const out = await replicateResult(env({ REPLICATE_API_TOKEN: "k" }), pollingUrl);
    expect(out).toEqual({ ok: true, phase: "done", imageUrl: "https://out/a.png" });
  });

  it("reports an error phase for a failed job, including the error detail", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ status: "failed", error: "NSFW content detected" }), { status: 200 })
      );
    vi.stubGlobal("fetch", fetchMock);
    const out = await replicateResult(env({ REPLICATE_API_TOKEN: "k" }), pollingUrl);
    expect(out).toEqual({ ok: false, error: "Replicate job failed: NSFW content detected" });
  });

  it("reports a canceled job as an error", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "canceled" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const out = await replicateResult(env({ REPLICATE_API_TOKEN: "k" }), pollingUrl);
    expect(out).toEqual({ ok: false, error: "Replicate job canceled" });
  });

  it("errors if succeeded but the response has no output", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "succeeded" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const out = await replicateResult(env({ REPLICATE_API_TOKEN: "k" }), pollingUrl);
    expect(out).toEqual({ ok: false, error: "Replicate result had no image" });
  });

  it("surfaces a non-2xx response as an error", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("not found", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);
    const out = await replicateResult(env({ REPLICATE_API_TOKEN: "k" }), pollingUrl);
    expect(out).toEqual({ ok: false, error: "Replicate result failed (404) not found" });
  });
});

describe("replicateDownload", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the image bytes", async () => {
    const bytes = new Uint8Array([1, 2, 3]).buffer;
    const fetchMock = vi.fn().mockResolvedValue(new Response(bytes, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const out = await replicateDownload("https://out/a.png");
    expect(out.ok).toBe(true);
    if (out.ok) expect(new Uint8Array(out.bytes)).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("errors on an empty body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(new ArrayBuffer(0), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const out = await replicateDownload("https://out/a.png");
    expect(out).toEqual({ ok: false, error: "Replicate image download was empty" });
  });
});
