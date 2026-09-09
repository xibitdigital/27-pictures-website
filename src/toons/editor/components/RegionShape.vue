<script setup lang="ts">
/** Purely presentational: the clipped image (or an empty placeholder) for one Layout-mode region. All position/size math lives in GeometryLayer.vue + regionFit.ts. */
import { ImagePlus } from "@lucide/vue";
import { computed, type CSSProperties } from "vue";
import type { RegionRecord } from "../types";

const props = defineProps<{
  region: RegionRecord;
  clipPath: string;
  imgStyle: CSSProperties | null;
}>();

/**
 * `border` on a `clip-path`-cropped element sits outside the clipped edge for
 * anything but a rect (the clip crops the box, not the border painted around
 * it), so a rect gets a real `border` — dashed/dotted included — and a
 * polygon gets an inset `box-shadow` instead, which hugs the clipped edge
 * exactly but can only ever render solid (box-shadow has no dash pattern).
 */
const borderStyle = computed<CSSProperties>(() => {
  if (!props.region.borderWidth) return {};
  const color = props.region.borderColor || "#ffffff";
  const width = props.region.borderWidth;
  if (props.region.shapeType === "rect") {
    return { border: `${width}px ${props.region.borderStyle} ${color}` };
  }
  return { boxShadow: `inset 0 0 0 ${width}px ${color}` };
});
</script>

<template>
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
</template>
