<script setup lang="ts">
/**
 * Caption overlay for the studio plate. Same measure math as WordLayer,
 * but the layer is hit-tested: drag existing bubbles, click empty plate to add.
 */
import {
  ArrowDown,
  ArrowDownLeft,
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  Circle,
  Trash2,
} from "@lucide/vue";
import { computed, onBeforeUnmount, onMounted, ref, watch, type Component, type CSSProperties } from "vue";
import WordCaption from "../../bookReader/captions/WordCaption.vue";
import { buildCaption, imageContentBox, type CaptionModel } from "../../bookReader/captions/captionModel";
import {
  defaultBubblePoints,
  hashSeed,
  isReshapableBubbleShape,
  parseBubblePoints,
  resolveBubbleStyle,
  roundBubblePoints,
  type BubblePoint,
} from "../../bookReader/bubbles";
import { clientToPlateFraction, grabOffset, type ContentBox } from "../plateCoords";
import { bubbleExtra, bubbleToWordEntry, bubblesInPlayOrder, type BubbleTail } from "../mapConfig";
import type { BubbleRecord } from "../types";
import type { BubbleTool } from "./LayoutToolbar.vue";
import EditorIconButton from "./ui/EditorIconButton.vue";

const TAIL_PAD: { tail: BubbleTail; label: string; icon: Component }[] = [
  { tail: "top-left", label: "Top left", icon: ArrowUpLeft },
  { tail: "top", label: "Top", icon: ArrowUp },
  { tail: "top-right", label: "Top right", icon: ArrowUpRight },
  { tail: "left", label: "Left", icon: ArrowLeft },
  { tail: "none", label: "No tail", icon: Circle },
  { tail: "right", label: "Right", icon: ArrowRight },
  { tail: "bottom-left", label: "Bottom left", icon: ArrowDownLeft },
  { tail: "bottom", label: "Bottom", icon: ArrowDown },
  { tail: "bottom-right", label: "Bottom right", icon: ArrowDownRight },
];

const props = withDefaults(
  defineProps<{
    pageNum: number;
    bubbles: BubbleRecord[];
    selectedId?: string | null;
    lang?: string;
    designWidth?: number;
    designHeight?: number;
    imageEl?: HTMLImageElement | null;
    tool?: BubbleTool;
  }>(),
  {
    selectedId: null,
    lang: "en",
    designWidth: 800,
    designHeight: 1424,
    imageEl: null,
    tool: "select",
  }
);

const emit = defineEmits<{
  select: [id: string];
  move: [id: string, x: number, y: number];
  persist: [id: string, x: number, y: number];
  add: [pos: { x: number; y: number }];
  tail: [id: string, tail: BubbleTail];
  remove: [id: string];
  reshape: [id: string, points: BubblePoint[]];
  "persist-reshape": [id: string, points: BubblePoint[]];
}>();

const rootEl = ref<HTMLElement | null>(null);
const box = ref<ContentBox | null>(null);

const designScale = computed(() => (box.value ? box.value.width / props.designWidth : 0));

type EditorCaption = CaptionModel & { bubbleId: string; playIndex: number };

/** Keep DOM order still while dragging so Vue does not reuse the wrong host. */
const frozenOrder = ref<string[] | null>(null);

const orderedBubbles = computed(() => {
  const ordered = bubblesInPlayOrder(props.bubbles);
  const freeze = frozenOrder.value;
  if (!freeze) return ordered;
  const byId = new Map(props.bubbles.map((b) => [b.id, b]));
  const pinned: BubbleRecord[] = [];
  const seen = new Set<string>();
  for (const id of freeze) {
    const bubble = byId.get(id);
    if (!bubble) continue;
    pinned.push(bubble);
    seen.add(id);
  }
  for (const bubble of ordered) {
    if (!seen.has(bubble.id)) pinned.push(bubble);
  }
  return pinned;
});

