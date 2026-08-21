<script setup lang="ts">
/**
 * Two hairline marks flanking the strip at the auto-read threshold.
 *
 * In scroll mode a caption speaks once its anchor enters the top
 * `FOCUS_BAND_END` of the viewport (`captions/visibility.ts`). That line was
 * invisible: lines start talking and nothing on screen says why, or how far to
 * scroll to trigger the next one. These mark it.
 *
 * Indicative only — no hit area, no text, and the parent mounts it only once
 * auto-read is unlocked, so it never promises audio the reader has not enabled.
 */
defineProps<{
  /** 0–1 fraction of the viewport, i.e. FOCUS_BAND_END. */
  bandEnd: number;
}>();
</script>

<template>
  <div class="autoread-band" data-autoread-band aria-hidden="true" :style="{ '--autoread-band-end': String(bandEnd) }">
    <span class="autoread-band-mark" />
    <span class="autoread-band-mark" />
  </div>
</template>
