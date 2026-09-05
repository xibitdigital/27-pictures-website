import { describe, expect, it } from "vitest";
import worker from "./index";
import { signJwt } from "./jwt";
import type { BubbleRow, Env, UserRow } from "./types";

const SECRET = "a".repeat(32);

const user: UserRow = {
  id: "u1",
  email: "a@b.c",
  username: "editor",
  role: "admin",
};

function sampleBubble(sort = 0): BubbleRow {
  return {
    id: "b1",
    page_id: "p1",
    x: 0.2,
    y: 0.1,
    variant: "bubble",
    tail: "bottom-left",
    size: 22,
    angle: null,
    text_en: "Hi",
    text_json: null,
    extra_json: null,
    sort,
  };
}

function envWithBubble(bubble: BubbleRow): { env: Env; lastUpdate: unknown[] } {
  const lastUpdate: unknown[] = [];
  const state = { bubble: { ...bubble } };
  const env = {
    JWT_SECRET: SECRET,
    ALLOWED_ORIGINS: "https://twentyseven.pictures",
    ASSETS: { get: async () => null },
    DB: {
      prepare(sql: string) {
        const stmt = {
          args: [] as unknown[],
          bind(...args: unknown[]) {
            stmt.args = args;
            return stmt;
          },
          async first() {
            if (/FROM users/.test(sql)) return user;
            if (/FROM bubbles/.test(sql)) return { ...state.bubble };
            return null;
          },
          async all() {
            return { results: [] };
          },
          async run() {
            if (/UPDATE bubbles SET/.test(sql)) {
              lastUpdate.splice(0, lastUpdate.length, ...stmt.args);
              const [x, y, variant, tail, size, angle, textEn, textJson, extraJson, sort] = stmt.args;
              state.bubble = {
                ...state.bubble,
                x: Number(x),
                y: Number(y),
                variant: String(variant),
                tail: tail == null ? null : String(tail),
                size: size == null ? null : Number(size),
                angle: angle == null ? null : Number(angle),
                text_en: String(textEn),
                text_json: textJson == null ? null : String(textJson),
                extra_json: extraJson == null ? null : String(extraJson),
                sort: Number(sort),
              };
            }
            return {};
          },
        };
        return stmt;
      },
    },
  } as unknown as Env;
  return { env, lastUpdate };
}

async function patchBubble(env: Env, body: Record<string, unknown>, token?: string): Promise<Response> {
  const auth =
    token || (await signJwt({ sub: user.id, email: user.email, exp: Math.floor(Date.now() / 1000) + 60 }, SECRET));
  return worker.fetch(
    new Request("https://toon-editor.example/bubbles/b1", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    env
  );
}

describe("PATCH /bubbles/:id sort", () => {
  it("writes sort so auto-read order can change", async () => {
    const { env, lastUpdate } = envWithBubble(sampleBubble(0));
    const res = await patchBubble(env, { sort: 2 });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ id: "b1", sort: 2 });
    expect(lastUpdate[9]).toBe(2);
  });

  it("rounds a numeric sort and keeps the rest of the row", async () => {
    const { env, lastUpdate } = envWithBubble(sampleBubble(0));
    const res = await patchBubble(env, { sort: 1.8, textEn: "Hi" });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ sort: 2, textEn: "Hi" });
    expect(lastUpdate[9]).toBe(2);
  });

  it("leaves sort alone when the body omits it or sends garbage", async () => {
    const omitted = envWithBubble(sampleBubble(3));
    const omitRes = await patchBubble(omitted.env, { textEn: "Hey" });
    expect(omitRes.status).toBe(200);
    await expect(omitRes.json()).resolves.toMatchObject({ sort: 3, textEn: "Hey" });
    expect(omitted.lastUpdate[9]).toBe(3);

    const bad = envWithBubble(sampleBubble(3));
    const badRes = await patchBubble(bad.env, { sort: "later" });
    expect(badRes.status).toBe(200);
    await expect(badRes.json()).resolves.toMatchObject({ sort: 3 });
    expect(bad.lastUpdate[9]).toBe(3);
  });

  it("returns 401 without a token", async () => {
    const { env } = envWithBubble(sampleBubble(0));
    const res = await worker.fetch(
      new Request("https://toon-editor.example/bubbles/b1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sort: 1 }),
      }),
      env
    );
    expect(res.status).toBe(401);
  });
});
