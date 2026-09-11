<script setup lang="ts">
/**
 * Layout-mode shape overlay for the studio plate — draws rects/polygons,
 * resizes/reshapes them, and pans an assigned image inside its mask.
 * Same overlay skeleton as EditorCaptionLayer.vue (pointer capture on the
 * layer root, window-bound move/up, hit-test via closest('[data-*]')), but
 * with three hit-test tiers instead of one: resize/vertex handles, a
 * shape's interior, then empty canvas (only while a draw tool is armed).
 */
import { computed, onBeforeUnmount, onMounted, ref, watch, type CSSProperties } from "vue";
import { imageContentBox } from "../../bookReader/captions/captionModel";
import { clientToPlateFraction, type ContentBox } from "../plateCoords";
import {
  clipPathPolygon,
  coverImageRect,
  DEFAULT_GRID_SIZE,
  offsetFromDrag,
  percentPoints,
  regionBoundingBox,
  snapPointToGrid,
  type Point,
} from "../regionFit";
import type { RegionGeometry, RegionRecord } from "../types";
import RegionShape from "./RegionShape.vue";

export type LayoutTool = "select" | "rect" | "polygon";

const MIN_DRAW_SIZE = 0.03;
const RECT_CORNERS = ["nw", "ne", "se", "sw"] as const;

const props = withDefaults(
  defineProps<{
    regions: RegionRecord[];
    selectedId?: string | null;
    designWidth?: number;
    designHeight?: number;
    imageEl?: HTMLImageElement | null;
    tool?: LayoutTool;
    /** Snap draw/resize/reshape to a grid — draw-start included, panning an image inside its mask never snaps. */
    grid?: boolean;
    /**
     * False in Bubbles mode: still paints every region's real image (Bubbles
     * mode has no other way to show them — the flattened plate is now a
     * capped-resolution thumbnail, not real content, see flattenNow()'s doc
     * comment), but takes no pointer input and never draws handles, so
     * captions underneath keep working exactly as before.
     */
    interactive?: boolean;
  }>(),
  {
    selectedId: null,
    designWidth: 800,
    designHeight: 1424,
    imageEl: null,
    tool: "select",
    grid: false,
    interactive: true,
  }
);

function snapped(point: Point): Point {
  return props.grid ? snapPointToGrid(point) : point;
}

const emit = defineEmits<{
  select: [id: string];
  create: [geometry: RegionGeometry];
  "update-geometry": [id: string, geometry: RegionGeometry];
  "persist-geometry": [id: string, geometry: RegionGeometry];
  "move-image": [id: string, offsetX: number, offsetY: number];
  "persist-image": [id: string, offsetX: number, offsetY: number];
  "request-assign": [id: string];
}>();

const rootEl = ref<HTMLElement | null>(null);
const box = ref<ContentBox | null>(null);

const draftRect = ref<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
const draftPoints = ref<Point[]>([]);
const draftCursor = ref<Point | null>(null);

interface RegionLayout {
  region: RegionRecord;
  frameStyle: CSSProperties;
  clipPath: string;
  imgStyle: CSSProperties | null;
  handles: { key: string; attr: "data-region-handle" | "data-region-vertex"; value: string; x: number; y: number }[];
  /** The frame's own pixel size — lets RegionShape draw its polygon border in real pixel coordinates (an SVG viewBox non-uniformly scaled to a skewed parallelogram is a known cross-browser risk with non-scaling-stroke; the pre-existing draft-polygon overlay below avoids it the same way). */
  frameWidth: number;
  frameHeight: number;
  /** design-px -> on-screen-px ratio (the studio canvas can render the plate smaller/larger than its native resolution) — RegionShape scales borderWidth (stored in design px) by this so it matches the reader's own scaling instead of always drawing the same real screen-pixel thickness. */
  scale: number;
}