const captions = computed<EditorCaption[]>(() => {
  if (!box.value || !designScale.value) return [];
  const list = orderedBubbles.value;
  const ctx = {
    lang: props.lang,
    pageNum: props.pageNum,
    designWidth: props.designWidth,
    designHeight: props.designHeight,
    designScale: designScale.value,
    fontFamily: '"Bangers", cursive',
  };
  const out: EditorCaption[] = [];
  list.forEach((bubble, i) => {
    const model = buildCaption(bubbleToWordEntry(bubble), i, ctx);
    if (!model) return;
    const classes = [...model.classes];
    if (bubble.id === props.selectedId) classes.push("is-editor-selected");
    out.push({ ...model, key: bubble.id, bubbleId: bubble.id, playIndex: i + 1, classes });
  });
  return out;
});

const layerStyle = computed<CSSProperties>(() => ({
  position: "absolute",
  left: `${box.value?.left ?? 0}px`,
  top: `${box.value?.top ?? 0}px`,
  width: `${box.value?.width ?? 0}px`,
  height: `${box.value?.height ?? 0}px`,
  pointerEvents: "auto",
  overflow: "visible",
  zIndex: 35,
}));

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
  if (changed) {
    box.value = { left: next.left, top: next.top, width: next.width, height: next.height };
  }
}

type DragState =
  | {
      kind: "move";
      id: string;
      pointerId: number;
      offsetX: number;
      offsetY: number;
      x: number;
      y: number;
    }
  | {
      kind: "vertex";
      id: string;
      pointerId: number;
      index: number;
      points: BubblePoint[];
      overlay: HTMLElement;
    };

let drag: DragState | null = null;

const dragging = ref(false);

function captionPoints(bubble: BubbleRecord, index: number, text: string): BubblePoint[] | null {
  const custom = parseBubblePoints(bubbleExtra(bubble).bubblePoints);
  if (custom) return custom;
  const entry = bubbleToWordEntry(bubble);
  const style = resolveBubbleStyle(entry as unknown as Record<string, unknown>, bubble.variant);
  if (!isReshapableBubbleShape(style.shape)) return null;
  const seed = hashSeed(props.pageNum, index, text, bubble.x, bubble.y, style.tail);
  return defaultBubblePoints(style.shape, style.tail, seed);
}

const reshapePoints = computed<BubblePoint[] | null>(() => {
  if (props.tool !== "reshape" || !props.selectedId) return null;
  const caption = captions.value.find((c) => c.bubbleId === props.selectedId);
  const bubble = props.bubbles.find((b) => b.id === props.selectedId);
  if (!caption || !bubble || !caption.bubble) return null;
  return captionPoints(bubble, caption.index, caption.text);
});

function clientToViewBox(el: HTMLElement, clientX: number, clientY: number): BubblePoint {
  const svg = el as unknown as SVGSVGElement;
  if (typeof svg.createSVGPoint === "function") {
    try {
      const ctm = svg.getScreenCTM?.();
      if (ctm) {
        const pt = svg.createSVGPoint();
        pt.x = clientX;
        pt.y = clientY;
        const local = pt.matrixTransform(ctm.inverse());
        return [local.x, local.y];
      }
    } catch {
      /* jsdom / degenerate matrix */
    }
  }
  const rect = el.getBoundingClientRect();
  if (!rect.width || !rect.height) return [50, 50];
  return [((clientX - rect.left) / rect.width) * 100, ((clientY - rect.top) / rect.height) * 100];
}

function hostedCaption(caption: EditorCaption): CaptionModel {
  return {
    ...caption,
    style: {
      ...caption.style,
      position: "relative",
      left: "auto",
      top: "auto",
      "--jax-transform": "none",
    },
  };
}

function hostStyle(caption: EditorCaption): CSSProperties {
  return {
    position: "absolute",
    left: caption.style.left,
    top: caption.style.top,
    transform: caption.style["--jax-transform"] || "translate(-50%, -50%)",
    zIndex: caption.bubbleId === props.selectedId ? 37 : 36,
  };
}

