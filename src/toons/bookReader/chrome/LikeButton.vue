<script setup lang="ts">
/**
 * Heart toggle for the reader top bar. Sits beside LangSwitcher.
 *
 * The reader's own vote is remembered in localStorage; the running total comes
 * from the likes Worker and is only rendered with `?stats=true`, so a cold
 * counter never shows a discouraging "0" to ordinary readers.
 */
import { computed, onMounted, ref } from "vue";
import { statsEnabled, useToonLikes } from "../useToonLikes";

const props = defineProps<{
  /** Toon id the counter is keyed on (`jax`, `nero`, `redsmile-static`, …). */
  toonId: string;
}>();

const { liked, total, pending, toggle } = useToonLikes(props.toonId);
const showStats = ref(false);

// Query string is read on mount so SSR/tests never touch window at import time.
onMounted(() => {
  showStats.value = statsEnabled();
});

const label = computed(() => (liked.value ? "Liked" : "Like this toon"));
const countLabel = computed(() => (total.value == null ? "" : String(total.value)));
</script>

<template>
  <button
    type="button"
    class="toon-fs-btn toon-like-btn"
    :class="{ 'is-liked': liked, 'is-pending': pending, 'has-stats': showStats && countLabel !== '' }"
    :aria-pressed="liked"
    :title="label"
    :aria-label="label"
    @click="toggle"
  >
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      :fill="liked ? 'currentColor' : 'none'"
      stroke="currentColor"
      stroke-width="2"
      aria-hidden="true"
    >
      <path
        d="M12 20.4 4.6 13a4.6 4.6 0 0 1 0-6.5 4.6 4.6 0 0 1 6.5 0l.9.9.9-.9a4.6 4.6 0 0 1 6.5 0 4.6 4.6 0 0 1 0 6.5z"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
    <span class="toon-fs-label">{{ label }}</span>
    <!-- Stacked under the heart, so the bar keeps one icon per control. -->
    <span v-if="showStats && countLabel" class="toon-like-count" aria-hidden="true">{{ countLabel }}</span>
  </button>
</template>
