<script setup lang="ts">
/** One-shot toast: how to read the vertical strip. Parent owns when it opens. */
import { useFlipframeCopy } from "./flipframeCopy";

defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  dismiss: [];
}>();

const t = useFlipframeCopy();
</script>

<template>
  <div v-if="open" class="scroll-howto" role="status">
    <!-- Same bouncing down arrow as the cover guide — it points where to go -->
    <svg class="scroll-howto-arrow" viewBox="0 0 32 44" fill="none" aria-hidden="true">
      <g class="front-cover-howto-bounce">
        <path class="scroll-howto-arrow-glyph" d="M16 6v22" stroke-width="2.5" stroke-linecap="round" />
        <path
          class="scroll-howto-arrow-glyph"
          d="M8 22l8 8 8-8"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <path
          class="scroll-howto-arrow-glyph front-cover-howto-chevron-trail"
          d="M9 34l7 7 7-7"
          stroke-width="2.25"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </g>
    </svg>

    <div class="scroll-howto-text">
      <p class="scroll-howto-label">{{ t.howtoLabel }}</p>
      <p class="scroll-howto-body">{{ t.howtoScroll }}</p>
    </div>

    <button type="button" class="scroll-howto-close" :aria-label="t.close" @click="emit('dismiss')">×</button>
  </div>
</template>
