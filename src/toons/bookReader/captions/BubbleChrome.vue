<script setup lang="ts">
/**
 * Balloon / HUD / burst background for one caption. Paths come from
 * `buildBubbleChrome` (viewBox 0–100, stretched over the text box).
 */
import type { BubbleChromeModel } from "./bubbleChrome";

defineProps<{
  chrome: BubbleChromeModel;
}>();
</script>

<template>
  <svg class="jax-bubble-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
    <!-- paint-order draws the stroke first, so only its outer half shows over
         a semi-transparent body; non-scaling-stroke keeps the rim even. -->
    <path
      v-for="(p, i) in chrome.paths"
      :key="i"
      :d="p.d"
      :fill="p.fill"
      :fill-opacity="p.fillOpacity < 1 ? p.fillOpacity : undefined"
      :stroke="p.stroke"
      :stroke-width="p.strokeWidth"
      stroke-linejoin="round"
      stroke-linecap="round"
      paint-order="stroke fill"
      vector-effect="non-scaling-stroke"
    />
  </svg>
</template>
