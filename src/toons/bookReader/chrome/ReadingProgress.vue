<script setup lang="ts">
/**
 * Fixed hairline progress bar pinned to the top of the reader.
 *
 * Replaces the old "3 / 20" page indicator: the same information, read as a
 * position rather than a number. `label` keeps the page count available to
 * screen readers via aria-valuetext, so dropping the visible text costs
 * nothing in accessibility.
 */
const props = withDefaults(
  defineProps<{
    /** 0–1 reading position. */
    value: number;
    /** Spoken position, e.g. "3 / 20". */
    label?: string;
  }>(),
  { label: "" }
);

const pct = (): number => Math.round(Math.min(1, Math.max(0, props.value)) * 1000) / 10;
</script>

<template>
  <div
    class="toon-progress"
    role="progressbar"
    aria-label="Reading progress"
    :aria-valuenow="pct()"
    aria-valuemin="0"
    aria-valuemax="100"
    :aria-valuetext="label || undefined"
  >
    <div class="toon-progress-fill" :style="{ transform: `scaleX(${Math.min(1, Math.max(0, value))})` }"></div>
  </div>
</template>
