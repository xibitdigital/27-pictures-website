import type { PromptCandidate, PromptTarget, SeriesFlowSlot, SeriesGenerateConfig } from "./apiTypes";

const SEEDREAM = new Set(["ByteDanceSeedreamNodeV3", "ByteDanceSeedreamNode"]);
const MAX_REFS = 10;
const TEXT_NODES = new Set(["PrimitiveStringMultiline", "PrimitiveString"]);

export type ComfyGraphNode = {
  class_type?: unknown;
  inputs?: Record<string, unknown>;
  _meta?: { title?: unknown };
};
export type ComfyGraph = Record<string, ComfyGraphNode>;

function linkNodeId(value: unknown): string | null {
  if (Array.isArray(value) && typeof value[0] === "string" && value[0]) return value[0];
  return null;
}

/** Seedream `model.images.image_1` (V3) or `image_1` / `image1` (legacy). */
function seedreamImagePins(inputs: Record<string, unknown>): { pin: string; nodeId: string }[] {
  const found: { n: number; pin: string; nodeId: string }[] = [];
  for (const [key, value] of Object.entries(inputs)) {
    const nodeId = linkNodeId(value);
    if (!nodeId) continue;
    const match = key.match(/(?:^|\.)image[_]?(\d+)$/i);
    if (!match) continue;
    found.push({ n: Number(match[1]), pin: `image_${match[1]}`, nodeId });
  }
  found.sort((a, b) => a.n - b.n);
  return found.map(({ pin, nodeId }) => ({ pin, nodeId }));
}

/**
 * LoadImage node ids in the order Seedream actually consumes them (image_1,
 * image_2, …). Comfy Save-API keeps creation-order ids, which can disagree
 * with titles and with the renderer cables — Ivy on node 2 wired to image_1.
 */
export function loadImageIds(graph: ComfyGraph): string[] {
  const all = Object.keys(graph)
    .filter((id) => String(graph[id]?.class_type || "") === "LoadImage")
    .sort((a, b) => Number(a) - Number(b) || a.localeCompare(b));
  const seedreamId = Object.keys(graph).find((id) => SEEDREAM.has(String(graph[id]?.class_type || "")));
  if (!seedreamId) return all;
  const pins = seedreamImagePins(graph[seedreamId]?.inputs || {});
  const ordered: string[] = [];
  const seen = new Set<string>();
  for (const { nodeId } of pins) {
    if (String(graph[nodeId]?.class_type || "") !== "LoadImage" || seen.has(nodeId)) continue;
    ordered.push(nodeId);
    seen.add(nodeId);
  }
  for (const id of all) {
    if (!seen.has(id)) ordered.push(id);
  }
  return ordered;
}

function pinIndex(pin: string): string | null {
  const match = pin.match(/(\d+)$/);
  return match ? match[1] : null;
}

/**
 * Pair each Seedream LoadImage node with the series slot that should fill it.
 * Prefer loadNodeId / rendererInput; then "Image N" in the slot label (so an
 * older D1 row that listed K before Ivy still lands on image_1 if titled Ivy).
 */
export function matchSlotsToLoadNodes(
  graph: ComfyGraph,
  slots: SeriesFlowSlot[]
): { nodeId: string; slot: SeriesFlowSlot }[] {
  const ids = loadImageIds(graph);
  const seedreamId = Object.keys(graph).find((id) => SEEDREAM.has(String(graph[id]?.class_type || "")));
  const pins = seedreamId ? seedreamImagePins(graph[seedreamId]?.inputs || {}) : [];
  const pinByNode = new Map(pins.map((p) => [p.nodeId, p.pin]));
  const used = new Set<number>();
  const out: { nodeId: string; slot: SeriesFlowSlot }[] = [];
  for (const nodeId of ids) {
    const pin = pinByNode.get(nodeId);
    const n = pin ? pinIndex(pin) : null;
    const title = titleOf(graph[nodeId]);
    let idx = slots.findIndex((slot, i) => !used.has(i) && slot.loadNodeId === nodeId);
    if (idx < 0 && pin) idx = slots.findIndex((slot, i) => !used.has(i) && slot.rendererInput === pin);
    if (idx < 0 && n) {
      const re = new RegExp(`\\bimage[\\s_-]*0*${n}\\b`, "i");
      idx = slots.findIndex((slot, i) => !used.has(i) && re.test(`${slot.label} ${slot.alias}`));
    }
    if (idx < 0 && title) idx = slots.findIndex((slot, i) => !used.has(i) && slot.label.trim() === title);
    if (idx < 0) idx = slots.findIndex((_, i) => !used.has(i));
    if (idx < 0) continue;
    used.add(idx);
    out.push({ nodeId, slot: slots[idx] });
  }
  return out;
}

