<script setup lang="ts">
/**
 * One caption on a plate: bubble chrome (optional) + the text itself.
 *
 * Mobile scroll mode uses touch-action: pan-y on bubbles so flings still
 * work when a finger starts on a caption. That also cancels the synthetic
 * click after ~10–15px of movement — so play must not rely on click alone.
 * We treat pointerdown→up within TAP_SLOP as a tap (still allows real pans).
 */
import BubbleChrome from "./BubbleChrome.vue";
import type { CaptionModel } from "./captionModel";

/** Max finger movement (px) still counted as a tap, not a scroll. */
const TAP_SLOP_PX = 18;
/** Suppress double fire when pointerup is followed by a synthetic click. */
const DEDUPE_MS = 400;

const props = defineProps<{
  caption: CaptionModel;
  speaking?: boolean;
}>();

const emit = defineEmits<{
  play: [caption: CaptionModel];
}>();

let ptrId: number | null = null;
let startX = 0;
let startY = 0;
let lastPlayAt = 0;

function emitPlay(ev: Event): void {
  if (!props.caption.audio) return;
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  if (now - lastPlayAt < DEDUPE_MS) {
    ev.stopPropagation();
    if ("cancelable" in ev && ev.cancelable) ev.preventDefault();
    return;
  }
  lastPlayAt = now;
  // Stop page-turn nav-zones under the word layer (z-index 30 vs 35).
  ev.stopPropagation();
  if ("cancelable" in ev && ev.cancelable) ev.preventDefault();
  emit("play", props.caption);
}

function onPointerDown(ev: PointerEvent): void {
  if (!props.caption.audio) return;
  if (ev.isPrimary === false) return;
  if (ev.pointerType === "mouse" && ev.button !== 0) return;
  ptrId = ev.pointerId;
  startX = ev.clientX;
  startY = ev.clientY;
}

function onPointerUp(ev: PointerEvent): void {
  if (ptrId == null || ev.pointerId !== ptrId) return;
  ptrId = null;
  const dx = Math.abs(ev.clientX - startX);
  const dy = Math.abs(ev.clientY - startY);
  if (dx > TAP_SLOP_PX || dy > TAP_SLOP_PX) return;
  emitPlay(ev);
}

function onPointerCancel(ev: PointerEvent): void {
  if (ptrId != null && ev.pointerId === ptrId) ptrId = null;
}

function onClick(ev: Event): void {
  // Keyboard / non-pointer fallback; deduped if pointerup already played.
  emitPlay(ev);
}
</script>

<template>
  <div
    :class="[caption.classes, { 'is-speaking': speaking }]"
    :style="caption.style"
    :data-tail="caption.tail ?? undefined"
    :role="caption.audio ? 'button' : undefined"
    :tabindex="caption.audio ? 0 : undefined"
    :aria-label="caption.audio ? `Play ${caption.text}` : undefined"
    @pointerdown="onPointerDown"
    @pointerup="onPointerUp"
    @pointercancel="onPointerCancel"
    @click="onClick"
    @keydown.enter.prevent="onClick"
    @keydown.space.prevent="onClick"
  >
    <BubbleChrome v-if="caption.bubble" :chrome="caption.bubble" :style="caption.bubbleStyle ?? undefined" />
    <span class="jax-word-text" :style="caption.textStyle">{{ caption.text }}</span>
  </div>
</template>
