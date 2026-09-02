import { describe, expect, it } from "vitest";
import { applyLoadImages, applyPagePrompt, mergeGenerate, parseComfyApiGraph, slotFromLoadTitle } from "./comfyFlow";

describe("parseComfyApiGraph", () => {
  it("rejects UI-style arrays and graphs with no Seedream node", () => {
    expect(parseComfyApiGraph([])).toEqual({
      ok: false,
      error: "flow must be a Comfy API graph object (Save API format)",
    });
    expect(parseComfyApiGraph({ "1": { class_type: "LoadImage" } }).ok).toBe(false);
  });

  it("reads LoadImage order and Seedream V3", () => {
    const parsed = parseComfyApiGraph({
      "1": { class_type: "LoadImage", _meta: { title: "Image 1 — Erin sheet" } },
      "2": { class_type: "LoadImage", _meta: { title: "Image 2 — previous page" } },
      "9": {
        class_type: "ByteDanceSeedreamNodeV3",
        inputs: { model: "seedream 5.0 pro", prompt: "x" },
      },
    });
    expect(parsed).toEqual({
      ok: true,
      model: "seedream 5.0 pro",
      slots: [
        { alias: "erin-sheet", label: "Image 1 — Erin sheet", kind: "sheet", fileKey: null, fileUrl: null },
        { alias: "previous", label: "Image 2 — previous page", kind: "previous", fileKey: null, fileUrl: null },
      ],
    });
  });

  it("accepts the legacy Seedream node", () => {
    const parsed = parseComfyApiGraph({
      "1": { class_type: "LoadImage", _meta: { title: "Image 1 — Nero character sheet" } },
      "6": { class_type: "ByteDanceSeedreamNode", inputs: { model: "seedream 5.0 lite" } },
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.slots[0].alias).toBe("nero-character-sheet");
      expect(parsed.slots[0].label).toBe("Image 1 — Nero character sheet");
    }
  });
});

describe("slotFromLoadTitle", () => {
  it("marks previous-page titles", () => {
    expect(slotFromLoadTitle("Image 3 — previous page (layout / rain)", 3)).toEqual({
      alias: "previous",
      label: "Image 3 — previous page (layout / rain)",
      kind: "previous",
      fileKey: null,
      fileUrl: null,
    });
  });
});

describe("applyLoadImages", () => {
  it("writes Comfy input names onto LoadImage nodes in Image order", () => {
    const graph = {
      "1": { class_type: "LoadImage", inputs: { image: "old-a.png" } },
      "2": { class_type: "LoadImage", inputs: { image: "old-b.png" } },
      "9": { class_type: "ByteDanceSeedreamNodeV3", inputs: { prompt: "old", model: "seedream 5.0 pro" } },
    };
    const out = applyLoadImages(graph, ["erin.png", "prev.png"]);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.graph["1"].inputs?.image).toBe("erin.png");
    expect(out.graph["2"].inputs?.image).toBe("prev.png");
    expect(applyPagePrompt(out.graph, "Erin walks in.")["9"].inputs?.prompt).toBe("Erin walks in.");
  });
});

describe("mergeGenerate", () => {
  it("keeps sheet files when the alias is unchanged", () => {
    const merged = mergeGenerate(
      {
        width: 800,
        height: 1424,
        model: "seedream 5.0 pro",
        flowKey: "editor/_series/x/flow/a.json",
        flowUrl: null,
        slots: [{ alias: "erin", kind: "sheet", fileKey: "editor/_series/x/refs/a.png", fileUrl: null }],
      },
      {
        width: 1152,
        height: 1728,
        model: "seedream 5.0 pro",
        slots: [
          { alias: "erin", kind: "sheet" },
          { alias: "previous", kind: "previous" },
        ],
      }
    );
    expect(merged.width).toBe(1152);
    expect(merged.flowKey).toBe("editor/_series/x/flow/a.json");
    expect(merged.slots[0].fileKey).toBe("editor/_series/x/refs/a.png");
    expect(merged.slots[1]).toMatchObject({ alias: "previous", kind: "previous", fileKey: null });
  });
});
