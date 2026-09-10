import { afterEach, describe, expect, it, vi } from "vitest";
import {
  RUNWARE_TOKEN_REJECTED,
  runwareDownload,
  runwareResult,
  runwareSubmit,
  runwareVerifyToken,
} from "./runwareClient";
import type { Env } from "./types";

function env(partial: Partial<Env>): Env {
  return partial as Env;
}

describe("runwareSubmit", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("errors without asking Runware when no key is configured", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const out = await runwareSubmit(env({}), {
      prompt: "Erin walks in.",
      images: [],
      model: "bfl:3@1",
      width: 800,
      height: 1424,
    });
    expect(out).toEqual({ ok: false, error: "Runware is not configured (RUNWARE_API_KEY missing)" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("errors when the series has no model configured", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const out = await runwareSubmit(env({ RUNWARE_API_KEY: "k" }), {
      prompt: "p",
      images: [],
      model: "  ",
      width: 800,
      height: 1424,
    });
    expect(out).toEqual({ ok: false, error: "series has no Runware model configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("errors when width/height are missing", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const out = await runwareSubmit(env({ RUNWARE_API_KEY: "k" }), {
      prompt: "p",
      images: [],
      model: "bfl:3@1",
    });
    expect(out).toEqual({ ok: false, error: "Runware needs a plate width and height" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts an imageInference task array with a Bearer key and caps refs at Flux Kontext's own limit (2)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [{ taskUUID: "task-1", status: "processing" }], errors: [] }), {
        status: 200,
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const images = Array.from({ length: 3 }, (_, i) => `https://x/${i}.png`);
    const out = await runwareSubmit(env({ RUNWARE_API_KEY: "rw_secret" }), {
      prompt: "Erin walks in.",
      images,
      model: "bfl:3@1",
      width: 800,
      height: 1424,
    });
    expect(out).toEqual({ ok: true, id: "task-1", pollingUrl: "task-1" });
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://api.runware.ai/v1");
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer rw_secret");
    const body = JSON.parse(String(init.body)) as [
      {
        taskType: string;
        model: string;
        positivePrompt: string;
        width: number;
        height: number;
        referenceImages: string[];
      },
    ];
    expect(body).toHaveLength(1);
    expect(body[0].taskType).toBe("imageInference");
    expect(body[0].model).toBe("bfl:3@1");
    expect(body[0].positivePrompt).toBe("Erin walks in.");
    expect(body[0].width).toBe(800);
    expect(body[0].height).toBe(1424);
    expect(body[0].referenceImages).toHaveLength(2);
    expect(body[0].referenceImages).toEqual(images.slice(0, 2));
  });

  it("caps refs at Seedream 5.0 Pro's own limit (10)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ data: [{ taskUUID: "task-1b" }], errors: [] }), { status: 200 })
      );
    vi.stubGlobal("fetch", fetchMock);
    const images = Array.from({ length: 11 }, (_, i) => `https://x/${i}.png`);
    await runwareSubmit(env({ RUNWARE_API_KEY: "k" }), {
      prompt: "p",
      images,
      model: "bytedance:seedream@5.0-pro",
      width: 800,
      height: 1424,
    });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(String(init.body)) as [{ referenceImages: string[] }];
    expect(body[0].referenceImages).toHaveLength(10);
    expect(body[0].referenceImages).toEqual(images.slice(0, 10));
  });

  it("omits referenceImages entirely with no reference images", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ data: [{ taskUUID: "task-2" }], errors: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await runwareSubmit(env({ RUNWARE_API_KEY: "k" }), {
      prompt: "p",
      images: [],
      model: "bytedance:seedream@5.0-pro",
      width: 800,
      height: 1424,
    });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(String(init.body)) as [Record<string, unknown>];
    expect(body[0].referenceImages).toBeUndefined();
  });

  it("maps a 401 to the key-rejected hint instead of the raw JSON body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [], errors: [{ code: "invalidApiKey", message: "Invalid API key" }] }), {
        status: 401,
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const out = await runwareSubmit(env({ RUNWARE_API_KEY: "nope" }), {
      prompt: "p",
      images: [],
      model: "bfl:3@1",
      width: 800,
      height: 1424,
    });
    expect(out).toEqual({ ok: false, error: RUNWARE_TOKEN_REJECTED });
  });

  it("surfaces a non-auth error from the errors array", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [], errors: [{ code: "invalidModel", message: "Unknown model" }] }), {
        status: 200,
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const out = await runwareSubmit(env({ RUNWARE_API_KEY: "k" }), {
      prompt: "p",
      images: [],
      model: "nope:nope@1",
      width: 800,
      height: 1424,
    });
    expect(out).toEqual({ ok: false, error: "Runware rejected the request: Unknown model" });
  });

  it("sends a normalised key when the stored value still has a Bearer prefix", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ data: [{ taskUUID: "task-3" }], errors: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await runwareSubmit(env({ RUNWARE_API_KEY: "Bearer rw_secret" }), {
      prompt: "p",
      images: [],
      model: "bfl:3@1",
      width: 800,
      height: 1424,
    });
    expect(new Headers((fetchMock.mock.calls[0][1] as RequestInit).headers).get("Authorization")).toBe(
      "Bearer rw_secret"
    );
  });

  it("errors if the response has no task", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ data: [], errors: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const out = await runwareSubmit(env({ RUNWARE_API_KEY: "k" }), {
      prompt: "p",
      images: [],
      model: "bfl:3@1",
      width: 800,
      height: 1424,
    });
    expect(out).toEqual({ ok: false, error: "Runware request returned no task" });
  });
});

