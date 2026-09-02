import { afterEach, describe, expect, it, vi } from "vitest";
import { comfySubmitPrompt } from "./comfyClient";
import type { Env } from "./types";

function env(partial: Partial<Env>): Env {
  return partial as Env;
}

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
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer comfyui-secret");
  });
});
