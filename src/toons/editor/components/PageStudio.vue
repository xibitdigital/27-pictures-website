<script setup lang="ts">
import { Save, Settings2 } from "@lucide/vue";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter, RouterLink } from "vue-router";
import {
  addBubble,
  addRegion,
  deleteBubble,
  deletePage,
  deleteRegion,
  generatePage,
  generateRegionImage,
  getJob,
  getSeries,
  getToon,
  patchBubble,
  patchPageBgColor,
  patchRegion,
  readImageSize,
  replacePage,
  setPageKind,
  uploadPage,
  uploadRegionImage,
} from "../api";
import type { LangCode } from "../../bookReader/types";
import {
  visibilityFromStatus,
  visibilityLabel,
  type BubbleRecord,
  type RegionGeometry,
  type RegionRecord,
  type SeriesGenerateConfig,
  type ToonRecord,
} from "../types";
import { mergeReplacedPage } from "../pageFile";
import { coverImageRect, moveRegionInStack, regionBoundingBox, regionPoints, regionsInStackOrder } from "../regionFit";
import LangSwitcher from "../../bookReader/LangSwitcher.vue";
import { bubbleWritePayload, bubblesInPlayOrder, CAPTION_LANGS, moveBubbleInPlayOrder } from "../mapConfig";
import { pushToast } from "../toast";
import CaptionInspector from "./CaptionInspector.vue";
import ConfirmDialog from "./ConfirmDialog.vue";
import EditorBar from "./EditorBar.vue";
import GeneratePageDialog from "./GeneratePageDialog.vue";
import type { LayoutTool } from "./GeometryLayer.vue";
import type { StudioMode } from "./LayoutToolbar.vue";
import LayoutInspector from "./LayoutInspector.vue";
import PageFilmstrip from "./PageFilmstrip.vue";
import PlateCanvas from "./PlateCanvas.vue";
import RegionAssignDialog from "./RegionAssignDialog.vue";

const switchLangs = CAPTION_LANGS.map((l) => ({ code: l.code, label: l.code.toUpperCase() }));

const route = useRoute();
const router = useRouter();

const toon = ref<ToonRecord | null>(null);
const selectedId = ref<string | null>(null);
const previewLang = ref<LangCode>("en");
const loading = ref(true);
const saving = ref(false);
const replacingId = ref<string | null>(null);
const dirtyIds = ref(new Set<string>());
const seriesGenerate = ref<SeriesGenerateConfig | null>(null);
const generateOpen = ref(false);
const generateBusy = ref(false);
const generateStatus = ref("");
const generateError = ref("");
const confirmingRemove = ref(false);
const layoutTool = ref<LayoutTool>("select");
const studioMode = ref<StudioMode>("layout");
const assignRegionId = ref<string | null>(null);
const generateTargetRegionId = ref<string | null>(null);
const confirmingRegionRemove = ref(false);
const flattenDirty = ref(false);
const flattening = ref(false);

const toonId = computed(() => String(route.params.id || ""));
const pageId = computed(() => (route.params.pageId ? String(route.params.pageId) : null));

const activePage = computed(() => {
  if (!toon.value) return null;
  if (pageId.value) return toon.value.pages.find((p) => p.id === pageId.value) || null;
  return toon.value.pages[0] || null;
});

const selectedBubble = computed(() => {
  if (!activePage.value || !selectedId.value) return null;
  return activePage.value.bubbles.find((b) => b.id === selectedId.value) || null;
});

const selectedRegion = computed(() => {
  if (!activePage.value || !selectedId.value) return null;
  return activePage.value.regions.find((r) => r.id === selectedId.value) || null;
});

const playOrder = computed(() => {
  const page = activePage.value;
  if (!page) return { index: 0, count: 0 };
  const ordered = bubblesInPlayOrder(page.bubbles);
  const index = selectedId.value ? ordered.findIndex((b) => b.id === selectedId.value) : -1;
  return { index: Math.max(0, index), count: ordered.length };
});

const dirtyCount = computed(() => dirtyIds.value.size);

