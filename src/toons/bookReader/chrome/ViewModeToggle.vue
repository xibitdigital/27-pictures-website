<script setup lang="ts">
/**
 * Book ↔ vertical-scroll toggle in the reader top bar.
 */
import { computed } from "vue";

const props = defineProps<{
  isVertical: boolean;
}>();

const emit = defineEmits<{
  toggle: [];
}>();

const title = computed(() => (props.isVertical ? "Switch to book view" : "Switch to vertical scroll view"));
const label = computed(() => (props.isVertical ? "Book" : "Scroll"));
</script>

<template>
  <button
    type="button"
    class="toon-fs-btn"
    :class="{ 'is-active': isVertical }"
    :aria-pressed="isVertical"
    :title="title"
    :aria-label="title"
    @click="emit('toggle')"
  >
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      aria-hidden="true"
    >
      <path d="M4 6h16M4 12h16M4 18h10" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
    <span class="toon-fs-label">{{ label }}</span>
  </button>
</template>
