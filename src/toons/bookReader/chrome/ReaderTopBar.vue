<script setup lang="ts">
/**
 * Shared top menu bar: start slot · view toggle · mid slot · fullscreen.
 * Toon-specific controls (lang, sound, music) go in the slots.
 *
 * On narrow/mobile we hide the Book/Scroll toggle — book mode locks body
 * overflow and feels “frozen” on iPhone. Mobile always uses the vertical strip.
 */
import FullscreenButton from "./FullscreenButton.vue";
import ViewModeToggle from "./ViewModeToggle.vue";

withDefaults(
  defineProps<{
    isVertical: boolean;
    highlightPulse?: boolean;
    afterFullscreenChange?: () => void;
    /** Hide book↔scroll toggle (mobile / forced vertical). */
    hideViewToggle?: boolean;
  }>(),
  { hideViewToggle: false }
);

const emit = defineEmits<{
  "toggle-view": [];
}>();
</script>

<template>
  <div class="toon-top-controls" :class="{ 'is-highlight-pulse': highlightPulse }">
    <slot name="start" />
    <ViewModeToggle v-if="!hideViewToggle" :is-vertical="isVertical" @toggle="emit('toggle-view')" />
    <slot name="mid" />
    <FullscreenButton :after-change="afterFullscreenChange" />
  </div>
</template>