const showBubbleLayer = computed(() => activePage.value?.kind !== "layout" || studioMode.value === "bubbles");

const regionStackOrder = computed(() => {
  const page = activePage.value;
  if (!page) return { index: 0, count: 0 };
  const ordered = regionsInStackOrder(page.regions);
  const index = selectedId.value ? ordered.findIndex((r) => r.id === selectedId.value) : -1;
  return { index: Math.max(0, index), count: ordered.length };
});

const canGenerate = computed(() => {
  const generate = seriesGenerate.value;
  if (!generate?.flowKey) return false;
  return generate.slots
    .filter((slot) => slot.kind === "sheet" && !slot.optional)
    .every((slot) => Boolean(slot.fileKey));
});

function markDirty(id: string): void {
  const next = new Set(dirtyIds.value);
  next.add(id);
  dirtyIds.value = next;
}

function clearDirty(id: string): void {
  if (!dirtyIds.value.has(id)) return;
  const next = new Set(dirtyIds.value);
  next.delete(id);
  dirtyIds.value = next;
}

async function load(): Promise<void> {
  loading.value = true;
  try {
    const next = await getToon(toonId.value);
    toon.value = next;
    dirtyIds.value = new Set();
    seriesGenerate.value = null;
    if (next.seriesKey) {
      try {
        const body = await getSeries(next.seriesKey);
        seriesGenerate.value = body.series.generate || null;
      } catch {
        seriesGenerate.value = null;
      }
    }
    if (!pageId.value && next.pages[0]) {
      await router.replace(`/${next.id}/pages/${next.pages[0].id}`);
    }
  } catch (err) {
    pushToast(err instanceof Error ? err.message : "Failed to load");
  } finally {
    loading.value = false;
  }
}

onMounted(load);
watch(toonId, load);

type GeneratePayload = {
  prompt: string;
  includePrevious: boolean;
  previousPageId: string | null;
  previousFile: File | null;
  excludeAliases: string[];
};

function closeGenerateDialog(): void {
  if (generateBusy.value) return;
  generateOpen.value = false;
  generateTargetRegionId.value = null;
}

