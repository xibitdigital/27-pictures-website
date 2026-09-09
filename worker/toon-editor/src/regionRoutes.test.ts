import { describe, expect, it } from "vitest";
import worker from "./index";
import { signJwt } from "./jwt";
import type { Env, PageRow, RegionRow, ToonRow, UserRow } from "./types";

const SECRET = "a".repeat(32);

const user: UserRow = {
  id: "u1",
  email: "a@b.c",
  username: "editor",
  role: "admin",
};

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
    kind: "layout",
    bg_color: null,
    ...overrides,
  };
}

function sampleRegion(overrides: Partial<RegionRow> = {}): RegionRow {
  return {
    id: "r1",
    page_id: "p1",
    shape_type: "rect",
    geometry_json: JSON.stringify({ kind: "rect", x: 0.1, y: 0.1, w: 0.4, h: 0.3 }),
    file_key: null,
    file_width: null,
    file_height: null,
    image_offset_x: 0.5,
    image_offset_y: 0.5,
    image_scale: 1,
    border_color: null,
    border_width: 0,
    border_style: "solid",
    sort: 0,
    ...overrides,
  };
}

interface FakeState {
  toons: ToonRow[];
  pages: PageRow[];
  regions: RegionRow[];
}

function makeState(overrides: Partial<FakeState> = {}): FakeState {
  return {
    toons: [sampleToon()],
    pages: [samplePage()],
    regions: [],
    ...overrides,
  };
}

function makeEnv(state: FakeState): Env {
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
            if (/COALESCE\(MAX\(sort\)/.test(sql)) {
              const rows = state.regions.filter((r) => r.page_id === stmt.args[0]);
              const max = rows.length ? Math.max(...rows.map((r) => r.sort)) : -1;
              return { max_sort: max } as unknown as T;
            }
            if (/SELECT asset_page_dir FROM toons/.test(sql)) {
              const toon = state.toons.find((t) => t.id === stmt.args[0]);
              return (toon ? { asset_page_dir: toon.asset_page_dir } : null) as unknown as T;
            }
            if (/FROM page_regions WHERE id = \?/.test(sql)) {
              return (state.regions.find((r) => r.id === stmt.args[0]) || null) as unknown as T;
            }
            if (/FROM pages WHERE id = \?/.test(sql)) {
              return (state.pages.find((p) => p.id === stmt.args[0]) || null) as unknown as T;
            }
            if (/FROM toons WHERE id = \?/.test(sql)) {
              return (state.toons.find((t) => t.id === stmt.args[0]) || null) as unknown as T;
            }
            return null;
          },
          async all<T>() {
            if (/FROM bubbles/.test(sql)) return { results: [] as T[] };
            if (/FROM page_regions/.test(sql) && /INNER JOIN pages/.test(sql)) {
              const toonId = stmt.args[0];
              const pageIds = new Set(state.pages.filter((p) => p.toon_id === toonId).map((p) => p.id));
              return { results: state.regions.filter((r) => pageIds.has(r.page_id)) as unknown as T[] };
            }
            if (/FROM pages WHERE toon_id = \?/.test(sql)) {
              return { results: state.pages.filter((p) => p.toon_id === stmt.args[0]) as unknown as T[] };
            }
            return { results: [] as T[] };
          },
          async run() {
            if (/INSERT INTO page_regions/.test(sql)) {
              const [id, pageId, shapeType, geometryJson, sort, createdAt, updatedAt] = stmt.args as [
                string,
                string,
                string,
                string,
                number,
                string,
                string,
              ];
              state.regions.push({
                id,
                page_id: pageId,
                shape_type: shapeType,
                geometry_json: geometryJson,
                file_key: null,
                file_width: null,
                file_height: null,
                image_offset_x: 0.5,
                image_offset_y: 0.5,
                image_scale: 1,
                border_color: null,
                border_width: 0,
                border_style: "solid",
                sort,
                created_at: createdAt,
                updated_at: updatedAt,
              });
            } else if (/UPDATE page_regions SET shape_type/.test(sql)) {
              const [
                shapeType,
                geometryJson,
                offsetX,
                offsetY,
                scale,
                borderColor,
                borderWidth,
                borderStyle,
                sort,
                updatedAt,
                id,
              ] = stmt.args as [
                string,
                string,
                number,
                number,
                number,
                string | null,
                number,
                string,
                number,
                string,
                string,
              ];
              const region = state.regions.find((r) => r.id === id);
              if (region) {
                region.shape_type = shapeType;
                region.geometry_json = geometryJson;
                region.image_offset_x = offsetX;
                region.image_offset_y = offsetY;
                region.image_scale = scale;
                region.border_color = borderColor;
                region.border_width = borderWidth;
                region.border_style = borderStyle;
                region.sort = sort;
                region.updated_at = updatedAt;
              }
            } else if (/DELETE FROM page_regions WHERE id = \?/.test(sql)) {
              const id = stmt.args[0];
              state.regions = state.regions.filter((r) => r.id !== id);
            } else if (/UPDATE pages SET kind/.test(sql)) {
              const [kind, bgColor, id] = stmt.args as [string, string | null, string];
              const page = state.pages.find((p) => p.id === id);
              if (page) {
                page.kind = kind;
                page.bg_color = bgColor;
              }
            }
            return {};
          },
        };
        return stmt;
      },
    },
  } as unknown as Env;
}

