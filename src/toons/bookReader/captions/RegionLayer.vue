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
import { clipPathPolygon, coverImageRect, percentPoints, regionBoundingBox } from "../../editor/regionFit";
import type { ReaderRegion } from "../types";

const props = withDefaults(
  defineProps<{
    pageNum: number;
    regions: ReaderRegion[];
    /** The page's backdrop plate — measured for the content box, same anchor WordLayer uses. */
    imageEl?: HTMLImageElement | null;
    /**
     * The toon's authored design width (same one WordLayer.vue scales captions
     * against) — NOT the backdrop `<img>`'s own naturalWidth. The flattened
     * plate file is a capped-resolution export (can be much smaller than
     * design resolution), so borderWidth/geometry, authored in design-px,
     * must scale against designWidth or the border comes out too small/large
     * by whatever ratio the flatten step happened to cap that plate at.
     */
    designWidth?: number;
  }>(),
  { imageEl: null, designWidth: 1008 }
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

interface SvgBorder {
  points: string;
  color: string;
  width: number;
  dasharray?: string;
}

interface RegionLayout {
  key: string;
  file: string;
  /** Outer, unclipped positioning box — the SVG border (a sibling of the clipped div below) needs an unclipped box at this same position, or a polygon's stroke gets sliced off at the clip. */
  frameStyle: CSSProperties;
  /** Inner clipped box: fills frameStyle exactly, carries the clip-path + (rect only) real CSS border. */
  clipStyle: CSSProperties;
  imgStyle: CSSProperties | null;
  svgBorder: SvgBorder | null;
}

const DASH_PATTERN: Record<string, (width: number) => string | undefined> = {
  solid: () => undefined,
  dashed: (width) => `${width * 2.5} ${width * 1.5}`,
  dotted: (width) => `${width * 0.1} ${width * 1.6}`,
};

/**
 * `borderWidth` is stored in design-resolution px, but the backdrop plate
 * renders at whatever size fits the viewport — applying it unscaled made the
 * border the same real screen-pixel thickness at any zoom/viewport size
 * instead of shrinking and growing with the rest of the plate. Scale must be
 * `renderedWidth / designWidth` (below), not `renderedWidth / naturalWidth` —
 * the flattened plate file is a capped-resolution export that can be much
 * smaller than design resolution, so naturalWidth alone gets the ratio wrong.
 *
 * Same technique as the editor's RegionShape.vue: a rect gets a real CSS
 * `border` (dashed/dotted included) on the clip-path'd frame div itself; a
 * polygon's border is painted with an unclipped sibling SVG <polygon> in
 * plain frame-pixel coordinates instead — box-shadow only follows the
 * element's rectangular border box and renders nothing along an interior
 * polygon edge, and a border painted *inside* the clipped div would have
 * half its stroke sliced off at the clip. No viewBox scaling either (same
 * reasoning as the editor fix): GeometryLayer.vue's draft-polygon overlay
 * proves plain pixel coordinates are the safe, cross-browser choice.
 */
function rectBorderStyle(region: ReaderRegion, scale: number): CSSProperties {
  if (!region.borderWidth || region.shapeType !== "rect") return {};
  return { border: `${region.borderWidth * scale}px ${region.borderStyle} ${region.borderColor || "#ffffff"}` };
}

function polygonSvgBorder(
  region: ReaderRegion,
  scale: number,
  frameWidth: number,
  frameHeight: number
): SvgBorder | null {
  if (!region.borderWidth || region.shapeType !== "polygon") return null;
  const width = region.borderWidth * scale;
  return {
    points: percentPoints(region.geometry)
      .map((p) => `${(p.x / 100) * frameWidth},${(p.y / 100) * frameHeight}`)
      .join(" "),
    color: region.borderColor || "#ffffff",
    width,
    dasharray: DASH_PATTERN[region.borderStyle]?.(width),
  };
}

const layouts = computed<RegionLayout[]>(() => {
  if (!box.value) return [];
  const b = box.value;
  // Same designScale WordLayer.vue computes — the plate's own rendered width over the toon's
  // authored design width, not over the (possibly much smaller, capped) backdrop file's naturalWidth.
  const scale = b.width / props.designWidth;
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
      },
      clipStyle: {
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        clipPath: clipPathPolygon(region.geometry, bbox),
        ...rectBorderStyle(region, scale),
      },
      imgStyle,
      svgBorder: polygonSvgBorder(region, scale, width, height),
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
      <div :style="layout.clipStyle">
        <img
          v-if="layout.imgStyle"
          :src="layout.file"
          :style="layout.imgStyle"
          alt=""
          draggable="false"
          @load="onRegionLoad(index, $event)"
        />
      </div>
      <svg
        v-if="layout.svgBorder"
        :style="{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }"
        aria-hidden="true"
      >
        <polygon
          :points="layout.svgBorder.points"
          fill="none"
          :stroke="layout.svgBorder.color"
          :stroke-width="layout.svgBorder.width"
          :stroke-dasharray="layout.svgBorder.dasharray"
        />
      </svg>
    </div>
  </div>
</template>
