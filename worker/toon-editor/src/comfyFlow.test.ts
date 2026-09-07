import { describe, expect, it } from "vitest";
import {
  applyLoadImages,
  applyPagePrompt,
  applySeed,
  findPromptCandidates,
  matchSlotsToLoadNodes,
  mergeGenerate,
  parseComfyApiGraph,
  parseGenerateCount,
  slotFromLoadTitle,
} from "./comfyFlow";

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
        {
          alias: "erin-sheet",
          label: "Image 1 — Erin sheet",
          kind: "sheet",
          fileKey: null,
          fileUrl: null,
          rendererInput: null,
          loadNodeId: "1",
        },
        {
          alias: "previous",
          label: "Image 2 — previous page",
          kind: "previous",
          fileKey: null,
          fileUrl: null,
          rendererInput: null,
          loadNodeId: "2",
        },
      ],
      promptCandidates: [],
    });
  });

  it("orders slots by Seedream image_N cables, not LoadImage node ids", () => {
    // Same pin map as ~/Downloads/ivy-bloom (8).json: node 1 is titled K,
    // node 2 is Ivy, but image_1 is wired to node 2.
    const parsed = parseComfyApiGraph({
      "1": { class_type: "LoadImage", _meta: { title: "Image 2 - K" } },
      "2": { class_type: "LoadImage", _meta: { title: "Image 1 - Ivy" } },
      "10": { class_type: "LoadImage", _meta: { title: "Image 3 - Ink" } },
      "11": { class_type: "LoadImage", _meta: { title: "Image 4 — previous page" } },
      "6": {
        class_type: "ByteDanceSeedreamNodeV3",
        inputs: {
          model: "seedream 5.0 pro",
          "model.images.image_1": ["2", 0],
          "model.images.image_2": ["1", 0],
          "model.images.image_3": ["10", 0],
          "model.images.image_4": ["11", 0],
        },
      },
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.slots.map((s) => s.label)).toEqual([
      "Image 1 - Ivy",
      "Image 2 - K",
      "Image 3 - Ink",
      "Image 4 — previous page",
    ]);
    expect(parsed.slots.map((s) => s.rendererInput)).toEqual(["image_1", "image_2", "image_3", "image_4"]);
    expect(parsed.slots.map((s) => s.loadNodeId)).toEqual(["2", "1", "10", "11"]);
    expect(parsed.slots[3].kind).toBe("previous");
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

describe("parseGenerateCount", () => {
  it("clamps to 1–4", () => {
    expect(parseGenerateCount(undefined)).toBe(1);
    expect(parseGenerateCount("3")).toBe(3);
    expect(parseGenerateCount(9)).toBe(4);
    expect(parseGenerateCount(0)).toBe(1);
  });
});

describe("matchSlotsToLoadNodes", () => {
  const ivyGraph = {
    "1": { class_type: "LoadImage", _meta: { title: "Image 2 - K" } },
    "2": { class_type: "LoadImage", _meta: { title: "Image 1 - Ivy" } },
    "6": {
      class_type: "ByteDanceSeedreamNodeV3",
      inputs: {
        "model.images.image_1": ["2", 0],
        "model.images.image_2": ["1", 0],
      },
    },
  };

  it("pairs an id-order D1 row (K then Ivy) to Seedream cables via Image N labels", () => {
    const paired = matchSlotsToLoadNodes(ivyGraph, [
      { alias: "image-2-k", label: "Image 2 - K", kind: "sheet" },
      { alias: "image-1-ivy", label: "Image 1 - Ivy", kind: "sheet" },
    ]);
    expect(paired.map((p) => [p.nodeId, p.slot.alias])).toEqual([
      ["2", "image-1-ivy"],
      ["1", "image-2-k"],
    ]);
  });

  it("prefers stored loadNodeId over slot array order", () => {
    const paired = matchSlotsToLoadNodes(ivyGraph, [
      { alias: "k", label: "K", kind: "sheet", loadNodeId: "1" },
      { alias: "ivy", label: "Ivy", kind: "sheet", loadNodeId: "2" },
    ]);
    expect(paired.map((p) => [p.nodeId, p.slot.alias])).toEqual([
      ["2", "ivy"],
      ["1", "k"],
    ]);
  });
});

describe("applySeed", () => {
  it("writes model.seed on Seedream V3 and seed on the legacy node", () => {
    const v3 = applySeed(
      { "9": { class_type: "ByteDanceSeedreamNodeV3", inputs: { prompt: "x", "model.seed": 1 } } },
      42
    );
    expect(v3["9"].inputs?.["model.seed"]).toBe(42);
    const lite = applySeed({ "6": { class_type: "ByteDanceSeedreamNode", inputs: { seed: 0, max_images: 1 } } }, 7);
    expect(lite["6"].inputs?.seed).toBe(7);
    expect(lite["6"].inputs?.max_images).toBe(1);
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

  it("writes files onto LoadImage nodes in Seedream pin order when node ids disagree", () => {
    const graph = {
      "1": { class_type: "LoadImage", inputs: { image: "old-k.png" } },
      "2": { class_type: "LoadImage", inputs: { image: "old-ivy.png" } },
      "6": {
        class_type: "ByteDanceSeedreamNodeV3",
        inputs: {
          "model.images.image_1": ["2", 0],
          "model.images.image_2": ["1", 0],
        },
      },
    };
    const out = applyLoadImages(graph, ["ivy.png", "k.png"]);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.graph["2"].inputs?.image).toBe("ivy.png");
    expect(out.graph["1"].inputs?.image).toBe("k.png");
  });

  it("writes names onto explicit node ids even when that disagrees with pin order", () => {
    const graph = {
      "1": { class_type: "LoadImage", inputs: { image: "old-k.png" } },
      "2": { class_type: "LoadImage", inputs: { image: "old-ivy.png" } },
      "6": {
        class_type: "ByteDanceSeedreamNodeV3",
        inputs: {
          "model.images.image_1": ["2", 0],
          "model.images.image_2": ["1", 0],
        },
      },
    };
    const out = applyLoadImages(graph, ["k.png", "ivy.png"], ["1", "2"]);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.graph["1"].inputs?.image).toBe("k.png");
    expect(out.graph["2"].inputs?.image).toBe("ivy.png");
  });

  it("leaves a LoadImage node untouched when its name is null (missing optional sheet)", () => {
    const graph = {
      "1": { class_type: "LoadImage", inputs: { image: "old-a.png" } },
      "2": { class_type: "LoadImage", inputs: { image: "old-b.png" } },
    };
    const out = applyLoadImages(graph, ["erin.png", null]);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.graph["1"].inputs?.image).toBe("erin.png");
    expect(out.graph["2"].inputs?.image).toBe("old-b.png");
  });
});

describe("findPromptCandidates", () => {
  // Trimmed shape of a real flow (erin-ep2-generate-switch.api.json): the
  // Seedream node's prompt is wired to an upstream StringConcatenate chain,
  // not a literal — so it must NOT show up as a candidate itself, only the
  // literal text nodes feeding it should.
  const graph = {
    "7": {
      class_type: "ByteDanceSeedreamNodeV3",
      inputs: { prompt: ["12", 0], model: "seedream 5.0 pro" },
      _meta: { title: "Seedream 5.0 Pro — generate" },
    },
    "12": {
      class_type: "StringConcatenate",
      inputs: { string_a: ["24", 0], string_b: "SUBJECT LOCK: Erin. Venus composed, faintly luminous.", delimiter: "" },
      _meta: { title: "Concatenate Text" },
    },
    "25": {
      class_type: "PrimitiveStringMultiline",
      inputs: { value: "FORMAT: Black and white dark-fantasy manga page, vertical 1152x1728." },
      _meta: { title: "Text (Multiline)" },
    },
    "36": { class_type: "PrimitiveBoolean", inputs: { value: false }, _meta: { title: "Single Page" } },
  };

  it("lists PrimitiveStringMultiline nodes even when the placeholder is short", () => {
    const candidates = findPromptCandidates({
      ...graph,
      "35": {
        class_type: "PrimitiveStringMultiline",
        inputs: { value: "PROMPT HERE" },
        _meta: { title: "Prompt" },
      },
    });
    expect(candidates.map((c) => `${c.nodeId}:${c.inputKey}`)).toEqual(["25:value", "35:value"]);
    expect(candidates[1]).toMatchObject({ label: "#35 Prompt", preview: "PROMPT HERE" });
  });

  it("does not list Concatenate or Seedream nodes", () => {
    const candidates = findPromptCandidates(graph);
    expect(candidates.map((c) => `${c.nodeId}:${c.inputKey}`)).toEqual(["25:value"]);
    expect(candidates[0].label).toBe("#25 Text (Multiline)");
  });
});

describe("applyPagePrompt with a target", () => {
  it("writes only into the chosen node input", () => {
    const graph = {
      "7": { class_type: "ByteDanceSeedreamNodeV3", inputs: { prompt: ["12", 0] } },
      "12": { class_type: "StringConcatenate", inputs: { string_b: "old text" } },
    };
    const out = applyPagePrompt(graph, "Erin walks in.", { nodeId: "12", inputKey: "string_b" });
    expect(out["12"].inputs?.string_b).toBe("Erin walks in.");
    expect(out["7"].inputs?.prompt).toEqual(["12", 0]);
  });

  it("without a target, skips a Seedream node whose prompt is a link instead of clobbering it", () => {
    const graph = {
      "7": { class_type: "ByteDanceSeedreamNodeV3", inputs: { prompt: ["12", 0] } },
      "12": { class_type: "StringConcatenate", inputs: { string_b: "old text" } },
    };
    const out = applyPagePrompt(graph, "Erin walks in.");
    expect(out["7"].inputs?.prompt).toEqual(["12", 0]);
    expect(out["12"].inputs?.string_b).toBe("old text");
  });
});

describe("mergeGenerate", () => {
  const baseCurrent = {
    width: 800,
    height: 1424,
    model: "seedream 5.0 pro",
    flowKey: "editor/_series/x/flow/a.json",
    flowUrl: null,
    slots: [{ alias: "erin", kind: "sheet", fileKey: "editor/_series/x/refs/a.png", fileUrl: null }],
    promptCandidates: [{ nodeId: "12", inputKey: "string_b", label: "#12 Concatenate Text · string_b", preview: "…" }],
    promptTarget: { nodeId: "12", inputKey: "string_b" },
  };

  it("keeps sheet files when the alias is unchanged", () => {
    const merged = mergeGenerate(baseCurrent, {
      width: 1152,
      height: 1728,
      model: "seedream 5.0 pro",
      slots: [
        { alias: "erin", kind: "sheet" },
        { alias: "previous", kind: "previous" },
      ],
      promptTarget: null,
    });
    expect(merged.width).toBe(1152);
    expect(merged.flowKey).toBe("editor/_series/x/flow/a.json");
    expect(merged.slots[0].fileKey).toBe("editor/_series/x/refs/a.png");
    expect(merged.slots[1]).toMatchObject({ alias: "previous", kind: "previous", fileKey: null });
  });

  it("carries the optional flag through on a sheet slot", () => {
    const merged = mergeGenerate(baseCurrent, {
      width: 1152,
      height: 1728,
      model: "seedream 5.0 pro",
      slots: [{ alias: "erin", kind: "sheet", optional: true }],
      promptTarget: null,
    });
    expect(merged.slots[0]).toMatchObject({ optional: true, fileKey: "editor/_series/x/refs/a.png" });
  });

  it("keeps promptCandidates on a plain save that doesn't send any", () => {
    const merged = mergeGenerate(baseCurrent, { width: 1152, height: 1728, model: "seedream 5.0 pro", slots: [] });
    expect(merged.promptCandidates).toEqual(baseCurrent.promptCandidates);
  });

  it("replaces promptCandidates when a flow re-upload sends a fresh list", () => {
    const fresh = [{ nodeId: "25", inputKey: "value", label: "#25 Text (Multiline) · value", preview: "…" }];
    const merged = mergeGenerate(baseCurrent, {
      width: 1152,
      height: 1728,
      model: "seedream 5.0 pro",
      slots: [],
      promptCandidates: fresh,
    });
    expect(merged.promptCandidates).toEqual(fresh);
  });

  it("takes promptTarget directly from what's sent, including clearing it to null", () => {
    const merged = mergeGenerate(baseCurrent, {
      width: 1152,
      height: 1728,
      model: "seedream 5.0 pro",
      slots: [],
      promptTarget: null,
    });
    expect(merged.promptTarget).toBeNull();
  });
});