async function onRegionGenerateSubmit(regionId: string, payload: GeneratePayload): Promise<void> {
  generateBusy.value = true;
  generateError.value = "";
  const started = Date.now();
  const clock = (): string => {
    const s = Math.floor((Date.now() - started) / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };
  const setStatus = (label: string): void => {
    generateStatus.value = `${label} · ${clock()}`;
  };
  setStatus("Queuing on Comfy…");
  const tick = window.setInterval(() => {
    const current = generateStatus.value.replace(/ · \d+:\d+$/, "");
    setStatus(current || "Generating the image…");
  }, 1000);
  try {
    const queued = await generateRegionImage(regionId, payload);
    setStatus("Waiting in the Comfy queue…");
    const deadline = Date.now() + 10 * 60 * 1000;
    while (Date.now() < deadline) {
      const snap = await getJob(queued.id);
      if (snap.status === "done" && snap.toon) {
        toon.value = snap.toon;
        generateOpen.value = false;
        generateTargetRegionId.value = null;
        markFlattenDirty();
        return;
      }
      if (snap.status === "error") {
        generateError.value = snap.error || "Generate failed";
        return;
      }
      setStatus(snap.message || "Generating the image…");
      await new Promise((resolve) => window.setTimeout(resolve, 1500));
    }
    generateError.value = "Timed out waiting for ComfyUI";
  } catch (err) {
    generateError.value = err instanceof Error ? err.message : "Generate failed";
  } finally {
    window.clearInterval(tick);
    generateBusy.value = false;
  }
}

async function onGenerateSubmit(payload: GeneratePayload): Promise<void> {
  if (generateTargetRegionId.value) {
    await onRegionGenerateSubmit(generateTargetRegionId.value, payload);
    return;
  }
  if (!toon.value) return;
  generateBusy.value = true;
  generateError.value = "";
  const started = Date.now();
  const clock = (): string => {
    const s = Math.floor((Date.now() - started) / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };
  const setStatus = (label: string): void => {
    generateStatus.value = `${label} · ${clock()}`;
  };
  setStatus("Queuing on Comfy…");
  const tick = window.setInterval(() => {
    const current = generateStatus.value.replace(/ · \d+:\d+$/, "");
    setStatus(current || "Generating the plate…");
  }, 1000);
  try {
    const queued = await generatePage(toon.value.id, { ...payload, pageId: null });
    setStatus("Waiting in the Comfy queue…");
    const deadline = Date.now() + 10 * 60 * 1000;
    while (Date.now() < deadline) {
      const snap = await getJob(queued.id);
      if (snap.status === "done" && snap.toon) {
        toon.value = snap.toon;
        generateOpen.value = false;
        const last = snap.toon.pages[snap.toon.pages.length - 1];
        if (last) await router.push(`/${snap.toon.id}/pages/${last.id}`);
        return;
      }
      if (snap.status === "error") {
        generateError.value = snap.error || "Generate failed";
        return;
      }
      setStatus(snap.message || "Generating the plate…");
      await new Promise((resolve) => window.setTimeout(resolve, 1500));
    }
    generateError.value = "Timed out waiting for ComfyUI";
  } catch (err) {
    generateError.value = err instanceof Error ? err.message : "Generate failed";
  } finally {
    window.clearInterval(tick);
    generateBusy.value = false;
  }
}

async function onUpload(file: File): Promise<void> {
  if (!toon.value) return;
  try {
    const size = await readImageSize(file);
    const next = await uploadPage(toon.value.id, file, size);
    toon.value = next;
    dirtyIds.value = new Set();
    const last = next.pages[next.pages.length - 1];
    if (last) await router.push(`/${next.id}/pages/${last.id}`);
  } catch (err) {
    pushToast(err instanceof Error ? err.message : "Upload failed");
  }
}

async function onRemovePage(id: string): Promise<void> {
  if (!toon.value) return;
  const pages = toon.value.pages;
  const index = pages.findIndex((p) => p.id === id);
  if (index < 0) return;
  const wasActive = activePage.value?.id === id;
  try {
    await deletePage(id);
    const next = pages
      .filter((p) => p.id !== id)
      .map((p) => (p.position > index ? { ...p, position: p.position - 1 } : p));
    toon.value = { ...toon.value, pages: next };
    if (selectedId.value && !next.some((p) => p.bubbles.some((b) => b.id === selectedId.value))) {
      selectedId.value = null;
    }
    if (wasActive) {
      const fallback = next[Math.min(index, next.length - 1)];
      await router.replace(fallback ? `/${toon.value.id}/pages/${fallback.id}` : `/${toon.value.id}/pages`);
    }
  } catch (err) {
    pushToast(err instanceof Error ? err.message : "Delete page failed");
  }
}

async function onReplaceThumb(pageId: string, file: File): Promise<void> {
  replacingId.value = pageId;
  try {
    const size = await readImageSize(file);
    const next = await replacePage(pageId, file, size);
    toon.value = toon.value ? mergeReplacedPage(toon.value, next, pageId) : next;
  } catch (err) {
    pushToast(err instanceof Error ? err.message : "Replace failed");
  } finally {
    replacingId.value = null;
  }
}

/** Blank transparent canvas, uploaded through the existing page-upload endpoint, then flipped to "layout" — the only code path that ever sets a page's kind. */
async function onAddLayoutPage(): Promise<void> {
  if (!toon.value) return;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = toon.value.designWidth;
    canvas.height = toon.value.designHeight;
    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("Could not create a blank page");
    const file = new File([blob], "layout.png", { type: "image/png" });
    const created = await uploadPage(toon.value.id, file, { width: canvas.width, height: canvas.height });
    const last = created.pages[created.pages.length - 1];
    if (!last) throw new Error("Could not create page");
    toon.value = await setPageKind(last.id, "layout");
    dirtyIds.value = new Set();
    layoutTool.value = "select";
    selectedId.value = null;
    await router.push(`/${toon.value.id}/pages/${last.id}`);
  } catch (err) {
    pushToast(err instanceof Error ? err.message : "Could not create layout page");
  }
}

function findBubble(id: string): BubbleRecord | null {
  if (!toon.value) return null;
  for (const page of toon.value.pages) {
    const found = page.bubbles.find((b) => b.id === id);
    if (found) return found;
  }
  return null;
}

function applyLocal(id: string, patch: Partial<BubbleRecord>): void {
  if (!toon.value) return;
  for (const page of toon.value.pages) {
    const i = page.bubbles.findIndex((b) => b.id === id);
    if (i < 0) continue;
    page.bubbles[i] = { ...page.bubbles[i], ...patch };
    return;
  }
}

function onInspectChange(patch: Partial<BubbleRecord>): void {
  if (!selectedId.value) return;
  applyLocal(selectedId.value, patch);
  markDirty(selectedId.value);
}

function onMove(id: string, x: number, y: number): void {
  applyLocal(id, { x, y });
  markDirty(id);
}

function onPersist(id: string, x: number, y: number): void {
  applyLocal(id, { x, y });
  markDirty(id);
}

function onTail(id: string, tail: string): void {
  applyLocal(id, { tail });
  markDirty(id);
}

function onReorder(direction: "earlier" | "later"): void {
  const page = activePage.value;
  const id = selectedId.value;
  if (!page || !id) return;
  const next = moveBubbleInPlayOrder(page.bubbles, id, direction);
  if (!next) return;
  const prevSort = new Map(page.bubbles.map((b) => [b.id, b.sort]));
  page.bubbles = next;
  for (const bubble of next) {
    if (prevSort.get(bubble.id) !== bubble.sort) markDirty(bubble.id);
  }
}

async function saveDirty(): Promise<void> {
  const ids = [...dirtyIds.value];
  if (!ids.length) return;
  saving.value = true;
  try {
    for (const id of ids) {
      const bubble = findBubble(id);
      if (!bubble) {
        clearDirty(id);
        continue;
      }
      const saved = await patchBubble(id, bubbleWritePayload(bubble));
      applyLocal(id, saved);
      clearDirty(id);
    }
  } catch (err) {
    pushToast(err instanceof Error ? err.message : "Save failed");
  } finally {
    saving.value = false;
  }
}

async function onAdd(pos: { x: number; y: number }): Promise<void> {
  const page = activePage.value;
  if (!page) return;
  try {
    const created = await addBubble(page.id, { x: pos.x, y: pos.y, textEn: "text", size: 30 });
    page.bubbles.push(created);
    selectedId.value = created.id;
  } catch (err) {
    pushToast(err instanceof Error ? err.message : "Could not add bubble");
  }
}

function applyRegionLocal(id: string, patch: Partial<RegionRecord>): void {
  if (!toon.value) return;
  for (const page of toon.value.pages) {
    const i = page.regions.findIndex((r) => r.id === id);
    if (i < 0) continue;
    page.regions[i] = { ...page.regions[i], ...patch };
    return;
  }
}

function loadImageEl(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load a region image"));
    img.src = src;
  });
}

