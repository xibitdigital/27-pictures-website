<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useToonBook } from "../shared/useToonBook";
import { useViewMode } from "../shared/useViewMode";
import VerticalStrip from "../shared/VerticalStrip.vue";
import FullscreenButton from "../shared/FullscreenButton.vue";

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

const viewMode = useViewMode({
  mobileDefault: true,
  reader: readerEl,
});

useToonBook(
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
    altPrefix: "Erin",
    frontCoverLogo: "/logosquare.png",
    coverTexture: "/toons/assets/3d2d90aafc6ae28a9cb9f841a3b7183f.jpg",
  }
);

onMounted(() => {
  void viewMode.loadPages();
});

function onViewModeClick(): void {
  void viewMode.toggle();
}
</script>

<template>
  <a href="/experiments/" class="toons-back" title="Back to Experiments" aria-label="Back to Experiments">
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
    <FullscreenButton />
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
        alt-prefix="Erin"
      />
    </div>
  </main>
</template>