describe("runwareResult", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts a getResponse task for the given taskUUID", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ data: [{ status: "processing" }], errors: [] }), { status: 200 })
      );
    vi.stubGlobal("fetch", fetchMock);
    const out = await runwareResult(env({ RUNWARE_API_KEY: "k" }), "task-1");
    expect(out).toEqual({ ok: true, phase: "running" });
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://api.runware.ai/v1");
    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body)) as [
      { taskType: string; taskUUID: string },
    ];
    expect(body).toEqual([{ taskType: "getResponse", taskUUID: "task-1" }]);
  });

  it("returns the image URL on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [{ status: "success", imageURL: "https://out/a.png" }], errors: [] }), {
        status: 200,
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const out = await runwareResult(env({ RUNWARE_API_KEY: "k" }), "task-1");
    expect(out).toEqual({ ok: true, phase: "done", imageUrl: "https://out/a.png" });
  });

  it("reports an error phase for a failed job", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ data: [{ status: "error" }], errors: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const out = await runwareResult(env({ RUNWARE_API_KEY: "k" }), "task-1");
    expect(out).toEqual({ ok: false, error: "Runware job failed" });
  });

  it("errors if succeeded but there's no imageURL", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ data: [{ status: "success" }], errors: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const out = await runwareResult(env({ RUNWARE_API_KEY: "k" }), "task-1");
    expect(out).toEqual({ ok: false, error: "Runware result had no image" });
  });

  it("maps a 401 to the key-rejected hint", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ data: [], errors: [] }), { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);
    const out = await runwareResult(env({ RUNWARE_API_KEY: "k" }), "task-1");
    expect(out).toEqual({ ok: false, error: RUNWARE_TOKEN_REJECTED });
  });

  it("surfaces a non-2xx response as an error", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ errors: [] }), { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);
    const out = await runwareResult(env({ RUNWARE_API_KEY: "k" }), "task-1");
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toContain("Runware result failed (404)");
  });
});

describe("runwareDownload", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the image bytes", async () => {
    const bytes = new Uint8Array([1, 2, 3]).buffer;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(bytes, { status: 200 })));
    const out = await runwareDownload("https://out/a.png");
    expect(out.ok).toBe(true);
    if (out.ok) expect(new Uint8Array(out.bytes)).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("errors on an empty body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new ArrayBuffer(0), { status: 200 })));
    const out = await runwareDownload("https://out/a.png");
    expect(out).toEqual({ ok: false, error: "Runware image download was empty" });
  });
});

describe("runwareVerifyToken", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts an authentication task with the key", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ data: [{}], errors: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(runwareVerifyToken("Bearer rw_secret")).resolves.toEqual({ ok: true });
    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body)) as [
      { taskType: string; apiKey: string },
    ];
    expect(body).toEqual([{ taskType: "authentication", apiKey: "rw_secret" }]);
  });

  it("maps invalidApiKey to the key-rejected hint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [], errors: [{ code: "invalidApiKey", message: "Invalid API key" }] }), {
        status: 401,
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(runwareVerifyToken("rw_nope")).resolves.toEqual({ ok: false, error: RUNWARE_TOKEN_REJECTED });
  });
});
