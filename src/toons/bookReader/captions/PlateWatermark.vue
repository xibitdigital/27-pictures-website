<script setup lang="ts">
/**
 * Locked last layout layer for the series watermark — not a D1 region, so the
 * editor cannot select/move/delete it. flattenNow paints the same placement
 * onto the saved plate. Live-composited Layout pages need this overlay because
 * the reader never shows the flatten as art (RegionLayer sits on top).
 */
import { computed, onBeforeUnmount, onMounted, ref, watch, type CSSProperties } from "vue";
import { imageContentBox } from "./captionModel";
import { watermarkDrawRect } from "../../editor/regionFit";

const props = defineProps<{
  src: string;
  imageEl?: HTMLImageElement | null;
  designWidth: number;
}>();

const box = ref<{ left: number; top: number; width: number; height: number } | null>(null);
const natural = ref<{ width: number; height: number } | null>(null);

function onMarkLoad(ev: Event): void {
  const img = ev.target as HTMLImageElement;
  if (!img.naturalWidth || !img.naturalHeight) return;
  natural.value = { width: img.naturalWidth, height: img.naturalHeight };
}

const layerStyle = computed<CSSProperties>(() => ({
  position: "absolute",
  left: `${box.value?.left ?? 0}px`,
  top: `${box.value?.top ?? 0}px`,
  width: `${box.value?.width ?? 0}px`,
  height: `${box.value?.height ?? 0}px`,
  pointerEvents: "none",
  overflow: "visible",
  zIndex: 21,
}));

const markStyle = computed<CSSProperties>(() => {
  if (!box.value || !natural.value) return { visibility: "hidden" };
  const rect = watermarkDrawRect(natural.value, box.value, props.designWidth);
  if (!rect) return { visibility: "hidden" };
  return {
    position: "absolute",
    left: `${rect.x}px`,
    top: `${rect.y}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    pointerEvents: "none",
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

let resizeObserver: ResizeObserver | null = null;

function observeImage(img: HTMLImageElement | null): void {
  resizeObserver?.disconnect();
  resizeObserver = null;
  if (!img) {
    box.value = null;
    return;
  }
  measure();
  if (!img.complete || (!img.naturalWidth && !img.clientWidth)) {
    img.addEventListener("load", measure, { once: true });
  }
  resizeObserver = new ResizeObserver(() => measure());
  resizeObserver.observe(img);
  if (img.parentElement) resizeObserver.observe(img.parentElement);
}

onMounted(() => observeImage(props.imageEl ?? null));
watch(
  () => props.imageEl,
  (img) => observeImage(img ?? null)
);
onBeforeUnmount(() => resizeObserver?.disconnect());
</script>

<template>
  <div class="jax-plate-watermark" :style="layerStyle" aria-hidden="true">
    <img :src="src" alt="" draggable="false" :style="markStyle" @load="onMarkLoad" />
  </div>
</template>