export function applyLoadImages(
  graph: ComfyGraph,
  /** `null` skips that LoadImage node entirely — for a missing optional sheet slot, whatever file is already saved on that node stays. */
  names: (string | null)[],
  /** When set, `names[i]` writes to this LoadImage id (matched slot), not pin order. */
  nodeIds?: string[]
): { ok: true; graph: ComfyGraph } | { ok: false; error: string } {
  const ids = nodeIds ?? loadImageIds(graph);
  if (names.length !== ids.length) {
    return { ok: false, error: `flow expects ${ids.length} images, got ${names.length}` };
  }
  const next: ComfyGraph = JSON.parse(JSON.stringify(graph)) as ComfyGraph;
  ids.forEach((id, i) => {
    const name = names[i];
    if (name == null) return;
    if (!next[id] || String(next[id].class_type || "") !== "LoadImage") return;
    next[id] = { ...next[id], inputs: { ...(next[id].inputs || {}), image: name } };
  });
  return { ok: true, graph: next };
}

export function applyPagePrompt(graph: ComfyGraph, text: string, target?: PromptTarget | null): ComfyGraph {
  const next: ComfyGraph = JSON.parse(JSON.stringify(graph)) as ComfyGraph;
  const trimmed = text.trim();
  if (!trimmed) return next;
  if (target) {
    const node = next[target.nodeId];
    if (!node) return next;
    node.inputs = { ...(node.inputs || {}), [target.inputKey]: trimmed };
    return next;
  }
  // Legacy default for flows with no chosen target: write straight onto every
  // Seedream node's `prompt`. Skip it where that input is wired to an
  // upstream node (an array [nodeId, outputIndex], not a literal string) —
  // overwriting the link would silently sever whatever text-composition
  // chain the flow built on top of it.
  for (const node of Object.values(next)) {
    const cls = String(node.class_type || "");
    if (!SEEDREAM.has(cls)) continue;
    const inputs = { ...(node.inputs || {}) };
    if (Array.isArray(inputs.prompt)) continue;
    inputs.prompt = trimmed;
    node.inputs = inputs;
  }
  return next;
}

/** Simple text nodes the studio can write the per-page prompt into. */
export function findPromptCandidates(graph: ComfyGraph): PromptCandidate[] {
  const ids = Object.keys(graph).sort((a, b) => Number(a) - Number(b) || a.localeCompare(b));
  const out: PromptCandidate[] = [];
  for (const nodeId of ids) {
    const node = graph[nodeId];
    if (!TEXT_NODES.has(String(node?.class_type || ""))) continue;
    const value = node?.inputs?.value;
    const trimmed = typeof value === "string" ? value.trim() : "";
    const title = titleOf(node) || String(node.class_type || "node");
    out.push({
      nodeId,
      inputKey: "value",
      label: `#${nodeId} ${title}`,
      preview: trimmed ? (trimmed.length > 60 ? `${trimmed.slice(0, 60)}…` : trimmed) : "(empty)",
    });
  }
  return out;
}

export const MAX_GENERATE_COUNT = 4;

export function parseGenerateCount(raw: unknown): number {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(MAX_GENERATE_COUNT, n);
}

