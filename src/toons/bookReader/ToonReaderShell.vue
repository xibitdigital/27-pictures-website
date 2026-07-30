<script setup lang="ts">
/**
 * Shared FlipFrame chrome for Erin, Jax, and future toons.
 * Owns view-mode, config load, strip, captions, and the Vue book surface.
 */
import { computed, onMounted, ref } from "vue";
import { useToonBook } from "./useToonBook";
import BookSurface from "./BookSurface.vue";
import { ReaderTopBar } from "./chrome";
import { useViewMode } from "./useViewMode";
import { createConfigLoader, resolveConfigUrl } from "./loadConfig";
import VerticalStrip from "./VerticalStrip.vue";
import type { ToonReaderShellExpose, ToonShellBookOptions } from "./types";

const props = withDefaults(
  defineProps<{
    altPrefix: string;
    frontCoverLogo?: string | null;
    coverTexture?: string | null;
    /**
     * Where the content-hashed toon config lives (required).
     * Prefer `toonConfigUrl("jax")` → `/toons/jax/config.<md5>.json`.
     * Relative names need `assetPageDir`. Resolved via VITE_ASSET_BASE when set.
     */
    configUrl: string;
    /**
     * Site directory for relative media paths under VITE_ASSET_BASE
     * (e.g. `/toons/jax/`). Required for CDN builds with relative `file` / audio.
     */
    assetPageDir?: string;
    /**
     * Paint hooks, cover sound, beforeStart, … — never page source or cover identity.
     * Shell always wins on getPages / altPrefix / logos / texture.
     */
    bookOptions?: ToonShellBookOptions;
    mobileDefault?: boolean;
  }>(),
  {
    mobileDefault: true,
  }
);

const emit = defineEmits<{
  "enter-scroll": [];
  "enter-book": [];
}>();

const readerEl = ref<HTMLElement | null>(null);

/** Vertical-strip page slots (tracked for caption re-paint). */
const stripSlots = ref<HTMLElement[]>([]);

/** Resolved fetch URL for config.json (same key as caption loaders should use). */
const resolvedConfigUrl = resolveConfigUrl(props.configUrl, props.assetPageDir);

const loadSharedPages = createConfigLoader(resolvedConfigUrl, {
  pageDir: props.assetPageDir,
});

const bookOpts = computed(() => ({
  ...props.bookOptions,
  altPrefix: props.altPrefix,
  frontCoverLogo: props.frontCoverLogo,
  coverTexture: props.coverTexture,
  getPages: loadSharedPages,
  async beforeStart() {
    await props.bookOptions?.beforeStart?.();
    refreshCaptions();
  },
}));

const { engine, getApi } = useToonBook(bookOpts.value);

/** engine.state is Vue reactive — bind directly. */
const highlightPulse = computed(() => engine.state.highlightPulse);

const viewMode = useViewMode({
  mobileDefault: props.mobileDefault,
  reader: readerEl,
  loadPages: loadSharedPages,
  onEnterScroll: () => {
    paintStripSlots();
    emit("enter-scroll");
  },
  onEnterBook: () => {
    paintBookCaptions();
    emit("enter-book");
  },
});

function paintBookCaptions(): void {
  // Slots re-notify via BookSlot watchers when models change; force a cover refresh.
  getApi()?.updateView(false);
}

function paintStripSlots(): void {
  const paint = props.bookOptions?.onPagePaint;
  if (!paint) return;
  for (const slot of stripSlots.value) {
    const n = Number(slot.dataset.pageNum);
    if (n) paint(slot, n);
  }
}

function refreshCaptions(): void {
  if (viewMode.isVertical.value) paintStripSlots();
  else paintBookCaptions();
}

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
  const same = prev.length === slots.length && prev.every((el, i) => el === slots[i]);
  if (!same) stripSlots.value = slots;
  paintStripSlots();
}

const soundEnabled = computed(() => !!props.bookOptions?.getSoundEnabled?.());

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

  <ReaderTopBar
    :is-vertical="viewMode.isVertical.value"
    :highlight-pulse="highlightPulse"
    :after-fullscreen-change="refreshCaptions"
    @toggle-view="onViewModeClick"
  >
    <template #start>
      <slot name="top-controls-start" />
    </template>
    <template #mid>
      <slot name="top-controls-mid" />
    </template>
  </ReaderTopBar>

  <main class="reader" id="main-content" ref="readerEl" role="main">
    <BookSurface
      :engine="engine"
      :alt-prefix="altPrefix"
      :cover-texture="coverTexture"
      :cover-title="bookOptions?.coverTitle ?? altPrefix"
      :cover-subtitle="bookOptions?.coverSubtitle ?? 'Experiment'"
      :front-cover-logo="frontCoverLogo"
      :sound-hint="bookOptions?.soundHint"
      :sound-enabled="soundEnabled"
      :back-href="bookOptions?.backHref"
      :back-label="bookOptions?.backLabel"
      :on-page-paint="bookOptions?.onPagePaint"
      :on-page-clear="bookOptions?.onPageClear"
      @sound-toggle="bookOptions?.onSoundToggle?.()"
    />

    <div class="vertical-strip" aria-label="Vertical page scroll" :hidden="!viewMode.isVertical.value">
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