/**
 * Composites every filled region onto one plate at design resolution, then
 * swaps it in through the existing replace-page endpoint — the reader only
 * ever sees this flattened image, never the regions. Only runs from the
 * explicit Save button in the top bar: auto-flattening after every persisted
 * edit re-triggers the Worker's image pipeline (and its CPU budget) far more
 * than the user asked for, and reads as the page "won't stop saving" during
 * a drag session. A completed edit leaves a stale/"ghost" picture in the
 * flattened plate until Save is clicked — an accepted tradeoff.
 */
async function flattenNow(): Promise<void> {
  const page = activePage.value;
  if (!page || page.kind !== "layout" || !toon.value) return;
  flattening.value = true;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = toon.value.designWidth;
    canvas.height = toon.value.designHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not supported");
    // Browsers default drawImage resampling to "low" — soft/blocky on any
    // region whose image isn't drawn at its exact native size. This is the
    // only place that scales a region's source image, so it's the one place
    // that needs to ask for it explicitly.
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    if (page.bgColor) {
      ctx.fillStyle = page.bgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    const ordered = [...page.regions].sort((a, b) => a.sort - b.sort);
    const fillable = ordered.filter((r) => r.fileUrl && r.fileWidth && r.fileHeight);
    // Load every region's image in parallel first — the draw loop below then
    // runs with zero awaits between region 1's fetch finishing and region N's
    // starting, instead of one network round-trip at a time in series (the
    // real cost on a many-region page: N regions used to mean N round-trips
    // back to back rather than the slowest single one).
    const images = await Promise.all(fillable.map((r) => loadImageEl(r.fileUrl as string)));
    const imageByRegionId = new Map(fillable.map((r, i) => [r.id, images[i]]));
    for (const region of ordered) {
      const img = imageByRegionId.get(region.id);
      if (!img || !region.fileWidth || !region.fileHeight) continue;
      const bbox = regionBoundingBox(region.geometry);
      const boxLeft = bbox.x * canvas.width;
      const boxTop = bbox.y * canvas.height;
      const boxWidth = bbox.w * canvas.width;
      const boxHeight = bbox.h * canvas.height;
      const rect = coverImageRect(
        { width: boxWidth, height: boxHeight },
        { width: region.fileWidth, height: region.fileHeight },
        region.imageScale,
        region.imageOffsetX,
        region.imageOffsetY
      );
      ctx.save();
      ctx.beginPath();
      const pts = regionPoints(region.geometry);
      pts.forEach((p, i) => {
        const x = p.x * canvas.width;
        const y = p.y * canvas.height;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(img, boxLeft + rect.x, boxTop + rect.y, rect.width, rect.height);
      if (region.borderWidth > 0) {
        // Double the line width and stroke the same clipped path: the outward
        // half gets cut off by the clip, so only the inward half survives —
        // the canvas equivalent of the editor/reader's inset border technique.
        ctx.lineWidth = region.borderWidth * 2;
        ctx.strokeStyle = region.borderColor || "#ffffff";
        ctx.lineCap = region.borderStyle === "dotted" ? "round" : "butt";
        ctx.setLineDash(
          region.borderStyle === "dashed"
            ? [region.borderWidth * 3, region.borderWidth * 2]
            : region.borderStyle === "dotted"
              ? [0.01, region.borderWidth * 2]
              : []
        );
        ctx.stroke();
      }
      ctx.restore();
    }
    // Export WebP directly: the Worker's own upload pipeline re-encodes
    // anything that isn't already WebP (toWebp() in imageOptimize.ts), so a
    // PNG upload here meant a second full decode+encode pass server-side on
    // top of this one. Falls back to PNG only if the browser doesn't support
    // canvas WebP export at all (canvas.toBlob silently returns PNG bytes
    // when the requested type is unsupported) — the server still handles
    // that correctly, just without the skip.
    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.92));
    if (!blob) throw new Error("Could not render the layout");
    const isWebp = blob.type === "image/webp";
    const file = new File([blob], isWebp ? "layout.webp" : "layout.png", { type: blob.type || "image/png" });
    const next = await replacePage(page.id, file, { width: canvas.width, height: canvas.height });
    toon.value = toon.value ? mergeReplacedPage(toon.value, next, page.id) : next;
    flattenDirty.value = false;
  } catch (err) {
    pushToast(err instanceof Error ? err.message : "Could not update the flattened plate");
    flattenDirty.value = true;
  } finally {
    flattening.value = false;
  }
}