function currentTail(id: string): BubbleTail {
  const found = props.bubbles.find((b) => b.id === id);
  return (found?.tail as BubbleTail) || "bottom-left";
}

function onTailClick(ev: Event, id: string, tail: BubbleTail): void {
  ev.preventDefault();
  ev.stopPropagation();
  emit("select", id);
  emit("tail", id, tail);
}

function onDeleteClick(ev: Event, id: string): void {
  ev.preventDefault();
  ev.stopPropagation();
  emit("select", id);
  emit("remove", id);
}

function overlayBox(): ContentBox | null {
  const el = rootEl.value;
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  if (!rect.width || !rect.height) return box.value;
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
}

function onWindowMove(ev: PointerEvent): void {
  if (!drag || ev.pointerId !== drag.pointerId) return;
  if (drag.kind === "vertex") {
    const vertex = drag;
    const pos = clientToViewBox(vertex.overlay, ev.clientX, ev.clientY);
    const next = vertex.points.map((p, i) => (i === vertex.index ? pos : p));
    vertex.points = next;
    emit("reshape", vertex.id, roundBubblePoints(next));
    return;
  }
  const plate = overlayBox();
  if (!plate) return;
  const pos = clientToPlateFraction(ev.clientX, ev.clientY, plate, drag.offsetX, drag.offsetY);
  drag.x = pos.x;
  drag.y = pos.y;
  emit("move", drag.id, pos.x, pos.y);
}

function endDrag(ev: PointerEvent, commit: boolean): void {
  if (!drag || ev.pointerId !== drag.pointerId) return;
  const done = drag;
  unbindDrag();
  if (!commit) return;
  if (done.kind === "vertex") {
    emit("persist-reshape", done.id, roundBubblePoints(done.points));
    return;
  }
  emit("persist", done.id, done.x, done.y);
}

function unbindDrag(): void {
  const layer = rootEl.value;
  const pointerId = drag?.pointerId;
  drag = null;
  dragging.value = false;
  frozenOrder.value = null;
  window.removeEventListener("pointermove", onWindowMove);
  window.removeEventListener("pointerup", onWindowUp);
  window.removeEventListener("pointercancel", onWindowCancel);
  if (layer && pointerId != null && layer.hasPointerCapture?.(pointerId)) {
    try {
      layer.releasePointerCapture(pointerId);
    } catch {
      /* already released */
    }
  }
}

function onWindowUp(ev: PointerEvent): void {
  endDrag(ev, true);
}

function onWindowCancel(ev: PointerEvent): void {
  // Browser cancelled the gesture (scroll, capture loss) — still keep the last point.
  endDrag(ev, true);
}

