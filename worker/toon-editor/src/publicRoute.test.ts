import { describe, expect, it } from "vitest";
import worker, { isPublicRoute } from "./index";
import type { Env } from "./types";

function stubEnv(): Env {
  const stmt = {
    bind() {
      return this;
    },
    async all() {
      return { results: [] };
    },
    async first() {
      return null;
    },
    async run() {
      return {};
    },
  };
  return {
    DB: { prepare: () => stmt },
    ASSETS: { get: async () => null },
    ALLOWED_ORIGINS: "https://twentyseven.pictures",
    JWT_SECRET: "a".repeat(32),
  } as unknown as Env;
}

async function call(method: string, path: string, headers?: Record<string, string>): Promise<Response> {
  return worker.fetch(new Request(`https://toon-editor.example${path}`, { method, headers }), stubEnv());
}

describe("isPublicRoute", () => {
  it("allows unauthenticated catalog, config, media, likes, and auth entry", () => {
    expect(isPublicRoute("GET", "/catalog")).toBe(true);
    expect(isPublicRoute("GET", "/sitemap.xml")).toBe(true);
    expect(isPublicRoute("GET", "/config/the-doll")).toBe(true);
    expect(isPublicRoute("GET", "/media/editor/the-doll/cover/a.png")).toBe(true);
    expect(isPublicRoute("GET", "/auth/status")).toBe(true);
    expect(isPublicRoute("GET", "/likes")).toBe(true);
    expect(isPublicRoute("POST", "/likes")).toBe(true);
    expect(isPublicRoute("POST", "/auth/login")).toBe(true);
    expect(isPublicRoute("POST", "/auth/register")).toBe(true);
  });

  it("allows GET /resolve-reader so Pages can look up unlisted Staging URLs", () => {
    expect(isPublicRoute("GET", "/resolve-reader")).toBe(true);
    expect(isPublicRoute("POST", "/resolve-reader")).toBe(false);
  });

  it("keeps the studio behind a JWT", () => {
    expect(isPublicRoute("GET", "/toons")).toBe(false);
    expect(isPublicRoute("POST", "/toons")).toBe(false);
    expect(isPublicRoute("GET", "/auth/me")).toBe(false);
    expect(isPublicRoute("GET", "/series")).toBe(false);
    expect(isPublicRoute("POST", "/catalog")).toBe(false);
    expect(isPublicRoute("GET", "/config")).toBe(false);
    expect(isPublicRoute("GET", "/config/The-Doll")).toBe(false);
  });
});

describe("worker fetch auth gate", () => {
  it("answers OPTIONS without a token", async () => {
    const res = await call("OPTIONS", "/toons");
    expect(res.status).toBe(204);
  });

  it("returns 401 for a private route without a token", async () => {
    const res = await call("GET", "/toons");
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "unauthorized" });
  });

  it("does not 401 GET /resolve-reader", async () => {
    const res = await call("GET", "/resolve-reader?path=/toons/red-smile-origins/the-doll/");
    expect(res.status).not.toBe(401);
    expect(res.status).toBe(404);
  });

  it("does not 401 GET /config/:slug", async () => {
    const res = await call("GET", "/config/the-doll");
    expect(res.status).not.toBe(401);
    expect(res.status).toBe(404);
  });

  it("does not 401 GET /likes or GET /auth/status", async () => {
    const likes = await call("GET", "/likes");
    expect(likes.status).toBe(200);
    await expect(likes.json()).resolves.toEqual({ likes: {} });

    const status = await call("GET", "/auth/status");
    expect(status.status).toBe(200);
    await expect(status.json()).resolves.toEqual({ hasUsers: false });
  });

  it("401s PATCH /bubbles without a token", async () => {
    const res = await call("PATCH", "/bubbles/b1");
    expect(res.status).toBe(401);
  });
});
