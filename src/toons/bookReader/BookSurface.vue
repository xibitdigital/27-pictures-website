<script setup lang="ts">
/**
 * Declarative FlipFrame surface: slots, flip leaf, nav chrome.
 * Bound to a BookEngine (no DOM mutation in TS).
 */
import { ref } from "vue";
import BookSlot from "./BookSlot.vue";
import FlipLeaf from "./FlipLeaf.vue";
import type { BookEngine } from "./bookReader";
import type { PageClearHandler, PagePaintHandler } from "./types";

const props = defineProps<{
  engine: BookEngine;
  altPrefix?: string;
  coverTexture?: string | null;
  coverTitle?: string;
  coverSubtitle?: string | null;
  frontCoverLogo?: string | null;
  soundHint?: string | null;
  soundEnabled?: boolean;
  backHref?: string;
  backLabel?: string;
  onPagePaint?: PagePaintHandler;
  onPageClear?: PageClearHandler;
}>();

const emit = defineEmits<{
  soundToggle: [];
}>();

const bookEl = ref<HTMLElement | null>(null);
let touchStartX = 0;

function onTouchStart(e: TouchEvent): void {
  touchStartX = e.touches[0]?.clientX ?? 0;
}
function onTouchEnd(e: TouchEvent): void {
  const x = e.changedTouches[0]?.clientX ?? touchStartX;
  const dx = x - touchStartX;
  if (Math.abs(dx) < 40) return;
  if (dx > 0) props.engine.goPrev();
  else props.engine.goNext();
}
</script>

<template>
  <div class="book-scene">
    <div class="book-shadow"></div>
    <div
      class="book"
      id="book"
      ref="bookEl"
      @touchstart.passive="onTouchStart"
      @touchend.passive="onTouchEnd"
    >
      <div class="spread" id="spread">
        <BookSlot
          side="left"
          :model="engine.state.leftSlot"
          :alt-prefix="altPrefix"
          :cover-texture="coverTexture"
          :cover-title="coverTitle"
          :cover-subtitle="coverSubtitle"
          :front-cover-logo="frontCoverLogo"
          :sound-hint="soundHint"
          :sound-enabled="soundEnabled"
          :back-href="backHref"
          :back-label="backLabel"
          :on-page-paint="onPagePaint"
          :on-page-clear="onPageClear"
          @sound-toggle="emit('soundToggle')"
        />
        <BookSlot
          side="right"
          :model="engine.state.rightSlot"
          :alt-prefix="altPrefix"
          :cover-texture="coverTexture"
          :cover-title="coverTitle"
          :cover-subtitle="coverSubtitle"
          :front-cover-logo="frontCoverLogo"
          :sound-hint="soundHint"
          :sound-enabled="soundEnabled"
          :back-href="backHref"
          :back-label="backLabel"
          :on-page-paint="onPagePaint"
          :on-page-clear="onPageClear"
          @sound-toggle="emit('soundToggle')"
        />
        <FlipLeaf
          v-if="engine.state.flip"
          :key="engine.state.flip.id"
          :flip="engine.state.flip"
          :cover-texture="coverTexture"
          :cover-title="coverTitle"
          :cover-subtitle="coverSubtitle"
          :front-cover-logo="frontCoverLogo"
          :alt-prefix="altPrefix"
          :sound-hint="soundHint"
          :sound-enabled="soundEnabled"
          :back-href="backHref"
          :back-label="backLabel"
          @done="engine.onFlipComplete()"
          @sound-toggle="emit('soundToggle')"
        />
        <div class="spine-glow"></div>
        <div class="spine"></div>
        <div
          class="nav-zone next"
          id="zone-next"
          title="Next page"
          @click="engine.goNext()"
        ></div>
        <div
          class="nav-zone prev"
          id="zone-prev"
          title="Previous page"
          @click="engine.goPrev()"
        ></div>
      </div>
    </div>
    <button
      class="reader-btn page-nav-btn prev"
      id="btn-prev"
      type="button"
      title="Previous page"
      aria-label="Previous page"
      :disabled="!engine.state.canPrev"
      @click="engine.goPrev()"
    >
      &#8592;
    </button>
    <button
      class="reader-btn page-nav-btn next"
      id="btn-next"
      type="button"
      title="Next page"
      aria-label="Next page"
      :disabled="!engine.state.canNext"
      @click="engine.goNext()"
    >
      &#8594;
    </button>
  </div>

  <div class="controls">
    <span class="page-indicator" id="indicator" aria-live="polite">{{
      engine.state.indicator
    }}</span>
  </div>
</template>
