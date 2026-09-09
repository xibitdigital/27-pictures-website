import { describe, expect, it } from "vitest";
import { publicWord, readerConfigFromToon } from "./index";

function requestAt(url) {
  return { url };
}

function dbWith(pages, bubblesByPage, regionsByPage = {}) {
  return {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async all() {
              if (/FROM page_regions/.test(sql)) {
                const results = Object.entries(regionsByPage).flatMap(([pageId, rows]) =>
                  (rows as { page_id?: string }[]).map((row) => ({ page_id: pageId, ...row }))
                );
                return { results };
              }
              if (/FROM bubbles/.test(sql)) {
                const results = Object.entries(bubblesByPage).flatMap(([pageId, rows]) =>
                  (rows as { page_id?: string }[]).map((row) => ({ page_id: pageId, ...row }))
                );
                return { results };
              }
              if (/FROM pages/.test(sql) && !/INNER JOIN pages/.test(sql)) return { results: pages };
              return { results: [] };
            },
          };
        },
      };
    },
  };
}

describe("publicWord", () => {
  const req = requestAt("https://toon-editor.example/config/erin-the-revenge");

  it("leaves CDN-relative audio paths alone", () => {
    const word = { x: 0.2, y: 0.1, audio: "assets/sfx/abc.mp3" };
    expect(publicWord(req, word).audio).toBe("assets/sfx/abc.mp3");
  });

  it("rewrites editor/ audio to this Worker origin", () => {
    const word = { x: 0.2, y: 0.1, audio: "editor/erin-the-revenge/assets/abc.mp3" };
    expect(publicWord(req, word).audio).toBe(
      "https://toon-editor.example/media/editor/erin-the-revenge/assets/abc.mp3"
    );
  });
});

