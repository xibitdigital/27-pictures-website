<script setup lang="ts">
/**
 * Book ↔ vertical-scroll toggle in the reader top bar.
 */
import { BookOpen, ScrollText } from "@lucide/vue";
import { computed } from "vue";

const props = defineProps<{
  isVertical: boolean;
}>();

const emit = defineEmits<{
  toggle: [];
}>();

const title = computed(() => (props.isVertical ? "Switch to book view" : "Switch to vertical scroll view"));
const label = computed(() => (props.isVertical ? "Book" : "Scroll"));
const icon = computed(() => (props.isVertical ? BookOpen : ScrollText));
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
    <component :is="icon" aria-hidden="true" />
    <span class="toon-fs-label">{{ label }}</span>
  </button>
</template>
