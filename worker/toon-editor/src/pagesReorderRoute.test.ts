import { describe, expect, it } from "vitest";
import worker from "./index";
import { signJwt } from "./jwt";
import type { Env, PageRow, ToonRow, UserRow } from "./types";

const SECRET = "a".repeat(32);

const user: UserRow = { id: "u1", email: "a@b.c", username: "editor", role: "admin" };

function sampleToon(overrides: Partial<ToonRow> = {}): ToonRow {
  return {
    id: "t1",
    slug: "graph-test",
    title: "GraphTest",
    subtitle: "GraphTest",
    description: "GraphTest",
    cover_key: null,
    design_width: 800,
    design_height: 1424,
    status: "draft",
    reader_url: null,
    asset_page_dir: null,
    series_key: null,
    episode_n: null,
    owner_id: null,
    ...overrides,
  };
}

function samplePage(overrides: Partial<PageRow> = {}): PageRow {
  return {
    id: "p1",
    toon_id: "t1",
    position: 0,
    file_key: "editor/graph-test/assets/plate.png",
    width: 800,
    height: 1424,
    kind: "plate",
    bg_color: null,
    ...overrides,
  };
}

interface FakeState {
  toons: ToonRow[];
  pages: PageRow[];
}

/**
 * A single global position uniqueness check across every UPDATE the route issues (inside or
 * outside a batch) — this is what actually verifies the two-phase (negative-then-final) staging
 * in the reorder route never trips the real schema's UNIQUE(toon_id, position) constraint.
 */
function assertUniquePositions(pages: PageRow[]): void {
  const seen = new Map<string, Set<number>>();
  for (const page of pages) {
    const positions = seen.get(page.toon_id) || new Set<number>();
    if (positions.has(page.position)) {
      throw new Error(`UNIQUE constraint failed: pages.toon_id, pages.position (${page.toon_id}, ${page.position})`);
    }
    positions.add(page.position);
    seen.set(page.toon_id, positions);
  }
}

function makeEnv(state: FakeState): Env {
  function exec(sql: string, args: unknown[]): void {
    const setPosition = sql.match(/UPDATE pages SET position = \? WHERE id = \? AND toon_id = \?/);
    if (setPosition) {
      const [position, pageId, toonId] = args as [number, string, string];
      const page = state.pages.find((p) => p.id === pageId && p.toon_id === toonId);
      if (page) page.position = position;
      assertUniquePositions(state.pages); // mirrors SQLite's immediate (non-deferred) UNIQUE check
      return;
    }
    if (/UPDATE toons SET updated_at/.test(sql)) return;
  }
  return {
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
          async first<T>() {
            if (/FROM users/.test(sql)) return user as unknown as T;
            if (/SELECT id FROM toons WHERE id = \?/.test(sql)) {
              const toon = state.toons.find((t) => t.id === stmt.args[0]);
              return (toon ? { id: toon.id } : null) as unknown as T;
            }
            if (/FROM toons WHERE id = \?/.test(sql)) {
              return (state.toons.find((t) => t.id === stmt.args[0]) || null) as unknown as T;
            }
            return null;
          },
          async all<T>() {
            if (/FROM bubbles/.test(sql)) return { results: [] as T[] };
            if (/FROM page_regions/.test(sql)) return { results: [] as T[] };
            if (/SELECT id FROM pages WHERE toon_id = \?/.test(sql)) {
              return {
                results: state.pages.filter((p) => p.toon_id === stmt.args[0]).map((p) => ({ id: p.id })) as T[],
              };
            }
            if (/FROM pages WHERE toon_id = \?/.test(sql)) {
              return {
                results: state.pages
                  .filter((p) => p.toon_id === stmt.args[0])
                  .sort((a, b) => a.position - b.position) as unknown as T[],
              };
            }
            return { results: [] as T[] };
          },
          async run() {
            exec(sql, stmt.args);
            return { success: true };
          },
        };
        return stmt;
      },
      async batch(statements: { args: unknown[] }[]) {
        for (const s of statements) {
          const withSql = s as unknown as { args: unknown[]; run?: () => Promise<unknown> };
          // Each entry is the same bound `stmt` object `prepare` returned — reuse its closure by
          // calling run(), which already knows its own sql via closure captured above.
          if (withSql.run) await withSql.run();
        }
        return [];
      },
    },
  } as unknown as Env;
}

async function authedRequest(url: string, userId: string, init: RequestInit = {}): Promise<Request> {
  const token = await signJwt({ sub: userId, email: "a@b.c", exp: Math.floor(Date.now() / 1000) + 60 }, SECRET);
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Content-Type", "application/json");
  return new Request(url, { ...init, headers });
}

describe("PATCH /toons/:id/pages/reorder", () => {
  it("reorders pages without ever tripping UNIQUE(toon_id, position), even when swapping the ends", async () => {
    const state: FakeState = {
      toons: [sampleToon()],
      pages: [
        samplePage({ id: "p1", position: 0 }),
        samplePage({ id: "p2", position: 1 }),
        samplePage({ id: "p3", position: 2 }),
      ],
    };
    const env = makeEnv(state);
    const res = await worker.fetch(
      await authedRequest("https://toon-editor.example/toons/t1/pages/reorder", "u1", {
        method: "PATCH",
        body: JSON.stringify({ order: ["p3", "p2", "p1"] }),
      }),
      env
    );
    expect(res.status).toBe(200);
    expect(state.pages.find((p) => p.id === "p3")?.position).toBe(0);
    expect(state.pages.find((p) => p.id === "p2")?.position).toBe(1);
    expect(state.pages.find((p) => p.id === "p1")?.position).toBe(2);
  });

  it("rejects an order missing a page", async () => {
    const state: FakeState = {
      toons: [sampleToon()],
      pages: [samplePage({ id: "p1", position: 0 }), samplePage({ id: "p2", position: 1 })],
    };
    const env = makeEnv(state);
    const res = await worker.fetch(
      await authedRequest("https://toon-editor.example/toons/t1/pages/reorder", "u1", {
        method: "PATCH",
        body: JSON.stringify({ order: ["p1"] }),
      }),
      env
    );
    expect(res.status).toBe(400);
    expect(state.pages.find((p) => p.id === "p1")?.position).toBe(0);
    expect(state.pages.find((p) => p.id === "p2")?.position).toBe(1);
  });

  it("rejects an order with an id from a different toon", async () => {
    const state: FakeState = {
      toons: [sampleToon()],
      pages: [samplePage({ id: "p1", position: 0 }), samplePage({ id: "p2", position: 1 })],
    };
    const env = makeEnv(state);
    const res = await worker.fetch(
      await authedRequest("https://toon-editor.example/toons/t1/pages/reorder", "u1", {
        method: "PATCH",
        body: JSON.stringify({ order: ["p1", "unknown"] }),
      }),
      env
    );
    expect(res.status).toBe(400);
  });

  it("404s for a toon that does not exist", async () => {
    const env = makeEnv({ toons: [], pages: [] });
    const res = await worker.fetch(
      await authedRequest("https://toon-editor.example/toons/missing/pages/reorder", "u1", {
        method: "PATCH",
        body: JSON.stringify({ order: [] }),
      }),
      env
    );
    expect(res.status).toBe(404);
  });
});