async function authedRequest(url: string, init: RequestInit = {}): Promise<Request> {
  const token = await signJwt({ sub: user.id, email: user.email, exp: Math.floor(Date.now() / 1000) + 60 }, SECRET);
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return new Request(url, { ...init, headers });
}

describe("POST /pages/:id/regions", () => {
  it("creates a rect region at sort 0 when the page has none yet", async () => {
    const env = makeEnv(makeState());
    const res = await worker.fetch(
      await authedRequest("https://toon-editor.example/pages/p1/regions", {
        method: "POST",
        body: JSON.stringify({ geometry: { kind: "rect", x: 0.1, y: 0.2, w: 0.3, h: 0.4 } }),
      }),
      env
    );
    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toMatchObject({
      shapeType: "rect",
      sort: 0,
      geometry: { kind: "rect", x: 0.1, y: 0.2, w: 0.3, h: 0.4 },
    });
  });

  it("stacks a new region above existing ones by sort", async () => {
    const env = makeEnv(
      makeState({ regions: [sampleRegion({ id: "r0", sort: 0 }), sampleRegion({ id: "r1", sort: 1 })] })
    );
    const res = await worker.fetch(
      await authedRequest("https://toon-editor.example/pages/p1/regions", {
        method: "POST",
        body: JSON.stringify({ geometry: { kind: "rect", x: 0, y: 0, w: 0.5, h: 0.5 } }),
      }),
      env
    );
    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toMatchObject({ sort: 2 });
  });

  it("creates a polygon region", async () => {
    const env = makeEnv(makeState());
    const points = [
      { x: 0.1, y: 0.1 },
      { x: 0.5, y: 0.1 },
      { x: 0.3, y: 0.6 },
    ];
    const res = await worker.fetch(
      await authedRequest("https://toon-editor.example/pages/p1/regions", {
        method: "POST",
        body: JSON.stringify({ geometry: { kind: "polygon", points } }),
      }),
      env
    );
    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toMatchObject({ shapeType: "polygon", geometry: { kind: "polygon", points } });
  });

  it("rejects a rect smaller than the minimum size", async () => {
    const env = makeEnv(makeState());
    const res = await worker.fetch(
      await authedRequest("https://toon-editor.example/pages/p1/regions", {
        method: "POST",
        body: JSON.stringify({ geometry: { kind: "rect", x: 0.1, y: 0.1, w: 0.01, h: 0.01 } }),
      }),
      env
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ error: "region is too small" });
  });

  it("rejects a polygon with fewer than 3 points", async () => {
    const env = makeEnv(makeState());
    const res = await worker.fetch(
      await authedRequest("https://toon-editor.example/pages/p1/regions", {
        method: "POST",
        body: JSON.stringify({
          geometry: {
            kind: "polygon",
            points: [
              { x: 0.1, y: 0.1 },
              { x: 0.5, y: 0.5 },
            ],
          },
        }),
      }),
      env
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ error: "polygon needs at least 3 points" });
  });

  it("rejects an unknown shape kind", async () => {
    const env = makeEnv(makeState());
    const res = await worker.fetch(
      await authedRequest("https://toon-editor.example/pages/p1/regions", {
        method: "POST",
        body: JSON.stringify({ geometry: { kind: "circle", x: 0.1, y: 0.1 } }),
      }),
      env
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ error: "shape must be rect or polygon" });
  });

  it("404s for a page that does not exist", async () => {
    const env = makeEnv(makeState());
    const res = await worker.fetch(
      await authedRequest("https://toon-editor.example/pages/missing/regions", {
        method: "POST",
        body: JSON.stringify({ geometry: { kind: "rect", x: 0.1, y: 0.1, w: 0.3, h: 0.3 } }),
      }),
      env
    );
    expect(res.status).toBe(404);
  });

  it("401s without a token", async () => {
    const env = makeEnv(makeState());
    const res = await worker.fetch(
      new Request("https://toon-editor.example/pages/p1/regions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ geometry: { kind: "rect", x: 0.1, y: 0.1, w: 0.3, h: 0.3 } }),
      }),
      env
    );
    expect(res.status).toBe(401);
  });
});