/** Layout edits (drag, zoom, assign, delete) never auto-flatten — each re-encode costs real Worker CPU, so only the explicit Save button in the top bar calls flattenNow. */
function markFlattenDirty(): void {
  flattenDirty.value = true;
}

async function onCreateRegion(geometry: RegionGeometry): Promise<void> {
  const page = activePage.value;
  if (!page) return;
  try {
    const created = await addRegion(page.id, { shapeType: geometry.kind, geometry });
    page.regions.push(created);
    selectedId.value = created.id;
    layoutTool.value = "select";
    markFlattenDirty();
  } catch (err) {
    pushToast(err instanceof Error ? err.message : "Could not add shape");
  }
}

function onUpdateRegionGeometry(id: string, geometry: RegionGeometry): void {
  applyRegionLocal(id, { geometry });
}

async function onPersistRegionGeometry(id: string, geometry: RegionGeometry): Promise<void> {
  applyRegionLocal(id, { geometry });
  try {
    const saved = await patchRegion(id, { geometry });
    applyRegionLocal(id, saved);
    markFlattenDirty();
  } catch (err) {
    pushToast(err instanceof Error ? err.message : "Could not update shape");
  }
}

function onMoveRegionImage(id: string, offsetX: number, offsetY: number): void {
  applyRegionLocal(id, { imageOffsetX: offsetX, imageOffsetY: offsetY });
}

