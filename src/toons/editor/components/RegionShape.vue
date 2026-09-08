<script setup lang="ts">
/** Purely presentational: the clipped image (or an empty placeholder) for one Layout-mode region. All position/size math lives in GeometryLayer.vue + regionFit.ts. */
import { ImagePlus } from "@lucide/vue";
import type { CSSProperties } from "vue";
import type { RegionRecord } from "../types";

defineProps<{
  region: RegionRecord;
  clipPath: string;
  imgStyle: CSSProperties | null;
}>();
</script>

<template>
  <div class="editor-region" :class="{ 'is-empty': !region.fileUrl }" :data-region-id="region.id" :style="{ clipPath }">
    <img v-if="region.fileUrl" :src="region.fileUrl" :style="imgStyle || undefined" alt="" draggable="false" />
    <div v-else class="editor-region-empty" aria-hidden="true">
      <ImagePlus :size="22" :stroke-width="1.6" />
      <span>Click to add image</span>
    </div>
  </div>
</template>
