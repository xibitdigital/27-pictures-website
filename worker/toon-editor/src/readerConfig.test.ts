import { describe, expect, it } from "vitest";
import { publicWord, readerConfigFromToon } from "./index";

function requestAt(url) {
  return { url };
}

function dbWith(pages, bubblesByPage) {
  return {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async all() {
              if (/FROM pages/.test(sql) && !/bubbles/.test(sql)) return { results: pages };
              if (/FROM bubbles/.test(sql) || /INNER JOIN pages/.test(sql)) {
                const results = Object.entries(bubblesByPage).flatMap(([pageId, rows]) =>
                  (rows as { page_id?: string }[]).map((row) => ({ page_id: pageId, ...row }))
                );
                return { results };
              }
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
});
