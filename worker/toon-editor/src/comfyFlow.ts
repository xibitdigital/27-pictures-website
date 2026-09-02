import type { SeriesFlowSlot, SeriesGenerateConfig } from "./apiTypes";

const SEEDREAM = new Set(["ByteDanceSeedreamNodeV3", "ByteDanceSeedreamNode"]);
const MAX_REFS = 10;

export function emptyGenerate(): SeriesGenerateConfig {
  return { width: null, height: null, model: "", flowKey: null, flowUrl: null, slots: [] };
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
  if (/\bprevious\b/i.test(title)) {
    return { alias: "previous", kind: "previous", fileKey: null, fileUrl: null };
  }
  const after = title.split(/\s*[—–-]\s*/).pop() || title;
  const first = after.trim().split(/\s+/)[0] || fallback;
  return { alias: slugAlias(first, fallback), kind: "sheet", fileKey: null, fileUrl: null };
}

export function parseComfyApiGraph(
  raw: unknown
): { ok: true; slots: SeriesFlowSlot[]; model: string } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "flow must be a Comfy API graph object (Save API format)" };
  }
  const graph = raw as Record<
    string,
    { class_type?: unknown; inputs?: Record<string, unknown>; _meta?: { title?: unknown } }
  >;
  const ids = Object.keys(graph);
  if (!ids.length) return { ok: false, error: "flow graph is empty" };

  const seedreamId = ids.find((id) => SEEDREAM.has(String(graph[id]?.class_type || "")));
  if (!seedreamId) {
    return { ok: false, error: "flow needs a ByteDanceSeedreamNodeV3 (or ByteDanceSeedreamNode) node" };
  }

  const loadIds = ids
    .filter((id) => String(graph[id]?.class_type || "") === "LoadImage")
    .sort((a, b) => Number(a) - Number(b) || a.localeCompare(b));
  if (!loadIds.length) return { ok: false, error: "flow needs at least one LoadImage (Image 1…N)" };
  if (loadIds.length > MAX_REFS) {
    return { ok: false, error: `flow has ${loadIds.length} LoadImage nodes; Seedream takes at most ${MAX_REFS}` };
  }

  const slots = loadIds.map((id, i) => slotFromLoadTitle(titleOf(graph[id]), i + 1));
  const model = String(graph[seedreamId]?.inputs?.model || "").trim();
  return { ok: true, slots, model };
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
        const alias = slugAlias(String(slot.alias || ""), `image-${i + 1}`);
        const kind = String(slot.kind || "") === "previous" ? "previous" : "sheet";
        const fileKey = typeof slot.fileKey === "string" && slot.fileKey.trim() ? slot.fileKey.trim() : null;
        return { alias, kind, fileKey, fileUrl: null } as SeriesFlowSlot;
      })
      .filter((slot): slot is SeriesFlowSlot => Boolean(slot));
  }
  return out;
}

export function mergeGenerate(current: SeriesGenerateConfig, incoming: unknown): SeriesGenerateConfig {
  if (incoming === undefined) return current;
  const next = parseGenerateConfig(incoming);
  const byAlias = new Map(current.slots.map((slot) => [slot.alias, slot]));
  const slots = next.slots.map((slot) => {
    const prev = byAlias.get(slot.alias);
    if (slot.kind === "previous") return { ...slot, fileKey: null };
    return { ...slot, fileKey: slot.fileKey || prev?.fileKey || null };
  });
  return {
    width: next.width,
    height: next.height,
    model: next.model,
    flowKey: next.flowKey || current.flowKey,
    flowUrl: null,
    slots,
  };
}
