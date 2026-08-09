<script setup lang="ts">
/**
 * One caption on a plate: bubble chrome (optional) + the text itself.
 * Click plays its SFX — and must stop there, or `.nav-zone` under the
 * layer treats the hit as a page turn.
 */
import BubbleChrome from "./BubbleChrome.vue";
import type { CaptionModel } from "./captionModel";

const props = defineProps<{
  caption: CaptionModel;
  speaking?: boolean;
}>();

const emit = defineEmits<{
  play: [caption: CaptionModel];
}>();

function onClick(ev: MouseEvent): void {
  ev.stopPropagation();
  if (props.caption.audio) emit("play", props.caption);
}
</script>

<template>
  <div
    :class="[caption.classes, { 'is-speaking': speaking }]"
    :style="caption.style"
    :data-tail="caption.tail ?? undefined"
    @click="onClick"
  >
    <BubbleChrome v-if="caption.bubble" :chrome="caption.bubble" :style="caption.bubbleStyle ?? undefined" />
    <span class="jax-word-text" :style="caption.textStyle">{{ caption.text }}</span>
  </div>
</template>