/** Give each parallel Seedream run a distinct seed so the plates actually differ. */
export function applySeed(graph: ComfyGraph, seed: number): ComfyGraph {
  const next: ComfyGraph = JSON.parse(JSON.stringify(graph)) as ComfyGraph;
  for (const node of Object.values(next)) {
    const cls = String(node.class_type || "");
    if (!SEEDREAM.has(cls)) continue;
    const inputs = { ...(node.inputs || {}) };
    if ("seed" in inputs) inputs.seed = seed;
    if ("model.seed" in inputs || cls === "ByteDanceSeedreamNodeV3") inputs["model.seed"] = seed;
    node.inputs = inputs;
  }
  return next;
}

export function applyPlateSize(graph: ComfyGraph, width: number | null, height: number | null): ComfyGraph {
  if (!width || !height) return graph;
  const next: ComfyGraph = JSON.parse(JSON.stringify(graph)) as ComfyGraph;
  for (const node of Object.values(next)) {
    if (String(node.class_type || "") !== "ImageScale") continue;
    node.inputs = { ...(node.inputs || {}), width, height };
  }
  return next;
}

export function emptyGenerate(): SeriesGenerateConfig {
  return {
    width: null,
    height: null,
    model: "",
    flowKey: null,
    flowUrl: null,
    slots: [],
    promptCandidates: [],
    promptTarget: null,
  };
}

export function slugAlias(raw: string, fallback: string): string {
  const slug = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
}

function titleOf(node: { _meta?: { title?: unknown } } | undefined): string {
  const title = node && node._meta && typeof node._meta.title === "string" ? node._meta.title : "";
  return title.trim();
}

export function slotFromLoadTitle(title: string, index: number): SeriesFlowSlot {
  const fallback = `image-${index}`;
  const label = title.trim() || `Image ${index}`;
  const after =
    label
      .split(/\s*[—–]\s*/)
      .slice(1)
      .join(" ")
      .trim() || label;
  if (/\bprevious\b/i.test(label)) {
    return { alias: "previous", label, kind: "previous", fileKey: null, fileUrl: null };
  }
  return { alias: slugAlias(after, fallback), label, kind: "sheet", fileKey: null, fileUrl: null };
}

export function parseComfyApiGraph(
  raw: unknown
):
  | { ok: true; slots: SeriesFlowSlot[]; model: string; promptCandidates: PromptCandidate[] }
  | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "flow must be a Comfy API graph object (Save API format)" };
  }
  const graph = raw as ComfyGraph;
  const ids = Object.keys(graph);
  if (!ids.length) return { ok: false, error: "flow graph is empty" };

  const seedreamId = ids.find((id) => SEEDREAM.has(String(graph[id]?.class_type || "")));
  if (!seedreamId) {
    return { ok: false, error: "flow needs a ByteDanceSeedreamNodeV3 (or ByteDanceSeedreamNode) node" };
  }

  const loadIds = loadImageIds(graph);
  if (!loadIds.length) return { ok: false, error: "flow needs at least one LoadImage (Image 1…N)" };
  if (loadIds.length > MAX_REFS) {
    return { ok: false, error: `flow has ${loadIds.length} LoadImage nodes; Seedream takes at most ${MAX_REFS}` };
  }

  const pinByNode = new Map(seedreamImagePins(graph[seedreamId]?.inputs || {}).map((p) => [p.nodeId, p.pin]));
  const slots = loadIds.map((id, i) => ({
    ...slotFromLoadTitle(titleOf(graph[id]), i + 1),
    rendererInput: pinByNode.get(id) || null,
    loadNodeId: id,
  }));
  const model = String(graph[seedreamId]?.inputs?.model || "").trim();
  return { ok: true, slots, model, promptCandidates: findPromptCandidates(graph) };
}

