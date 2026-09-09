import { afterEach, describe, expect, it, vi } from "vitest";
import { fluxDownload, fluxResult, fluxSubmit } from "./fluxClient";
import type { Env } from "./types";

function env(partial: Partial<Env>): Env {
  return partial as Env;
}

describe("fluxSubmit", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("errors without asking BFL when no key is configured", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const out = await fluxSubmit(env({}), { prompt: "Erin walks in.", images: [] });
    expect(out).toEqual({ ok: false, error: "Flux is not configured (BFL_API_KEY missing)" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the x-key header, prompt, webp output, and numbered reference images", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "job-1", polling_url: "https://api.us1.bfl.ai/v1/get_result?id=job-1" }), {
        status: 200,
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const out = await fluxSubmit(env({ BFL_API_KEY: "bfl_secret" }), {
      prompt: "Erin walks in.",
      images: ["https://x/a.png", "https://x/b.png"],
      width: 1152,
      height: 1728,
      seed: 42,
    });
    expect(out).toEqual({ ok: true, id: "job-1", pollingUrl: "https://api.us1.bfl.ai/v1/get_result?id=job-1" });
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://api.bfl.ai/v1/flux-2-pro");
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(new Headers(init.headers).get("x-key")).toBe("bfl_secret");
    expect(JSON.parse(String(init.body))).toEqual({
      prompt: "Erin walks in.",
      output_format: "webp",
      safety_tolerance: 5,
      input_image: "https://x/a.png",
      input_image_2: "https://x/b.png",
      width: 1152,
      height: 1728,
      seed: 42,
    });
  });

  it("rejects more than 8 reference images instead of silently dropping them", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const images = Array.from({ length: 9 }, (_, i) => `https://x/${i}.png`);
    const out = await fluxSubmit(env({ BFL_API_KEY: "bfl_secret" }), { prompt: "p", images });
    expect(out).toEqual({ ok: false, error: "flux-2-pro takes at most 8 reference images, got 9" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("surfaces a non-2xx response as an error", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("bad request", { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);
    const out = await fluxSubmit(env({ BFL_API_KEY: "k" }), { prompt: "p", images: [] });
    expect(out).toEqual({ ok: false, error: "Flux request failed (400) bad request" });
  });

  it("errors if the response has no polling_url — the id alone 404s on a different regional host", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "job-1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const out = await fluxSubmit(env({ BFL_API_KEY: "k" }), { prompt: "p", images: [] });
    expect(out).toEqual({ ok: false, error: "Flux request returned no polling_url" });
  });
});

describe("fluxResult", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const pollingUrl = "https://api.us1.bfl.ai/v1/get_result?id=job-1";

  it("fetches the exact pollingUrl it was given, not a reconstructed one", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "Pending" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const out = await fluxResult(env({ BFL_API_KEY: "k" }), pollingUrl);
    expect(out).toEqual({ ok: true, phase: "running" });
    expect(String(fetchMock.mock.calls[0][0])).toBe(pollingUrl);
  });

  it("returns the signed sample URL when Ready", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ status: "Ready", result: { sample: "https://signed/a.webp" } }), { status: 200 })
      );
    vi.stubGlobal("fetch", fetchMock);
    const out = await fluxResult(env({ BFL_API_KEY: "k" }), pollingUrl);
    expect(out).toEqual({ ok: true, phase: "done", imageUrl: "https://signed/a.webp" });
  });

  it("reports an error phase for a failed/moderated job", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "Error" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const out = await fluxResult(env({ BFL_API_KEY: "k" }), pollingUrl);
    expect(out).toEqual({ ok: false, error: "Flux job failed" });
  });

  it("formats moderation reasons as plain text instead of a raw JSON blob", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: "Request Moderated", details: { "Moderation Reasons": ["Image 2"] } }), {
        status: 200,
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const out = await fluxResult(env({ BFL_API_KEY: "k" }), pollingUrl);
    expect(out).toEqual({ ok: false, error: "Flux job moderated: Image 2" });
  });

  it("joins multiple moderation reasons with a comma", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "Content Moderated",
          details: { "Moderation Reasons": ["Protected Content", "Image 2"] },
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    const out = await fluxResult(env({ BFL_API_KEY: "k" }), pollingUrl);
    expect(out).toEqual({ ok: false, error: "Flux job moderated: Protected Content, Image 2" });
  });

  it("falls back to a JSON snippet for a details shape it doesn't recognize", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: "Error", details: { code: "internal_error" } }), {
        status: 200,
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const out = await fluxResult(env({ BFL_API_KEY: "k" }), pollingUrl);
    expect(out).toEqual({ ok: false, error: 'Flux job failed: {"code":"internal_error"}' });
  });

  it("errors if Ready but the response has no sample", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ status: "Ready", result: {} }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const out = await fluxResult(env({ BFL_API_KEY: "k" }), pollingUrl);
    expect(out).toEqual({ ok: false, error: "Flux result had no image" });
  });

  it("surfaces a 404 (task not found on this host) as an error rather than treating it as pending", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ id: "job-1", status: "Task not found" }), { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);
    const out = await fluxResult(env({ BFL_API_KEY: "k" }), pollingUrl);
    expect(out).toEqual({
      ok: false,
      error: 'Flux result failed (404) {"id":"job-1","status":"Task not found"}',
    });
  });
});

describe("fluxDownload", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the image bytes", async () => {
    const bytes = new Uint8Array([1, 2, 3]).buffer;
    const fetchMock = vi.fn().mockResolvedValue(new Response(bytes, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const out = await fluxDownload("https://signed/a.webp");
    expect(out.ok).toBe(true);
    if (out.ok) expect(new Uint8Array(out.bytes)).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("errors on an empty body (the 10-minute signed URL expired)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(new ArrayBuffer(0), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const out = await fluxDownload("https://signed/a.webp");
    expect(out).toEqual({ ok: false, error: "Flux image download was empty" });
  });
});