async function onPersistRegionImage(id: string, offsetX: number, offsetY: number): Promise<void> {
  applyRegionLocal(id, { imageOffsetX: offsetX, imageOffsetY: offsetY });
  try {
    const saved = await patchRegion(id, { imageOffsetX: offsetX, imageOffsetY: offsetY });
    applyRegionLocal(id, saved);
    markFlattenDirty();
  } catch (err) {
    pushToast(err instanceof Error ? err.message : "Could not move image");
  }
}

function onRegionScalePreview(value: number): void {
  if (selectedId.value) applyRegionLocal(selectedId.value, { imageScale: value });
}

async function onRegionScalePersist(value: number): Promise<void> {
  const id = selectedId.value;
  if (!id) return;
  try {
    const saved = await patchRegion(id, { imageScale: value });
    applyRegionLocal(id, saved);
    markFlattenDirty();
  } catch (err) {
    pushToast(err instanceof Error ? err.message : "Could not update zoom");
  }
}

type BorderPatch = Partial<Pick<RegionRecord, "borderColor" | "borderWidth" | "borderStyle">>;

function onRegionBorderPreview(patch: BorderPatch): void {
  if (selectedId.value) applyRegionLocal(selectedId.value, patch);
}

async function onRegionBorderPersist(patch: BorderPatch): Promise<void> {
  const id = selectedId.value;
  if (!id) return;
  applyRegionLocal(id, patch);
  try {
    const saved = await patchRegion(id, patch);
    applyRegionLocal(id, saved);
    markFlattenDirty();
  } catch (err) {
    pushToast(err instanceof Error ? err.message : "Could not update border");
  }
}

function onPageBgColorPreview(value: string | null): void {
  if (activePage.value) activePage.value.bgColor = value;
}

async function onPageBgColorPersist(value: string | null): Promise<void> {
  const page = activePage.value;
  if (!page) return;
  page.bgColor = value;
  try {
    toon.value = await patchPageBgColor(page.id, value);
    markFlattenDirty();
  } catch (err) {
    pushToast(err instanceof Error ? err.message : "Could not update background color");
  }
}

function onRequestRegionAssign(id: string): void {
  assignRegionId.value = id;
}

function onLayoutInspectorReassign(): void {
  if (selectedId.value) assignRegionId.value = selectedId.value;
}

async function onAssignUpload(file: File): Promise<void> {
  const id = assignRegionId.value;
  assignRegionId.value = null;
  if (!id) return;
  try {
    const size = await readImageSize(file);
    const saved = await uploadRegionImage(id, file, size);
    applyRegionLocal(id, saved);
    markFlattenDirty();
  } catch (err) {
    pushToast(err instanceof Error ? err.message : "Upload failed");
  }
}

function onAssignGenerate(): void {
  const id = assignRegionId.value;
  assignRegionId.value = null;
  if (!id) return;
  generateTargetRegionId.value = id;
  generateOpen.value = true;
}

function requestRegionRemove(): void {
  if (!selectedId.value || confirmingRegionRemove.value) return;
  confirmingRegionRemove.value = true;
}

