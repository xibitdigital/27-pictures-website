<script setup lang="ts">
/**
 * Shared FlipFrame chrome for Erin, Jax, and future toons.
 * Owns book DOM refs, view-mode, single manifest load, strip, and caption refresh.
 */
import { onMounted, ref } from "vue";
import { useToonBook } from "./useToonBook";
import { useViewMode } from "./useViewMode";
import { createManifestLoader } from "./loadManifest";
import VerticalStrip from "./VerticalStrip.vue";
import FullscreenButton from "./FullscreenButton.vue";
import type { ToonReaderShellExpose, ToonShellBookOptions } from "./types";

const props = withDefaults(
  defineProps<{
    altPrefix: string;
    frontCoverLogo?: string | null;
    coverTexture?: string | null;
    /**
     * Paint hooks, cover sound, beforeStart, … — never page source or cover identity.
     * Shell always wins on getPages / altPrefix / logos / texture.
     */
    bookOptions?: ToonShellBookOptions;
    manifestUrl?: string;
    mobileDefault?: boolean;
  }>(),
  {
    mobileDefault: true,
    manifestUrl: "manifest.json",
  }
);

const emit = defineEmits<{
  "enter-scroll": [];
  "enter-book": [];
}>();

const bookEl = ref<HTMLElement | null>(null);
const slotLeft = ref<HTMLElement | null>(null);
const slotRight = ref<HTMLElement | null>(null);
const indicator = ref<HTMLElement | null>(null);
const btnPrev = ref<HTMLButtonElement | null>(null);
const btnNext = ref<HTMLButtonElement | null>(null);
const zoneNext = ref<HTMLElement | null>(null);
const zonePrev = ref<HTMLElement | null>(null);
const topControls = ref<HTMLElement | null>(null);
const readerEl = ref<HTMLElement | null>(null);

/** Vertical-strip page slots (tracked for caption re-paint). */
const stripSlots = ref<HTMLElement[]>([]);

const loadSharedPages = createManifestLoader(props.manifestUrl);

function paintBookSlots(): void {
  const paint = props.bookOptions?.onPagePaint;
  const clear = props.bookOptions?.onPageClear;
  for (const slot of [slotLeft.value, slotRight.value]) {
    if (!slot) continue;
    const n = Number(slot.dataset.pageNum);
    if (n) paint?.(slot, n);
    else clear?.(slot);
  }
}

function paintStripSlots(): void {
  const paint = props.bookOptions?.onPagePaint;
  if (!paint) return;
  for (const slot of stripSlots.value) {
    const n = Number(slot.dataset.pageNum);
    if (n) paint(slot, n);
  }
}

/** Re-paint captions on whichever view is active. */
function refreshCaptions(): void {
  if (viewMode.isVertical.value) paintStripSlots();
  else paintBookSlots();
}

const viewMode = useViewMode({
  mobileDefault: props.mobileDefault,
  reader: readerEl,
  loadPages: loadSharedPages,
  onEnterScroll: () => {
    paintStripSlots();
    emit("enter-scroll");
  },
  onEnterBook: () => {
    paintBookSlots();
    emit("enter-book");
  },
});

const { getApi } = useToonBook(
  {
    book: bookEl,
    slotLeft,
    slotRight,
    indicator,
    btnPrev,
    btnNext,
    zoneNext,
    zonePrev,
    topControls,
  },
  {
    // Parent extras first — shell ownership fields always win after.
    ...props.bookOptions,
    altPrefix: props.altPrefix,
    frontCoverLogo: props.frontCoverLogo,
    coverTexture: props.coverTexture,
    getPages: loadSharedPages,
    async beforeStart() {
      await props.bookOptions?.beforeStart?.();
      // Words / overlays may have loaded; paint active view once.
      refreshCaptions();
    },
  }
);

function repaintCover(): void {
  getApi()?.updateView(false);
}

function onViewModeClick(): void {
  void viewMode.toggle();
}

function onStripPagePaint(slot: HTMLElement, pageNum: number): void {
  props.bookOptions?.onPagePaint?.(slot, pageNum);
}

function onStripReady(slots: HTMLElement[]): void {
  const prev = stripSlots.value;
  const same =
    prev.length === slots.length && prev.every((el, i) => el === slots[i]);
  if (!same) stripSlots.value = slots;
  paintStripSlots();
}

onMounted(() => {
  void viewMode.loadPages();
});

defineExpose<ToonReaderShellExpose>({
  refreshCaptions,
  repaintCover,
});
</script>

<template>
  <slot name="overlays" />

  <a
    href="/experiments/"
    class="toons-back"
    title="Back to Experiments"
    aria-label="Back to Experiments"
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
      <path d="M19 12H5M11 6l-6 6 6 6" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  </a>

  <div class="toon-top-controls" ref="topControls">
    <slot name="top-controls-start" />

    <button
      type="button"
      class="toon-fs-btn"
      :class="{ 'is-active': viewMode.isVertical.value }"
      :aria-pressed="viewMode.isVertical.value"
      :title="
        viewMode.isVertical.value ? 'Switch to book view' : 'Switch to vertical scroll view'
      "
      :aria-label="
        viewMode.isVertical.value ? 'Switch to book view' : 'Switch to vertical scroll view'
      "
      @click="onViewModeClick"
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
      <span class="toon-fs-label">{{ viewMode.isVertical.value ? "Book" : "Scroll" }}</span>
    </button>

    <slot name="top-controls-mid" />

    <FullscreenButton :after-change="refreshCaptions" />
  </div>

  <main class="reader" id="main-content" ref="readerEl" role="main">
    <div class="book-scene">
      <div class="book-shadow"></div>
      <div class="book" id="book" ref="bookEl">
        <div class="spread" id="spread">
          <div class="page-slot left" id="slot-left" ref="slotLeft"></div>
          <div class="page-slot right" id="slot-right" ref="slotRight"></div>
          <div class="spine-glow"></div>
          <div class="spine"></div>
          <div class="nav-zone next" id="zone-next" ref="zoneNext" title="Next page"></div>
          <div class="nav-zone prev" id="zone-prev" ref="zonePrev" title="Previous page"></div>
        </div>
      </div>
      <button
        class="reader-btn page-nav-btn prev"
        id="btn-prev"
        ref="btnPrev"
        type="button"
        title="Previous page"
        aria-label="Previous page"
      >
        &#8592;
      </button>
      <button
        class="reader-btn page-nav-btn next"
        id="btn-next"
        ref="btnNext"
        type="button"
        title="Next page"
        aria-label="Next page"
      >
        &#8594;
      </button>
    </div>

    <div class="controls">
      <span class="page-indicator" id="indicator" ref="indicator" aria-live="polite">…</span>
    </div>

    <div
      class="vertical-strip"
      aria-label="Vertical page scroll"
      :hidden="!viewMode.isVertical.value"
    >
      <VerticalStrip
        v-if="viewMode.isVertical.value && viewMode.pages.value.length"
        :pages="viewMode.pages.value"
        :alt-prefix="altPrefix"
        :on-page-paint="onStripPagePaint"
        @ready="onStripReady"
      />
    </div>
  </main>
</template>
