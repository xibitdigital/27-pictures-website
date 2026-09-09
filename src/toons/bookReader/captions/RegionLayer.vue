<script setup lang="ts">
/**
 * Live-rendered Layout-page regions, sitting over the page's backdrop plate —
 * same overlay skeleton as WordLayer.vue (measure the backdrop `<img>`'s
 * object-fit:contain content box, position this layer to match it exactly),
 * but painting clipped region images instead of captions. Geometry math is
 * `regionFit.ts`'s `regionBoundingBox`/`coverImageRect`/`clipPathPolygon` —
 * the same functions the Layout editor's GeometryLayer.vue uses, so a
 * region's on-screen shape here matches its editor preview exactly.
 *
 * Non-interactive (`pointer-events: none` throughout) — regions are art, not
 * caption bubbles, so nav-zone click-through is never a concern here.
 */
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch, type CSSProperties } from "vue";
import { imageContentBox } from "./captionModel";
import { clipPathPolygon, coverImageRect, regionBoundingBox } from "../../editor/regionFit";
import type { ReaderRegion } from "../types";

const props = withDefaults(
  defineProps<{
    pageNum: number;
    regions: ReaderRegion[];
    /** The page's backdrop plate — measured for the content box, same anchor WordLayer uses. */
    imageEl?: HTMLImageElement | null;
  }>(),
  { imageEl: null }
);

const box = ref<{ left: number; top: number; width: number; height: number } | null>(null);

// A region's stored fileWidth/fileHeight is a snapshot that can go stale if the
// slot's file is ever reassigned without updating those columns — used only for
// first paint. Once a region's own <img> loads, its real naturalWidth/Height
// take over here, the same measure-then-correct discipline WordLayer applies
// to the backdrop plate itself.
const naturalDims = reactive<Record<number, { width: number; height: number }>>({});

function onRegionLoad(index: number, ev: Event): void {
  const img = ev.target as HTMLImageElement;
  if (!img.naturalWidth || !img.naturalHeight) return;
  naturalDims[index] = { width: img.naturalWidth, height: img.naturalHeight };
}

interface RegionLayout {
  key: string;
  file: string;
  frameStyle: CSSProperties;
  imgStyle: CSSProperties | null;
}

/**
 * Same technique the editor's RegionShape.vue uses: `border` for a rect (a
 * real border painted around a clip-path box only looks right when the box
 * itself is the shape), an inset `box-shadow` for a polygon (hugs the
 * clipped edge exactly, solid-only — box-shadow has no dash pattern).
 */
function borderStyle(region: ReaderRegion): CSSProperties {
  if (!region.borderWidth) return {};
  const color = region.borderColor || "#ffffff";
  if (region.shapeType === "rect") {
    return { border: `${region.borderWidth}px ${region.borderStyle} ${color}` };
  }
  return { boxShadow: `inset 0 0 0 ${region.borderWidth}px ${color}` };
}

const layouts = computed<RegionLayout[]>(() => {
  if (!box.value) return [];
  const b = box.value;
  return props.regions.map((region, index) => {
    const bbox = regionBoundingBox(region.geometry);
    const left = bbox.x * b.width;
    const top = bbox.y * b.height;
    const width = bbox.w * b.width;
    const height = bbox.h * b.height;
    const natural =
      naturalDims[index] ??
      (region.fileWidth && region.fileHeight ? { width: region.fileWidth, height: region.fileHeight } : null);
    const imgStyle: CSSProperties | null = natural
      ? (() => {
          const rect = coverImageRect(
            { width, height },
            natural,
            region.imageScale,
            region.imageOffsetX,
            region.imageOffsetY
          );
          return {
            position: "absolute",
            left: `${rect.x}px`,
            top: `${rect.y}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
          };
        })()
      : null;
    return {
      key: `${props.pageNum}-${index}`,
      file: region.file,
      frameStyle: {
        position: "absolute",
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
        height: `${height}px`,
        overflow: "hidden",
        clipPath: clipPathPolygon(region.geometry, bbox),
        ...borderStyle(region),
      },
      imgStyle,
    };
  });
});

const layerStyle = computed<CSSProperties>(() => ({
  position: "absolute",
  left: `${box.value?.left ?? 0}px`,
  top: `${box.value?.top ?? 0}px`,
  width: `${box.value?.width ?? 0}px`,
  height: `${box.value?.height ?? 0}px`,
  pointerEvents: "none",
  overflow: "visible",
  zIndex: 20,
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

onMounted(() => {
  observeImage(props.imageEl);
});

watch(
  () => props.imageEl,
  (img) => observeImage(img)
);

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
});
</script>

<template>
  <div class="jax-region-layer" :style="layerStyle" :data-page-num="pageNum">
    <div v-for="(layout, index) in layouts" :key="layout.key" :style="layout.frameStyle">
      <img
        v-if="layout.imgStyle"
        :src="layout.file"
        :style="layout.imgStyle"
        alt=""
        draggable="false"
        @load="onRegionLoad(index, $event)"
      />
    </div>
  </div>
</template>