export function parseGenerateConfig(raw: unknown): SeriesGenerateConfig {
  const out = emptyGenerate();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  const rec = raw as Record<string, unknown>;
  const width = Number(rec.width);
  const height = Number(rec.height);
  out.width = Number.isFinite(width) && width > 0 ? Math.round(width) : null;
  out.height = Number.isFinite(height) && height > 0 ? Math.round(height) : null;
  out.model = typeof rec.model === "string" ? rec.model.trim() : "";
  out.flowKey = typeof rec.flowKey === "string" && rec.flowKey.trim() ? rec.flowKey.trim() : null;
  if (Array.isArray(rec.slots)) {
    out.slots = rec.slots
      .map((item, i) => {
        if (!item || typeof item !== "object") return null;
        const slot = item as Record<string, unknown>;
        const fallback = `image-${i + 1}`;
        const label = typeof slot.label === "string" && slot.label.trim() ? slot.label.trim() : "";
        const alias = slugAlias(String(slot.alias || label || ""), fallback);
        const kind = String(slot.kind || "") === "previous" || /\bprevious\b/i.test(label) ? "previous" : "sheet";
        const fileKey = typeof slot.fileKey === "string" && slot.fileKey.trim() ? slot.fileKey.trim() : null;
        return {
          alias,
          label: label || `Image ${i + 1} — ${alias}`,
          kind,
          optional: kind === "sheet" ? Boolean(slot.optional) : false,
          fileKey,
          fileUrl: null,
          rendererInput:
            typeof slot.rendererInput === "string" && slot.rendererInput.trim() ? slot.rendererInput.trim() : null,
          loadNodeId: typeof slot.loadNodeId === "string" && slot.loadNodeId.trim() ? slot.loadNodeId.trim() : null,
        } as SeriesFlowSlot;
      })
      .filter((slot): slot is SeriesFlowSlot => Boolean(slot));
  }
  if (Array.isArray(rec.promptCandidates)) {
    out.promptCandidates = rec.promptCandidates
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const c = item as Record<string, unknown>;
        if (typeof c.nodeId !== "string" || typeof c.inputKey !== "string") return null;
        return {
          nodeId: c.nodeId,
          inputKey: c.inputKey,
          label: typeof c.label === "string" && c.label ? c.label : `#${c.nodeId} · ${c.inputKey}`,
          preview: typeof c.preview === "string" ? c.preview : "",
        };
      })
      .filter((c): c is PromptCandidate => Boolean(c));
  }
  if (rec.promptTarget && typeof rec.promptTarget === "object") {
    const t = rec.promptTarget as Record<string, unknown>;
    if (typeof t.nodeId === "string" && typeof t.inputKey === "string") {
      out.promptTarget = { nodeId: t.nodeId, inputKey: t.inputKey };
    }
  }
  return out;
}

export function mergeGenerate(current: SeriesGenerateConfig, incoming: unknown): SeriesGenerateConfig {
  if (incoming === undefined) return current;
  const next = parseGenerateConfig(incoming);
  const byAlias = new Map(current.slots.map((slot) => [slot.alias, slot]));
  const slots = next.slots.map((slot) => {
    const prev = byAlias.get(slot.alias);
    const label = slot.label || prev?.label || `Image — ${slot.alias}`;
    if (slot.kind === "previous") {
      return {
        ...slot,
        label,
        fileKey: null,
        loadNodeId: slot.loadNodeId || prev?.loadNodeId || null,
        rendererInput: slot.rendererInput || prev?.rendererInput || null,
      };
    }
    return {
      ...slot,
      label,
      fileKey: slot.fileKey || prev?.fileKey || null,
      loadNodeId: slot.loadNodeId || prev?.loadNodeId || null,
      rendererInput: slot.rendererInput || prev?.rendererInput || null,
    };
  });
  return {
    width: next.width,
    height: next.height,
    model: next.model,
    flowKey: next.flowKey || current.flowKey,
    flowUrl: null,
    slots,
    // Only a flow (re)upload recomputes these; a plain series save doesn't
    // send them at all, so an empty list here means "unchanged", not "clear".
    promptCandidates: next.promptCandidates.length ? next.promptCandidates : current.promptCandidates,
    promptTarget: next.promptTarget,
  };
}
