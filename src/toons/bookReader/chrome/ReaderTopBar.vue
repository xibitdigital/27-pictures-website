<script setup lang="ts">
/**
 * Shared top menu bar: start slot · view toggle · mid slot · fullscreen.
 * Toon-specific controls (lang, sound, music) go in the slots.
 */
import FullscreenButton from "./FullscreenButton.vue";
import ViewModeToggle from "./ViewModeToggle.vue";

defineProps<{
  isVertical: boolean;
  highlightPulse?: boolean;
  afterFullscreenChange?: () => void;
}>();

const emit = defineEmits<{
  "toggle-view": [];
}>();
</script>

<template>
  <div
    class="toon-top-controls"
    :class="{ 'is-highlight-pulse': highlightPulse }"
  >
    <slot name="start" />
    <ViewModeToggle :is-vertical="isVertical" @toggle="emit('toggle-view')" />
    <slot name="mid" />
    <FullscreenButton :after-change="afterFullscreenChange" />
  </div>
</template>
