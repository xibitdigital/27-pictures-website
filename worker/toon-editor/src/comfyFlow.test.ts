import { describe, expect, it } from "vitest";
import {
  applyLoadImages,
  applyPagePrompt,
  findPromptCandidates,
  mergeGenerate,
  parseComfyApiGraph,
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
        { alias: "erin-sheet", label: "Image 1 — Erin sheet", kind: "sheet", fileKey: null, fileUrl: null },
        { alias: "previous", label: "Image 2 — previous page", kind: "previous", fileKey: null, fileUrl: null },
      ],
      promptCandidates: [],
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

  it("picks up literal prompt-length strings, skips links and short/blocklisted fields", () => {
    const candidates = findPromptCandidates(graph);
    expect(candidates.map((c) => `${c.nodeId}:${c.inputKey}`)).toEqual(["12:string_b", "25:value"]);
  });

  it("labels each candidate with its node id, title and input key", () => {
    const [first] = findPromptCandidates(graph);
    expect(first.label).toBe("#12 Concatenate Text · string_b");
    expect(first.preview).toBe("SUBJECT LOCK: Erin. Venus composed, faintly luminous.");
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