function onPointerDown(ev: PointerEvent): void {
  if (ev.isPrimary === false) return;
  if (ev.pointerType === "mouse" && ev.button !== 0) return;
  const target = ev.target as HTMLElement | null;
  const vertexEl = target?.closest?.("[data-bubble-vertex]") as HTMLElement | null;
  const host = target?.closest?.("[data-bubble-id]") as HTMLElement | null;
  const plate = overlayBox();
  if (!plate) return;

  if (vertexEl && host && props.tool === "reshape") {
    const id = host.getAttribute("data-bubble-id");
    const overlay = vertexEl.closest("[data-bubble-handles]") as HTMLElement | null;
    const index = Number(vertexEl.getAttribute("data-bubble-vertex") || 0);
    if (!id || !overlay || !reshapePoints.value) return;
    const bubble = props.bubbles.find((b) => b.id === id);
    if (!bubble) return;
    ev.preventDefault();
    emit("select", id);
    const points = reshapePoints.value.map((p) => [p[0], p[1]] as BubblePoint);
    drag = { kind: "vertex", id, pointerId: ev.pointerId, index, points, overlay };
    dragging.value = true;
    const layer = rootEl.value;
    try {
      layer?.setPointerCapture?.(ev.pointerId);
    } catch {
      /* happy-dom / already captured */
    }
    window.addEventListener("pointermove", onWindowMove);
    window.addEventListener("pointerup", onWindowUp);
    window.addEventListener("pointercancel", onWindowCancel);
    return;
  }

  if (!host) {
    if (props.tool === "reshape") return;
    const pos = clientToPlateFraction(ev.clientX, ev.clientY, plate);
    emit("add", pos);
    return;
  }

  const id = host.getAttribute("data-bubble-id");
  if (!id) return;
  const bubble = props.bubbles.find((b) => b.id === id);
  if (!bubble) return;
  emit("select", id);
  if (props.tool === "reshape") return;
  ev.preventDefault();
  const off = grabOffset(ev.clientX, ev.clientY, plate, bubble.x, bubble.y);
  frozenOrder.value = orderedBubbles.value.map((item) => item.id);
  drag = {
    kind: "move",
    id,
    pointerId: ev.pointerId,
    offsetX: off.offsetX,
    offsetY: off.offsetY,
    x: bubble.x,
    y: bubble.y,
  };
  dragging.value = true;
  // Capture on the layer, not the caption: Vue re-renders the bubble on
  // select/move and would drop a capture held on that node — then pointerup
  // never arrives and the caption cannot be dropped.
  const layer = rootEl.value;
  try {
    layer?.setPointerCapture?.(ev.pointerId);
  } catch {
    /* happy-dom / already captured */
  }
  window.addEventListener("pointermove", onWindowMove);
  window.addEventListener("pointerup", onWindowUp);
  window.addEventListener("pointercancel", onWindowCancel);
}

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

onMounted(() => bindImage(props.imageEl));

onBeforeUnmount(() => {
  props.imageEl?.removeEventListener("load", measure);
  ro?.disconnect();
  unbindDrag();
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
    class="editor-word-layer"
    :class="{ 'is-dragging': dragging, 'is-reshaping': tool === 'reshape' }"
    :style="layerStyle"
    @pointerdown="onPointerDown"
  >
    <div
      v-for="caption in captions"
      :key="caption.bubbleId"
      class="editor-caption-host"
      :data-bubble-id="caption.bubbleId"
      :style="hostStyle(caption)"
    >
      <span data-play-order aria-hidden="true">{{ caption.playIndex }}</span>
      <WordCaption :caption="hostedCaption(caption)" :data-bubble-id="caption.bubbleId" />
      <div
        v-if="caption.bubbleId === selectedId && tool === 'reshape' && reshapePoints"
        class="editor-bubble-handles"
        data-bubble-handles
      >
        <div
          v-for="(pt, i) in reshapePoints"
          :key="i"
          class="editor-bubble-handle"
          :data-bubble-vertex="String(i)"
          :aria-label="`Control point ${i + 1}`"
          role="button"
          :style="{ left: `${pt[0]}%`, top: `${pt[1]}%` }"
        />
      </div>
      <div
        v-if="caption.bubbleId === selectedId && !dragging && tool !== 'reshape'"
        class="editor-tail-ring"
        role="radiogroup"
        aria-label="Tail"
        data-tail-ring
        @pointerdown.stop
      >
        <EditorIconButton
          v-for="cell in TAIL_PAD"
          :key="cell.tail"
          :data-tail="cell.tail"
          :aria-label="cell.label"
          :aria-pressed="currentTail(caption.bubbleId) === cell.tail"
          :title="cell.label"
          @click="onTailClick($event, caption.bubbleId, cell.tail)"
          @pointerdown.stop
        >
          <component :is="cell.icon" :size="14" :stroke-width="1.8" aria-hidden="true" />
        </EditorIconButton>
      </div>
      <EditorIconButton
        v-if="caption.bubbleId === selectedId && !dragging && tool !== 'reshape'"
        class="editor-bubble-delete"
        aria-label="Delete bubble"
        title="Delete bubble"
        @click="onDeleteClick($event, caption.bubbleId)"
        @pointerdown.stop
      >
        <Trash2 :size="14" :stroke-width="1.8" aria-hidden="true" />
      </EditorIconButton>
    </div>
  </div>
</template>