describe("PATCH /regions/:id", () => {
  it("updates the geometry", async () => {
    const env = makeEnv(makeState({ regions: [sampleRegion()] }));
    const res = await worker.fetch(
      await authedRequest("https://toon-editor.example/regions/r1", {
        method: "PATCH",
        body: JSON.stringify({ geometry: { kind: "rect", x: 0.2, y: 0.2, w: 0.5, h: 0.5 } }),
      }),
      env
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ geometry: { kind: "rect", x: 0.2, y: 0.2, w: 0.5, h: 0.5 } });
  });

  it("clamps imageScale to [1, 4]", async () => {
    const tooHigh = makeEnv(makeState({ regions: [sampleRegion()] }));
    const highRes = await worker.fetch(
      await authedRequest("https://toon-editor.example/regions/r1", {
        method: "PATCH",
        body: JSON.stringify({ imageScale: 9 }),
      }),
      tooHigh
    );
    await expect(highRes.json()).resolves.toMatchObject({ imageScale: 4 });

    const tooLow = makeEnv(makeState({ regions: [sampleRegion()] }));
    const lowRes = await worker.fetch(
      await authedRequest("https://toon-editor.example/regions/r1", {
        method: "PATCH",
        body: JSON.stringify({ imageScale: 0.2 }),
      }),
      tooLow
    );
    await expect(lowRes.json()).resolves.toMatchObject({ imageScale: 1 });
  });

  it("clamps image offsets to [0, 1]", async () => {
    const env = makeEnv(makeState({ regions: [sampleRegion()] }));
    const res = await worker.fetch(
      await authedRequest("https://toon-editor.example/regions/r1", {
        method: "PATCH",
        body: JSON.stringify({ imageOffsetX: 1.5, imageOffsetY: -0.5 }),
      }),
      env
    );
    await expect(res.json()).resolves.toMatchObject({ imageOffsetX: 1, imageOffsetY: 0 });
  });

  it("rejects an invalid geometry patch and leaves the shape untouched", async () => {
    const env = makeEnv(makeState({ regions: [sampleRegion()] }));
    const res = await worker.fetch(
      await authedRequest("https://toon-editor.example/regions/r1", {
        method: "PATCH",
        body: JSON.stringify({ geometry: { kind: "rect", x: 0.1, y: 0.1, w: 0.01, h: 0.01 } }),
      }),
      env
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ error: "region is too small" });
  });

  it("falls back to a default shape when stored geometry is corrupt, instead of 500ing", async () => {
    const env = makeEnv(makeState({ regions: [sampleRegion({ geometry_json: "not json" })] }));
    const res = await worker.fetch(
      await authedRequest("https://toon-editor.example/regions/r1", {
        method: "PATCH",
        body: JSON.stringify({ imageScale: 2 }),
      }),
      env
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      imageScale: 2,
      geometry: { kind: "rect", x: 0.1, y: 0.1, w: 0.8, h: 0.8 },
    });
  });

  it("404s for a region that does not exist", async () => {
    const env = makeEnv(makeState());
    const res = await worker.fetch(
      await authedRequest("https://toon-editor.example/regions/missing", {
        method: "PATCH",
        body: JSON.stringify({ imageScale: 2 }),
      }),
      env
    );
    expect(res.status).toBe(404);
  });

  it("sets a border color, width, and style", async () => {
    const env = makeEnv(makeState({ regions: [sampleRegion()] }));
    const res = await worker.fetch(
      await authedRequest("https://toon-editor.example/regions/r1", {
        method: "PATCH",
        body: JSON.stringify({ borderColor: "#FF0000", borderWidth: 3, borderStyle: "dashed" }),
      }),
      env
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      borderColor: "#ff0000",
      borderWidth: 3,
      borderStyle: "dashed",
    });
  });

  it("clamps borderWidth to [0, 20]", async () => {
    const env = makeEnv(makeState({ regions: [sampleRegion()] }));
    const res = await worker.fetch(
      await authedRequest("https://toon-editor.example/regions/r1", {
        method: "PATCH",
        body: JSON.stringify({ borderWidth: 999 }),
      }),
      env
    );
    await expect(res.json()).resolves.toMatchObject({ borderWidth: 20 });
  });

  it("rejects an invalid border color", async () => {
    const env = makeEnv(makeState({ regions: [sampleRegion()] }));
    const res = await worker.fetch(
      await authedRequest("https://toon-editor.example/regions/r1", {
        method: "PATCH",
        body: JSON.stringify({ borderColor: "red" }),
      }),
      env
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ error: "color must be a hex string like #rrggbb, or null" });
  });

  it("ignores an unrecognized borderStyle and keeps the stored one", async () => {
    const env = makeEnv(makeState({ regions: [sampleRegion({ border_style: "dotted" })] }));
    const res = await worker.fetch(
      await authedRequest("https://toon-editor.example/regions/r1", {
        method: "PATCH",
        body: JSON.stringify({ borderStyle: "wavy" }),
      }),
      env
    );
    await expect(res.json()).resolves.toMatchObject({ borderStyle: "dotted" });
  });

  it("clears borderColor with null", async () => {
    const env = makeEnv(makeState({ regions: [sampleRegion({ border_color: "#ff0000" })] }));
    const res = await worker.fetch(
      await authedRequest("https://toon-editor.example/regions/r1", {
        method: "PATCH",
        body: JSON.stringify({ borderColor: null }),
      }),
      env
    );
    await expect(res.json()).resolves.toMatchObject({ borderColor: null });
  });
});

