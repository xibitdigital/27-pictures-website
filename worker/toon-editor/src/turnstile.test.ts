import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyTurnstile } from "./turnstile";

describe("verifyTurnstile", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("fails closed when no secret is configured", async () => {
    expect(await verifyTurnstile({}, "some-token", "1.2.3.4")).toBe(false);
  });

  it("fails closed when no token is given", async () => {
    expect(await verifyTurnstile({ TURNSTILE_SECRET_KEY: "secret" }, "", "1.2.3.4")).toBe(false);
  });

  it("passes through Cloudflare's success flag", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ json: async () => ({ success: true }) });
    vi.stubGlobal("fetch", fetchMock);
    const ok = await verifyTurnstile({ TURNSTILE_SECRET_KEY: "secret" }, "good-token", "1.2.3.4");
    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("fails closed on a Cloudflare-reported failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({ success: false }) }));
    expect(await verifyTurnstile({ TURNSTILE_SECRET_KEY: "secret" }, "bad-token", null)).toBe(false);
  });

  it("fails closed if the request itself throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    expect(await verifyTurnstile({ TURNSTILE_SECRET_KEY: "secret" }, "token", null)).toBe(false);
  });
});
