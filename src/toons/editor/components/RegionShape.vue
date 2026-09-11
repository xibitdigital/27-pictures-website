<script setup lang="ts">
/** Purely presentational: the clipped image (or an empty placeholder) for one Layout-mode region. All position/size math lives in GeometryLayer.vue + regionFit.ts. */
import { ImagePlus } from "@lucide/vue";
import { computed, type CSSProperties } from "vue";
import { percentPoints } from "../regionFit";
import type { RegionRecord } from "../types";

const props = defineProps<{
  region: RegionRecord;
  clipPath: string;
  imgStyle: CSSProperties | null;
  /** This region's own frame size in real pixels — lets the border SVG use plain pixel coordinates (see svgBorder below) instead of a viewBox. */
  frameWidth: number;
  frameHeight: number;
  /** design-px -> on-screen-px ratio the studio canvas is currently rendered at — borderWidth is stored in design px, so this keeps the editor's border the same real thickness (relative to the plate) as the reader's, instead of a fixed literal px regardless of canvas zoom. */
  scale: number;
}>();

/**
 * `border` on a `clip-path`-cropped element sits outside the clipped edge for
 * anything but a rect (the clip crops the box, not the border painted around
 * it), so a rect gets a real CSS `border` — dashed/dotted included. A polygon
 * used to get an inset `box-shadow` instead, but that only follows the
 * element's rectangular border box: it draws along the bbox edges the
 * polygon happens to touch and shows nothing at all along an interior
 * diagonal edge, which for most polygons is most of the outline — i.e. no
 * visible stroke. An SVG `<polygon>` overlay (below) traces the actual
 * points instead, so this only carries the rect case now.
 */
const borderStyle = computed<CSSProperties>(() => {
  if (!props.region.borderWidth || props.region.shapeType !== "rect") return {};
  return {
    border: `${props.region.borderWidth * props.scale}px ${props.region.borderStyle} ${
      props.region.borderColor || "#ffffff"
    }`,
  };
});

const DASH_PATTERN: Record<string, (width: number) => string | undefined> = {
  solid: () => undefined,
  dashed: (width) => `${width * 2.5} ${width * 1.5}`,
  dotted: (width) => `${width * 0.1} ${width * 1.6}`,
};

/**
 * SVG-traced border for a polygon, in real pixel coordinates (no viewBox) —
 * matching GeometryLayer.vue's own draft-polygon overlay, which uses the same
 * plain-pixel approach rather than a viewBox scaled non-uniformly to fit a
 * skewed parallelogram. `vector-effect="non-scaling-stroke"` combined with a
 * non-uniform viewBox scale is inconsistently handled across browsers and
 * visibly mispositioned the border relative to the region's own vertices.
 */
const svgBorder = computed(() => {
  if (props.region.shapeType === "rect" || !props.region.borderWidth) return null;
  const width = props.region.borderWidth * props.scale;
  return {
    points: percentPoints(props.region.geometry)
      .map((p) => `${(p.x / 100) * props.frameWidth},${(p.y / 100) * props.frameHeight}`)
      .join(" "),
    color: props.region.borderColor || "#ffffff",
    width,
    dasharray: DASH_PATTERN[props.region.borderStyle]?.(width),
  };
});
</script>

<template>
  <!--
    Two siblings, not one: the clip-path lives on `.editor-region`, and clip-path
    also clips any descendant — an SVG border painted *inside* that div would get
    half its stroke sliced off along the clipped edge, the same problem the old
    box-shadow approach had. The border SVG sits next to it instead, unclipped,
    at the same absolute inset:0 box.
  -->
  <div
    class="editor-region"
    :class="{ 'is-empty': !region.fileUrl }"
    :data-region-id="region.id"
    :style="{ clipPath, ...borderStyle }"
  >
    <img v-if="region.fileUrl" :src="region.fileUrl" :style="imgStyle || undefined" alt="" draggable="false" />
    <div v-else class="editor-region-empty" aria-hidden="true">
      <ImagePlus :size="22" :stroke-width="1.6" />
      <span>Click to add image</span>
    </div>
  </div>
  <svg v-if="svgBorder" class="editor-region-border" aria-hidden="true">
    <polygon
      :points="svgBorder.points"
      fill="none"
      :stroke="svgBorder.color"
      :stroke-width="svgBorder.width"
      :stroke-dasharray="svgBorder.dasharray"
    />
  </svg>
</template>