async function onRegionReorder(direction: "forward" | "backward"): Promise<void> {
  const page = activePage.value;
  const id = selectedId.value;
  if (!page || !id) return;
  const next = moveRegionInStack(page.regions, id, direction);
  if (!next) return;
  const prevSort = new Map(page.regions.map((r) => [r.id, r.sort]));
  page.regions = next;
  const changed = next.filter((r) => prevSort.get(r.id) !== r.sort);
  try {
    for (const region of changed) {
      const saved = await patchRegion(region.id, { sort: region.sort });
      applyRegionLocal(region.id, saved);
    }
    markFlattenDirty();
  } catch (err) {
    pushToast(err instanceof Error ? err.message : "Could not reorder");
  }
}

async function onRegionRemove(): Promise<void> {
  const id = selectedId.value;
  confirmingRegionRemove.value = false;
  if (!id || !activePage.value) return;
  try {
    await deleteRegion(id);
    activePage.value.regions = activePage.value.regions.filter((r) => r.id !== id);
    selectedId.value = null;
    markFlattenDirty();
  } catch (err) {
    pushToast(err instanceof Error ? err.message : "Delete failed");
  }
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable || Boolean(target.closest("[contenteditable='true']"));
}

function requestRemove(): void {
  if (!selectedId.value || confirmingRemove.value) return;
  confirmingRemove.value = true;
}

function onRemoveKey(ev: KeyboardEvent): void {
  if (ev.key !== "Delete" && ev.key !== "Backspace") return;
  if (ev.defaultPrevented || ev.repeat) return;
  if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
  if (!selectedId.value || confirmingRemove.value || confirmingRegionRemove.value || generateOpen.value) return;
  if (isTypingTarget(ev.target)) return;
  ev.preventDefault();
  if (showBubbleLayer.value) requestRemove();
  else requestRegionRemove();
}

onMounted(() => window.addEventListener("keydown", onRemoveKey));
onBeforeUnmount(() => {
  window.removeEventListener("keydown", onRemoveKey);
  if (flattenDirty.value) pushToast("Layout changes on that page were not saved");
});

watch(pageId, (_next, prev) => {
  studioMode.value = "layout";
  if (prev && flattenDirty.value) pushToast("Layout changes on the previous page were not saved");
  flattenDirty.value = false;
});

function onUpdateStudioMode(mode: StudioMode): void {
  studioMode.value = mode;
  selectedId.value = null;
}

async function onRemove(): Promise<void> {
  if (!selectedId.value || !activePage.value) return;
  const id = selectedId.value;
  confirmingRemove.value = false;
  try {
    await deleteBubble(id);
    activePage.value.bubbles = activePage.value.bubbles.filter((b) => b.id !== id);
    clearDirty(id);
    selectedId.value = null;
  } catch (err) {
    pushToast(err instanceof Error ? err.message : "Delete failed");
  }
}
</script>