const regionLayouts = computed<RegionLayout[]>(() => {
  if (!box.value) return [];
  const b = box.value;
  const scale = props.imageEl?.naturalWidth ? b.width / props.imageEl.naturalWidth : 1;
  // Non-interactive (Bubbles mode): an unfilled region has nothing to show
  // and no "click to add image" affordance to offer, so skip it entirely.
  const visible = props.interactive ? props.regions : props.regions.filter((r) => r.fileUrl);
  return visible.map((region) => {
    const bbox = regionBoundingBox(region.geometry);
    const left = bbox.x * b.width;
    const top = bbox.y * b.height;
    const width = bbox.w * b.width;
    const height = bbox.h * b.height;
    let imgStyle: CSSProperties | null = null;
    if (region.fileUrl && region.fileWidth && region.fileHeight) {
      const rect = coverImageRect(
        { width, height },
        { width: region.fileWidth, height: region.fileHeight },
        region.imageScale,
        region.imageOffsetX,
        region.imageOffsetY
      );
      imgStyle = {
        position: "absolute",
        left: `${rect.x}px`,
        top: `${rect.y}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
      };
    }
    const isRect = region.geometry.kind === "rect";
    const handles = percentPoints(region.geometry, bbox).map((p, i) => ({
      key: `${region.id}-${i}`,
      attr: (isRect ? "data-region-handle" : "data-region-vertex") as "data-region-handle" | "data-region-vertex",
      value: isRect ? RECT_CORNERS[i] : String(i),
      x: p.x,
      y: p.y,
    }));
    return {
      region,
      frameStyle: {
        position: "absolute",
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
        height: `${height}px`,
      },
      clipPath: clipPathPolygon(region.geometry, bbox),
      imgStyle,
      handles,
      frameWidth: width,
      frameHeight: height,
      scale,
    };
  });
});

const draftRectStyle = computed<CSSProperties | null>(() => {
  if (!draftRect.value || !box.value) return null;
  const { x0, y0, x1, y1 } = draftRect.value;
  const b = box.value;
  const left = Math.min(x0, x1) * b.width;
  const top = Math.min(y0, y1) * b.height;
  const width = Math.abs(x1 - x0) * b.width;
  const height = Math.abs(y1 - y0) * b.height;
  return { position: "absolute", left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` };
});

const draftPolygonPoints = computed(() => {
  if (!draftPoints.value.length || !box.value) return "";
  const b = box.value;
  const pts = [...draftPoints.value];
  if (draftCursor.value) pts.push(draftCursor.value);
  return pts.map((p) => `${p.x * b.width},${p.y * b.height}`).join(" ");
});

const layerStyle = computed<CSSProperties>(() => ({
  position: "absolute",
  left: `${box.value?.left ?? 0}px`,
  top: `${box.value?.top ?? 0}px`,
  width: `${box.value?.width ?? 0}px`,
  height: `${box.value?.height ?? 0}px`,
  pointerEvents: props.interactive ? "auto" : "none",
  overflow: "visible",
  // Layout mode: this layer IS the thing being edited, above everything.
  // Bubbles mode: it's a non-interactive backdrop for captions, which use
  // this same 35 for their own layer — regions must sit below them (matches
  // the reader's RegionLayer.vue, z-index 20, same reasoning).
  zIndex: props.interactive ? 35 : 20,
  cursor: props.tool === "select" ? undefined : "crosshair",
}));

/** A faint reference grid at the same spacing draw/resize/reshape snaps to — purely visual, never intercepts pointer events. */
const gridStyle = computed<CSSProperties | null>(() => {
  if (!props.grid || !box.value) return null;
  const stepX = box.value.width * DEFAULT_GRID_SIZE;
  const stepY = box.value.height * DEFAULT_GRID_SIZE;
  return {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    backgroundImage:
      "linear-gradient(to right, rgba(255,255,255,0.16) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.16) 1px, transparent 1px)",
    backgroundSize: `${stepX}px ${stepY}px`,
  };
});

function measure(): void {
  const img = props.imageEl;
  if (!img || (!img.naturalWidth && !img.clientWidth)) {
    if (box.value) box.value = null;
    return;
  }
  const next = imageContentBox(img);
  const cur = box.value;
  const changed =
    !cur || cur.left !== next.left || cur.top !== next.top || cur.width !== next.width || cur.height !== next.height;
  if (changed) box.value = { left: next.left, top: next.top, width: next.width, height: next.height };
}

function overlayBox(): ContentBox | null {
  const el = rootEl.value;
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  if (!rect.width || !rect.height) return box.value;
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
}

function oppositeCorner(rect: { x: number; y: number; w: number; h: number }, corner: string): Point {
  if (corner === "nw") return { x: rect.x + rect.w, y: rect.y + rect.h };
  if (corner === "ne") return { x: rect.x, y: rect.y + rect.h };
  if (corner === "se") return { x: rect.x, y: rect.y };
  return { x: rect.x + rect.w, y: rect.y }; // sw
}

function resizeRectCorner(geometry: RegionGeometry, corner: string, point: Point): RegionGeometry {
  if (geometry.kind !== "rect") return geometry;
  const opp = oppositeCorner(geometry, corner);
  const x0 = Math.min(opp.x, point.x);
  const x1 = Math.max(opp.x, point.x);
  const y0 = Math.min(opp.y, point.y);
  const y1 = Math.max(opp.y, point.y);
  return { kind: "rect", x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

type DragState =
  | { mode: "draw-rect"; pointerId: number }
  | { mode: "resize"; regionId: string; corner: string; pointerId: number; geometry: RegionGeometry }
  | { mode: "vertex"; regionId: string; index: number; pointerId: number; geometry: RegionGeometry }
  | {
      mode: "pan";
      regionId: string;
      pointerId: number;
      startClientX: number;
      startClientY: number;
      startOffsetX: number;
      startOffsetY: number;
      offsetX: number;
      offsetY: number;
    };

let drag: DragState | null = null;

function capturePointer(pointerId: number): void {
  try {
    rootEl.value?.setPointerCapture?.(pointerId);
  } catch {
    /* happy-dom / already captured */
  }
  window.addEventListener("pointermove", onWindowMove);
  window.addEventListener("pointerup", onWindowUp);
  window.addEventListener("pointercancel", onWindowCancel);
}

function releasePointer(pointerId: number): void {
  window.removeEventListener("pointermove", onWindowMove);
  window.removeEventListener("pointerup", onWindowUp);
  window.removeEventListener("pointercancel", onWindowCancel);
  const layer = rootEl.value;
  if (layer && layer.hasPointerCapture?.(pointerId)) {
    try {
      layer.releasePointerCapture(pointerId);
    } catch {
      /* already released */
    }
  }
}

function onWindowMove(ev: PointerEvent): void {
  if (!drag || ev.pointerId !== drag.pointerId) return;
  const plate = overlayBox();
  if (!plate) return;
  if (drag.mode === "draw-rect") {
    const pos = snapped(clientToPlateFraction(ev.clientX, ev.clientY, plate));
    if (draftRect.value) draftRect.value = { ...draftRect.value, x1: pos.x, y1: pos.y };
    return;
  }
  if (drag.mode === "resize") {
    const pos = snapped(clientToPlateFraction(ev.clientX, ev.clientY, plate));
    const next = resizeRectCorner(drag.geometry, drag.corner, pos);
    drag.geometry = next;
    emit("update-geometry", drag.regionId, next);
    return;
  }
  if (drag.mode === "vertex") {
    const pos = snapped(clientToPlateFraction(ev.clientX, ev.clientY, plate));
    const geometry = drag.geometry;
    const vertexIndex = drag.index;
    if (geometry.kind !== "polygon") return;
    const points = geometry.points.map((p, i) => (i === vertexIndex ? pos : p));
    const next: RegionGeometry = { kind: "polygon", points };
    drag.geometry = next;
    emit("update-geometry", drag.regionId, next);
    return;
  }
  if (drag.mode === "pan") {
    const panRegionId = drag.regionId;
    const region = props.regions.find((r) => r.id === panRegionId);
    if (!region || !box.value) return;
    const bbox = regionBoundingBox(region.geometry);
    const bboxPx = { width: bbox.w * box.value.width, height: bbox.h * box.value.height };
    const deltaPx = { x: ev.clientX - drag.startClientX, y: ev.clientY - drag.startClientY };
    const next = offsetFromDrag(
      { offsetX: drag.startOffsetX, offsetY: drag.startOffsetY },
      deltaPx,
      bboxPx,
      { width: region.fileWidth || 1, height: region.fileHeight || 1 },
      region.imageScale
    );
    drag.offsetX = next.offsetX;
    drag.offsetY = next.offsetY;
    emit("move-image", drag.regionId, next.offsetX, next.offsetY);
  }
}

function endDrag(ev: PointerEvent, commit: boolean): void {
  if (!drag || ev.pointerId !== drag.pointerId) return;
  const done = drag;
  drag = null;
  releasePointer(ev.pointerId);
  if (!commit) return;
  if (done.mode === "draw-rect") {
    const rect = draftRect.value;
    draftRect.value = null;
    if (!rect) return;
    const x = Math.min(rect.x0, rect.x1);
    const y = Math.min(rect.y0, rect.y1);
    const w = Math.max(rect.x0, rect.x1) - x;
    const h = Math.max(rect.y0, rect.y1) - y;
    if (w < MIN_DRAW_SIZE || h < MIN_DRAW_SIZE) return;
    emit("create", { kind: "rect", x, y, w, h });
    return;
  }
  if (done.mode === "resize" || done.mode === "vertex") {
    emit("persist-geometry", done.regionId, done.geometry);
    return;
  }
  if (done.mode === "pan") {
    emit("persist-image", done.regionId, done.offsetX, done.offsetY);
  }
}

function onWindowUp(ev: PointerEvent): void {
  endDrag(ev, true);
}

function onWindowCancel(ev: PointerEvent): void {
  endDrag(ev, true);
}

function finishPolygon(): void {
  if (draftPoints.value.length < 3) return;
  emit("create", { kind: "polygon", points: draftPoints.value });
  draftPoints.value = [];
  draftCursor.value = null;
}

function cancelDraft(): void {
  draftRect.value = null;
  draftPoints.value = [];
  draftCursor.value = null;
}

function onPointerDown(ev: PointerEvent): void {
  if (ev.isPrimary === false) return;
  if (ev.pointerType === "mouse" && ev.button !== 0) return;
  const plate = overlayBox();
  if (!plate) return;

  if (props.tool === "rect") {
    ev.preventDefault();
    const pos = snapped(clientToPlateFraction(ev.clientX, ev.clientY, plate));
    draftRect.value = { x0: pos.x, y0: pos.y, x1: pos.x, y1: pos.y };
    drag = { mode: "draw-rect", pointerId: ev.pointerId };
    capturePointer(ev.pointerId);
    return;
  }

  if (props.tool === "polygon") {
    ev.preventDefault();
    const pos = snapped(clientToPlateFraction(ev.clientX, ev.clientY, plate));
    draftPoints.value = [...draftPoints.value, pos];
    return;
  }

  const target = ev.target as HTMLElement | null;
  const handleEl = target?.closest?.("[data-region-handle]") as HTMLElement | null;
  const vertexEl = !handleEl ? (target?.closest?.("[data-region-vertex]") as HTMLElement | null) : null;
  const regionEl = target?.closest?.("[data-region-id]") as HTMLElement | null;

  if (handleEl && regionEl) {
    const regionId = regionEl.getAttribute("data-region-id") || "";
    const region = props.regions.find((r) => r.id === regionId);
    if (!region || region.geometry.kind !== "rect") return;
    ev.preventDefault();
    emit("select", regionId);
    const corner = handleEl.getAttribute("data-region-handle") || "se";
    drag = { mode: "resize", regionId, corner, pointerId: ev.pointerId, geometry: region.geometry };
    capturePointer(ev.pointerId);
    return;
  }
  if (vertexEl && regionEl) {
    const regionId = regionEl.getAttribute("data-region-id") || "";
    const region = props.regions.find((r) => r.id === regionId);
    if (!region || region.geometry.kind !== "polygon") return;
    ev.preventDefault();
    emit("select", regionId);
    const index = Number(vertexEl.getAttribute("data-region-vertex") || 0);
    drag = { mode: "vertex", regionId, index, pointerId: ev.pointerId, geometry: region.geometry };
    capturePointer(ev.pointerId);
    return;
  }
  if (regionEl) {
    const regionId = regionEl.getAttribute("data-region-id") || "";
    const region = props.regions.find((r) => r.id === regionId);
    if (!region) return;
    emit("select", regionId);
    if (!region.fileUrl) {
      emit("request-assign", regionId);
      return;
    }
    ev.preventDefault();
    drag = {
      mode: "pan",
      regionId,
      pointerId: ev.pointerId,
      startClientX: ev.clientX,
      startClientY: ev.clientY,
      startOffsetX: region.imageOffsetX,
      startOffsetY: region.imageOffsetY,
      offsetX: region.imageOffsetX,
      offsetY: region.imageOffsetY,
    };
    capturePointer(ev.pointerId);
  }
}

function onPointerMoveHover(ev: PointerEvent): void {
  if (props.tool !== "polygon" || !draftPoints.value.length) return;
  const plate = overlayBox();
  if (!plate) return;
  draftCursor.value = snapped(clientToPlateFraction(ev.clientX, ev.clientY, plate));
}

function onDblClick(): void {
  if (props.tool === "polygon") finishPolygon();
}

function onKeydown(ev: KeyboardEvent): void {
  if (props.tool !== "polygon") return;
  if (ev.key === "Enter") {
    ev.preventDefault();
    finishPolygon();
  } else if (ev.key === "Escape") {
    ev.preventDefault();
    cancelDraft();
  }
}

watch(
  () => props.tool,
  () => cancelDraft()
);

let ro: ResizeObserver | null = null;

function bindImage(img: HTMLImageElement | null): void {
  ro?.disconnect();
  ro = null;
  if (!img) return;
  img.addEventListener("load", measure);
  if (typeof ResizeObserver !== "undefined") {
    ro = new ResizeObserver(() => measure());
    ro.observe(img);
  }
  measure();
}

onMounted(() => {
  bindImage(props.imageEl);
  window.addEventListener("keydown", onKeydown);
});

onBeforeUnmount(() => {
  props.imageEl?.removeEventListener("load", measure);
  ro?.disconnect();
  window.removeEventListener("keydown", onKeydown);
  if (drag) releasePointer(drag.pointerId);
});

watch(
  () => props.imageEl,
  (img, prev) => {
    prev?.removeEventListener("load", measure);
    bindImage(img);
  }
);
watch(
  () => [props.designWidth, props.designHeight],
  () => measure()
);
</script>

<template>
  <div
    ref="rootEl"
    class="editor-geometry-layer"
    :style="layerStyle"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMoveHover"
    @dblclick="onDblClick"
  >
    <div v-if="gridStyle" class="editor-region-grid" :style="gridStyle" />
    <div
      v-for="layout in regionLayouts"
      :key="layout.region.id"
      class="editor-region-frame"
      :class="{ 'is-selected': layout.region.id === selectedId }"
      :style="layout.frameStyle"
      :data-region-id="layout.region.id"
    >
      <RegionShape
        :region="layout.region"
        :clip-path="layout.clipPath"
        :img-style="layout.imgStyle"
        :frame-width="layout.frameWidth"
        :frame-height="layout.frameHeight"
        :scale="layout.scale"
      />
      <div v-if="interactive && layout.region.id === selectedId" class="editor-region-handles">
        <div
          v-for="h in layout.handles"
          :key="h.key"
          class="editor-region-handle"
          :[h.attr]="h.value"
          :style="{ left: `${h.x}%`, top: `${h.y}%` }"
        />
      </div>
    </div>
    <div v-if="draftRectStyle" class="editor-region-draft-rect" :style="draftRectStyle" />
    <svg v-if="draftPolygonPoints" class="editor-region-draft-polygon">
      <polygon :points="draftPolygonPoints" />
      <circle
        v-for="(p, i) in draftPoints"
        :key="i"
        :cx="p.x * (box?.width || 0)"
        :cy="p.y * (box?.height || 0)"
        r="4"
      />
    </svg>
  </div>
</template>