describe("readerConfigFromToon", () => {
  const toon = {
    id: "toon-1",
    title: "The Revenge",
    design_width: 1152,
    design_height: 1728,
    extra_json: JSON.stringify({ defaultLang: "en", reverb: "plaza" }),
  };
  const pages = [{ id: "page-1", position: 0, file_key: "assets/plate.webp" }];
  const bubbles = {
    "page-1": [
      {
        id: "b1",
        x: 0.2,
        y: 0.1,
        variant: "bubble",
        tail: "bottom-left",
        text_en: "Hi",
        text_json: JSON.stringify({ en: "Hi" }),
        extra_json: JSON.stringify({ audio: "editor/erin-the-revenge/assets/hi.mp3" }),
        sort: 0,
      },
    ],
  };

  it("builds FlipFrame JSON and rewrites editor audio using the request origin", async () => {
    const cfg = await readerConfigFromToon(
      { DB: dbWith(pages, bubbles) },
      toon,
      requestAt("https://toon-editor.example/config/erin-the-revenge")
    );
    expect(cfg.title).toBe("The Revenge");
    expect(cfg.reverb).toBe("plaza");
    expect(cfg.pages).toHaveLength(1);
    expect(cfg.pages[0].file).toBe("assets/plate.webp");
    expect(cfg.pages[0].words[0].text).toEqual({ en: "Hi" });
    expect(cfg.pages[0].words[0].audio).toBe("https://toon-editor.example/media/editor/erin-the-revenge/assets/hi.mp3");
    expect(cfg.languages).toEqual([
      { code: "en", label: "EN" },
      { code: "it", label: "IT" },
      { code: "de", label: "DE" },
      { code: "fr", label: "FR" },
    ]);
  });

  it("does not throw when a page has captions (request must be in scope)", async () => {
    await expect(
      readerConfigFromToon({ DB: dbWith(pages, bubbles) }, toon, requestAt("https://toon-editor.example/"))
    ).resolves.toMatchObject({ title: "The Revenge" });
  });

  it("rewrites an editor-uploaded plate to this Worker's /media origin, same as audio", async () => {
    const editorPages = [{ id: "page-1", position: 0, file_key: "editor/graph-test/assets/plate.png" }];
    const cfg = await readerConfigFromToon(
      { DB: dbWith(editorPages, {}) },
      toon,
      requestAt("https://toon-editor.example/config/graph-test")
    );
    expect(cfg.pages[0].file).toBe("https://toon-editor.example/media/editor/graph-test/assets/plate.png");
  });

  it("a plate-kind page's entry has no kind/regions keys at all", async () => {
    const cfg = await readerConfigFromToon(
      { DB: dbWith(pages, bubbles) },
      toon,
      requestAt("https://toon-editor.example/config/erin-the-revenge")
    );
    expect(cfg.pages[0]).not.toHaveProperty("kind");
    expect(cfg.pages[0]).not.toHaveProperty("regions");
  });

  it("emits regions for a layout page, sorted, with geometry parsed and file resolved", async () => {
    const layoutPages = [{ id: "page-1", position: 0, file_key: "assets/backdrop.webp", kind: "layout" }];
    // Fixture order mirrors regionsByPageId's own SQL sort (page_regions.sort ASC) since
    // the test's dbWith mock, unlike the real D1 query, doesn't re-sort results itself.
    const regions = {
      "page-1": [
        {
          id: "r-rect",
          shape_type: "rect",
          geometry_json: JSON.stringify({ kind: "rect", x: 0.1, y: 0.1, w: 0.4, h: 0.4 }),
          file_key: "assets/region0.webp",
          file_width: 300,
          file_height: 300,
          image_offset_x: 0.3,
          image_offset_y: 0.7,
          image_scale: 1.5,
          border_color: "#ff0000",
          border_width: 2,
          border_style: "dashed",
          sort: 0,
        },
        {
          id: "r-poly",
          shape_type: "polygon",
          geometry_json: JSON.stringify({
            kind: "polygon",
            points: [
              { x: 0.1, y: 0.1 },
              { x: 0.5, y: 0.1 },
              { x: 0.3, y: 0.6 },
            ],
          }),
          file_key: "editor/erin-the-revenge/assets/region1.webp",
          file_width: 400,
          file_height: 600,
          image_offset_x: 0.5,
          image_offset_y: 0.5,
          image_scale: 1,
          sort: 1,
        },
      ],
    };
    const cfg = await readerConfigFromToon(
      { DB: dbWith(layoutPages, {}, regions) },
      toon,
      requestAt("https://toon-editor.example/config/erin-the-revenge")
    );
    expect(cfg.pages[0].kind).toBe("layout");
    expect(cfg.pages[0].regions).toHaveLength(2);
    expect(cfg.pages[0].regions[0]).toMatchObject({
      shapeType: "rect",
      geometry: { kind: "rect", x: 0.1, y: 0.1, w: 0.4, h: 0.4 },
      file: "assets/region0.webp",
      fileWidth: 300,
      fileHeight: 300,
      imageOffsetX: 0.3,
      imageOffsetY: 0.7,
      imageScale: 1.5,
      borderColor: "#ff0000",
      borderWidth: 2,
      borderStyle: "dashed",
      sort: 0,
    });
    expect(cfg.pages[0].regions[1]).toMatchObject({
      shapeType: "polygon",
      file: "https://toon-editor.example/media/editor/erin-the-revenge/assets/region1.webp",
      borderColor: null,
      borderWidth: 0,
      borderStyle: "solid",
      sort: 1,
    });
  });

  it("filters out a region with no assigned image", async () => {
    const layoutPages = [{ id: "page-1", position: 0, file_key: "assets/backdrop.webp", kind: "layout" }];
    const regions = {
      "page-1": [
        {
          id: "r-empty",
          shape_type: "rect",
          geometry_json: JSON.stringify({ kind: "rect", x: 0.1, y: 0.1, w: 0.4, h: 0.4 }),
          file_key: null,
          file_width: null,
          file_height: null,
          image_offset_x: 0.5,
          image_offset_y: 0.5,
          image_scale: 1,
          sort: 0,
        },
      ],
    };
    const cfg = await readerConfigFromToon(
      { DB: dbWith(layoutPages, {}, regions) },
      toon,
      requestAt("https://toon-editor.example/config/erin-the-revenge")
    );
    expect(cfg.pages[0]).not.toHaveProperty("kind");
    expect(cfg.pages[0]).not.toHaveProperty("regions");
  });
});
