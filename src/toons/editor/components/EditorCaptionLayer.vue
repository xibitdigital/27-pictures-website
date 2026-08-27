<script setup lang="ts">
/**
 * Caption overlay for the studio plate. Same measure math as WordLayer,
 * but the layer is hit-tested: drag existing bubbles, click empty plate to add.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch, type CSSProperties } from "vue";
import WordCaption from "../../bookReader/captions/WordCaption.vue";
import { buildCaptions, imageContentBox, type CaptionModel } from "../../bookReader/captions/captionModel";
import { clientToPlateFraction, grabOffset, type ContentBox } from "../plateCoords";
import { bubbleToWordEntry } from "../mapConfig";
import type { BubbleRecord } from "../types";

const props = withDefaults(
  defineProps<{
    pageNum: number;
    bubbles: BubbleRecord[];
    selectedId?: string | null;
    lang?: string;
    designWidth?: number;
    designHeight?: number;
    imageEl?: HTMLImageElement | null;
  }>(),
  {
    selectedId: null,
    lang: "en",
    designWidth: 800,
    designHeight: 1424,
    imageEl: null,
  }
);

const emit = defineEmits<{
  select: [id: string];
  move: [id: string, x: number, y: number];
  persist: [id: string, x: number, y: number];
  add: [pos: { x: number; y: number }];
}>();

const rootEl = ref<HTMLElement | null>(null);
const box = ref<ContentBox | null>(null);

const designScale = computed(() => (box.value ? box.value.width / props.designWidth : 0));

const captions = computed<CaptionModel[]>(() => {
  if (!box.value || !designScale.value) return [];
  const words = props.bubbles.map(bubbleToWordEntry);
  const models = buildCaptions(words, {
    lang: props.lang,
    pageNum: props.pageNum,
    designWidth: props.designWidth,
    designHeight: props.designHeight,
    designScale: designScale.value,
    fontFamily: '"Bangers", cursive',
  });
  return models.map((model, i) => {
    const id = props.bubbles[i]?.id;
    const classes = [...model.classes];
    if (id && id === props.selectedId) classes.push("is-editor-selected");
    return { ...model, key: id || model.key, classes };
  });
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

let drag: {
  id: string;
  pointerId: number;
  offsetX: number;
  offsetY: number;
  x: number;
  y: number;
} | null = null;

const dragging = ref(false);

function overlayBox(): ContentBox | null {
  const el = rootEl.value;
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  if (!rect.width || !rect.height) return box.value;
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
}

function onWindowMove(ev: PointerEvent): void {
  if (!drag || ev.pointerId !== drag.pointerId) return;
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
  if (commit) emit("persist", done.id, done.x, done.y);
}

function unbindDrag(): void {
  const layer = rootEl.value;
  const pointerId = drag?.pointerId;
  drag = null;
  dragging.value = false;
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
  const host = target?.closest?.("[data-bubble-id]") as HTMLElement | null;
  const plate = overlayBox();
  if (!plate) return;

  if (!host) {
    const pos = clientToPlateFraction(ev.clientX, ev.clientY, plate);
    emit("add", pos);
    return;
  }

  const id = host.getAttribute("data-bubble-id");
  if (!id) return;
  const bubble = props.bubbles.find((b) => b.id === id);
  if (!bubble) return;
  emit("select", id);
  ev.preventDefault();
  const off = grabOffset(ev.clientX, ev.clientY, plate, bubble.x, bubble.y);
  drag = { id, pointerId: ev.pointerId, offsetX: off.offsetX, offsetY: off.offsetY, x: bubble.x, y: bubble.y };
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
    :class="{ 'is-dragging': dragging }"
    :style="layerStyle"
    @pointerdown="onPointerDown"
  >
    <WordCaption
      v-for="(caption, i) in captions"
      :key="bubbles[i]?.id || caption.key"
      :caption="caption"
      :data-bubble-id="bubbles[i]?.id"
    />
  </div>
</template>
