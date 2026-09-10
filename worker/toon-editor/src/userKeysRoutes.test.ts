import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "./index";
import { signJwt } from "./jwt";
import type { Env, UserRow } from "./types";

const SECRET = "a".repeat(32);
const ENCRYPTION_KEY = "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY="; // 32 raw bytes, base64

const editor: UserRow = { id: "u1", email: "editor@example.com", username: "editor1", role: "editor" };

interface FakeState {
  users: UserRow[];
  keys: Record<string, Record<string, string | null>>;
}

function makeEnv(state: FakeState, extra: Partial<Env> = {}): Env {
  return {
    JWT_SECRET: SECRET,
    ALLOWED_ORIGINS: "https://twentyseven.pictures",
    KEYS_ENCRYPTION_KEY: ENCRYPTION_KEY,
    ...extra,
    DB: {
      prepare(sql: string) {
        const stmt = {
          args: [] as unknown[],
          bind(...args: unknown[]) {
            stmt.args = args;
            return stmt;
          },
          async first<T>() {
            if (/FROM users WHERE id = \?/.test(sql) && /_enc/.test(sql)) {
              const id = String(stmt.args[0]);
              return (state.keys[id] || {}) as unknown as T;
            }
            if (/FROM users WHERE id = \?/.test(sql)) {
              return (state.users.find((u) => u.id === stmt.args[0]) || null) as unknown as T;
            }
            return null;
          },
          async run() {
            const match = sql.match(/UPDATE users SET (\w+) = \? WHERE id = \?/);
            if (match) {
              const [, column] = match;
              const [value, id] = stmt.args as [string | null, string];
              state.keys[id] = state.keys[id] || {};
              state.keys[id][column] = value;
            }
            return {};
          },
          async all() {
            return { results: [] };
          },
        };
        return stmt;
      },
    },
  } as unknown as Env;
}

async function authedRequest(url: string, userId: string, init: RequestInit = {}): Promise<Request> {
  const token = await signJwt({ sub: userId, email: "x@example.com", exp: Math.floor(Date.now() / 1000) + 60 }, SECRET);
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return new Request(url, { ...init, headers });
}

describe("GET /auth/keys", () => {
  it("reports no keys set for a fresh user", async () => {
    const state: FakeState = { users: [editor], keys: {} };
    const res = await worker.fetch(
      await authedRequest("https://toon-editor.example/auth/keys", editor.id),
      makeEnv(state)
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      replicateApiToken: false,
      comfyApiKey: false,
      elevenlabsApiKey: false,
    });
  });

  it("401s with no session", async () => {
    const state: FakeState = { users: [editor], keys: {} };
    const res = await worker.fetch(new Request("https://toon-editor.example/auth/keys"), makeEnv(state));
    expect(res.status).toBe(401);
  });
});

describe("PUT /auth/keys", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("saves a key, encrypted, and reflects it as set", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200 })));
    const state: FakeState = { users: [editor], keys: {} };
    const env = makeEnv(state);
    const res = await worker.fetch(
      await authedRequest("https://toon-editor.example/auth/keys", editor.id, {
        method: "PUT",
        body: JSON.stringify({ name: "replicateApiToken", value: "r8_my_secret_token" }),
      }),
      env
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      replicateApiToken: true,
      comfyApiKey: false,
      elevenlabsApiKey: false,
    });
    const stored = state.keys[editor.id].replicate_api_token_enc;
    expect(stored).toBeTruthy();
    expect(stored).not.toContain("r8_my_secret_token"); // never stored in plaintext
  });

  it("clears a key when value is null", async () => {
    const state: FakeState = { users: [editor], keys: { u1: { comfy_api_key_enc: "iv:cipher" } } };
    const env = makeEnv(state);
    const res = await worker.fetch(
      await authedRequest("https://toon-editor.example/auth/keys", editor.id, {
        method: "PUT",
        body: JSON.stringify({ name: "comfyApiKey", value: null }),
      }),
      env
    );
    expect(res.status).toBe(200);
    expect(state.keys.u1.comfy_api_key_enc).toBeNull();
  });

  it("rejects an unknown key name", async () => {
    const state: FakeState = { users: [editor], keys: {} };
    const env = makeEnv(state);
    const res = await worker.fetch(
      await authedRequest("https://toon-editor.example/auth/keys", editor.id, {
        method: "PUT",
        body: JSON.stringify({ name: "bflApiKey", value: "x" }),
      }),
      env
    );
    expect(res.status).toBe(400);
  });

  it("500s cleanly when KEYS_ENCRYPTION_KEY isn't configured", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200 })));
    const state: FakeState = { users: [editor], keys: {} };
    const env = makeEnv(state, { KEYS_ENCRYPTION_KEY: undefined });
    const res = await worker.fetch(
      await authedRequest("https://toon-editor.example/auth/keys", editor.id, {
        method: "PUT",
        body: JSON.stringify({ name: "replicateApiToken", value: "x" }),
      }),
      env
    );
    expect(res.status).toBe(500);
  });

  it("rejects a Replicate token Replicate itself 401s", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 401 })));
    const state: FakeState = { users: [editor], keys: {} };
    const env = makeEnv(state);
    const res = await worker.fetch(
      await authedRequest("https://toon-editor.example/auth/keys", editor.id, {
        method: "PUT",
        body: JSON.stringify({ name: "replicateApiToken", value: "r8_nope" }),
      }),
      env
    );
    expect(res.status).toBe(400);
    expect(state.keys[editor.id]?.replicate_api_token_enc).toBeUndefined();
  });

  it("401s with no session", async () => {
    const state: FakeState = { users: [editor], keys: {} };
    const res = await worker.fetch(
      new Request("https://toon-editor.example/auth/keys", {
        method: "PUT",
        body: JSON.stringify({ name: "replicateApiToken", value: "x" }),
      }),
      makeEnv(state)
    );
    expect(res.status).toBe(401);
  });
});