<template>
  <div class="editor-studio">
    <EditorBar
      :title="toon?.title || 'Pages'"
      :badge="toon ? visibilityLabel(toon.status) : ''"
      :visibility="toon ? visibilityFromStatus(toon.status) : ''"
    >
      <template #actions>
        <RouterLink class="editor-btn editor-btn--ghost" :to="`/${toonId}`">
          <Settings2 :size="16" :stroke-width="1.4" aria-hidden="true" />
          Meta
        </RouterLink>
        <LangSwitcher :languages="switchLangs" v-model="previewLang" />
      </template>
      <template #primary>
        <button
          v-if="!showBubbleLayer"
          class="editor-btn"
          type="button"
          name="save-layout"
          :disabled="!flattenDirty || flattening"
          @click="flattenNow()"
        >
          <Save :size="16" :stroke-width="1.4" aria-hidden="true" />
          {{ flattening ? "Saving…" : flattenDirty ? "Save layout" : "Layout saved" }}
        </button>
        <button
          v-else
          class="editor-btn"
          type="button"
          name="save-bubbles"
          :disabled="!dirtyCount || saving"
          @click="saveDirty"
        >
          <Save :size="16" :stroke-width="1.4" aria-hidden="true" />
          {{ saving ? "Saving…" : dirtyCount ? `Save (${dirtyCount})` : "Save" }}
        </button>
      </template>
    </EditorBar>
    <p v-if="loading">Loading…</p>
    <template v-else-if="toon">
      <div class="editor-studio-body">
        <PageFilmstrip
          :toon-id="toon.id"
          :pages="toon.pages"
          :active-id="activePage?.id ?? null"
          :can-generate="canGenerate"
          :replacing-id="replacingId"
          @upload="onUpload"
          @generate="generateOpen = true"
          @layout="onAddLayoutPage"
          @remove="onRemovePage"
          @replace="onReplaceThumb"
        />
        <PlateCanvas
          v-if="activePage"
          :key="activePage.fileKey"
          :src="activePage.fileUrl"
          :page-num="activePage.position + 1"
          :bubbles="activePage.bubbles"
          :selected-id="selectedId"
          :lang="previewLang"
          :design-width="toon.designWidth"
          :design-height="toon.designHeight"
          :kind="activePage.kind"
          :regions="activePage.regions"
          :layout-tool="layoutTool"
          :studio-mode="studioMode"
          :bg-color="activePage.bgColor"
          @select="selectedId = $event"
          @move="onMove"
          @persist="onPersist"
          @add="onAdd"
          @tail="onTail"
          @update-layout-tool="layoutTool = $event"
          @update-studio-mode="onUpdateStudioMode"
          @create-region="onCreateRegion"
          @update-region-geometry="onUpdateRegionGeometry"
          @persist-region-geometry="onPersistRegionGeometry"
          @move-region-image="onMoveRegionImage"
          @persist-region-image="onPersistRegionImage"
          @request-region-assign="onRequestRegionAssign"
        />
        <div v-else class="editor-canvas editor-canvas--empty">
          <p class="editor-muted">Upload a page to start placing bubbles.</p>
          <label class="editor-btn">
            Upload page
            <input
              type="file"
              accept="image/webp,image/jpeg,image/png"
              hidden
              @change="
                ($event.target as HTMLInputElement).files?.[0] &&
                  onUpload(($event.target as HTMLInputElement).files![0])
              "
            />
          </label>
        </div>
        <CaptionInspector
          v-if="showBubbleLayer"
          :bubble="selectedBubble"
          :toon-id="toon.id"
          :asset-page-dir="toon.assetPageDir"
          :play-index="playOrder.index"
          :play-count="playOrder.count"
          @change="onInspectChange"
          @preview="previewLang = $event"
          @remove="requestRemove"
          @reorder="onReorder"
        />
        <LayoutInspector
          v-else
          :region="selectedRegion"
          :layer-index="regionStackOrder.index"
          :layer-count="regionStackOrder.count"
          :page-bg-color="activePage?.bgColor ?? null"
          @reassign="onLayoutInspectorReassign"
          @scale="onRegionScalePreview"
          @persist-scale="onRegionScalePersist"
          @border="onRegionBorderPreview"
          @persist-border="onRegionBorderPersist"
          @reorder="onRegionReorder"
          @remove="requestRegionRemove"
          @page-bg-color="onPageBgColorPreview"
          @persist-page-bg-color="onPageBgColorPersist"
        />
      </div>
      <ConfirmDialog
        :open="confirmingRemove"
        title="Delete bubble"
        message="Delete this bubble?"
        confirm-label="OK"
        focus-confirm
        @confirm="onRemove"
        @cancel="confirmingRemove = false"
      />
      <ConfirmDialog
        :open="confirmingRegionRemove"
        title="Delete shape"
        message="Delete this shape and its image?"
        confirm-label="OK"
        focus-confirm
        @confirm="onRegionRemove"
        @cancel="confirmingRegionRemove = false"
      />
      <GeneratePageDialog
        :open="generateOpen"
        :generate="seriesGenerate"
        :pages="toon.pages"
        :busy="generateBusy"
        :status="generateStatus"
        :error="generateError"
        @close="closeGenerateDialog"
        @submit="onGenerateSubmit"
      />
      <RegionAssignDialog
        :open="Boolean(assignRegionId)"
        :can-generate="canGenerate"
        @close="assignRegionId = null"
        @upload="onAssignUpload"
        @generate="onAssignGenerate"
      />
    </template>
  </div>
</template>