describe("DELETE /regions/:id", () => {
  it("removes the region", async () => {
    const state = makeState({ regions: [sampleRegion()] });
    const env = makeEnv(state);
    const res = await worker.fetch(
      await authedRequest("https://toon-editor.example/regions/r1", { method: "DELETE" }),
      env
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(state.regions).toHaveLength(0);
  });

  it("404s for a region that does not exist", async () => {
    const env = makeEnv(makeState());
    const res = await worker.fetch(
      await authedRequest("https://toon-editor.example/regions/missing", { method: "DELETE" }),
      env
    );
    expect(res.status).toBe(404);
  });
});

describe("PATCH /pages/:id kind", () => {
  it("flips a plate page to layout", async () => {
    const state = makeState({ pages: [samplePage({ kind: "plate" })] });
    const env = makeEnv(state);
    const res = await worker.fetch(
      await authedRequest("https://toon-editor.example/pages/p1", {
        method: "PATCH",
        body: JSON.stringify({ kind: "layout" }),
      }),
      env
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { pages: { id: string; kind: string }[] };
    expect(body.pages.find((p) => p.id === "p1")?.kind).toBe("layout");
    expect(state.pages[0].kind).toBe("layout");
  });

  it("rejects a kind other than plate or layout", async () => {
    const env = makeEnv(makeState());
    const res = await worker.fetch(
      await authedRequest("https://toon-editor.example/pages/p1", {
        method: "PATCH",
        body: JSON.stringify({ kind: "poster" }),
      }),
      env
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ error: "kind must be plate or layout" });
  });

  it("sets a page background color without touching kind", async () => {
    const state = makeState({ pages: [samplePage({ kind: "layout" })] });
    const env = makeEnv(state);
    const res = await worker.fetch(
      await authedRequest("https://toon-editor.example/pages/p1", {
        method: "PATCH",
        body: JSON.stringify({ bgColor: "#112233" }),
      }),
      env
    );
    expect(res.status).toBe(200);
    expect(state.pages[0].kind).toBe("layout");
    expect(state.pages[0].bg_color).toBe("#112233");
  });

  it("rejects an invalid page background color", async () => {
    const env = makeEnv(makeState());
    const res = await worker.fetch(
      await authedRequest("https://toon-editor.example/pages/p1", {
        method: "PATCH",
        body: JSON.stringify({ bgColor: "not-a-color" }),
      }),
      env
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ error: "color must be a hex string like #rrggbb, or null" });
  });

  it("clears bgColor with null", async () => {
    const state = makeState({ pages: [samplePage({ bg_color: "#112233" })] });
    const env = makeEnv(state);
    const res = await worker.fetch(
      await authedRequest("https://toon-editor.example/pages/p1", {
        method: "PATCH",
        body: JSON.stringify({ bgColor: null }),
      }),
      env
    );
    expect(res.status).toBe(200);
    expect(state.pages[0].bg_color).toBeNull();
  });
});
