<script setup lang="ts">
/**
 * Shared FlipFrame chrome for Erin, Jax, and future toons.
 * Owns view-mode, config load, strip, captions, and the Vue book surface.
 */
import { computed, nextTick, onMounted, onUnmounted, ref, toRef } from "vue";
import { useToonBook } from "./useToonBook";
import BookSurface from "./BookSurface.vue";
import CoverGuideDialog from "./CoverGuideDialog.vue";
import { ReaderTopBar } from "./chrome";
import { useViewMode } from "./useViewMode";
import { createConfigLoader, resolveConfigUrl } from "./loadConfig";
import { parsePageQuery } from "./pageQuery";
import VerticalStrip from "./VerticalStrip.vue";
import AutoReadPrompt from "./captions/AutoReadPrompt.vue";
import { provideAutoRead } from "./captions/useAutoRead";
import { provideToonCaptions } from "./captions/useToonCaptions";
import type { ToonReaderShellExpose, ToonShellBookOptions } from "./types";
import { prefersSinglePage } from "./bookModels";

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
    /** localStorage key for caption language; defaults to `<altPrefix>-toon-lang`. */
    captionLangStorageKey?: string;
    /** Silence between auto-read caption clips, in ms. */
    autoReadGapMs?: number;
  }>(),
  {
    mobileDefault: true,
    autoReadGapMs: 600,
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

/** Captions + auto-read live in components — slots inject these. */
const captions = provideToonCaptions({
  configUrl: resolvedConfigUrl,
  pageDir: props.assetPageDir,
  langStorageKey: props.captionLangStorageKey || `${props.altPrefix.toLowerCase()}-toon-lang`,
});
const autoRead = provideAutoRead({ gapMs: props.autoReadGapMs });
/** Nested ref — bind via toRef so the dialog stays reactive. */
const autoReadPromptOpen = toRef(autoRead, "promptOpen");

const bookOpts = computed(() => ({
  ...props.bookOptions,
  altPrefix: props.altPrefix,
  frontCoverLogo: props.frontCoverLogo,
  coverTexture: props.coverTexture,
  getPages: loadSharedPages,
  async beforeStart() {
    await Promise.all([props.bookOptions?.beforeStart?.(), captions.load()]);
  },
}));

const { engine, getApi } = useToonBook(bookOpts.value);

/** engine.state is Vue reactive — bind directly. */
const highlightPulse = computed(() => engine.state.highlightPulse);

const viewMode = useViewMode({
  mobileDefault: props.mobileDefault,
  reader: readerEl,
  loadPages: loadSharedPages,
  onEnterScroll: () => emit("enter-scroll"),
  onEnterBook: () => emit("enter-book"),
});

/**
 * Captions are components now — they re-measure themselves on resize and
 * follow the language reactively. Kept so parents/chrome can force the book
 * view to re-evaluate (e.g. after leaving fullscreen).
 */
function refreshCaptions(): void {
  if (!viewMode.isVertical.value) getApi()?.updateView(false);
}

function repaintCover(): void {
  getApi()?.updateView(false);
}

function onViewModeClick(): void {
  // Mobile book mode locks overflow and feels frozen — keep the strip.
  if (isMobileUi.value) {
    void viewMode.setVertical(true);
    return;
  }
  void viewMode.toggle();
}

function onStripReady(slots: HTMLElement[]): void {
  const prev = stripSlots.value;
  const same = prev.length === slots.length && prev.every((el, i) => el === slots[i]);
  if (!same) stripSlots.value = slots;
  // Deep-link: scroll vertical strip to ?page=N once slots exist
  scrollVerticalToQueryPage();
}

/**
 * iOS Safari / HeadlessUI: Dialog leaves body with overflow:hidden + position
 * fixed, which freezes the whole page after “Start reading”. Clear always.
 */
function releaseBodyScrollLock(): void {
  const b = document.body;
  const h = document.documentElement;
  b.style.removeProperty("overflow");
  b.style.removeProperty("position");
  b.style.removeProperty("top");
  b.style.removeProperty("left");
  b.style.removeProperty("right");
  b.style.removeProperty("width");
  b.style.removeProperty("padding-right");
  h.style.removeProperty("overflow");
}

/**
 * Scroll vertical mode to 1-based content page from `?page=`.
 *
 * Vertical mode scrolls the *window* (see reader-shared.css). Nested body
 * scrollports freeze touch on iPhone. Retry after the target plate's image
 * has height so deep-links don't stick at the top of an empty strip.
 */
function scrollVerticalToQueryPage(): void {
  if (!viewMode.isVertical.value) return;
  const page = parsePageQuery();
  if (page == null) return;
  const root = readerEl.value;
  if (!root) return;
  const el = root.querySelector(`.vertical-page.page-slot[data-page-num="${page}"]`) as HTMLElement | null;
  if (!el) return;

  const apply = (): void => {
    if (!viewMode.isVertical.value) return;
    const top = el.getBoundingClientRect().top + (window.scrollY || window.pageYOffset || 0);
    window.scrollTo(0, Math.max(0, top - 4));
  };

  const img = el.querySelector("img");
  if (img && !img.complete) {
    img.addEventListener(
      "load",
      () => {
        requestAnimationFrame(() => {
          apply();
          window.setTimeout(apply, 50);
        });
      },
      { once: true }
    );
  }

  requestAnimationFrame(() => {
    apply();
    // Images that were already cached still reflow a frame later.
    window.setTimeout(apply, 80);
    window.setTimeout(apply, 320);
  });
}

const soundEnabled = computed(() => !!props.bookOptions?.getSoundEnabled?.());

/** Mobile / narrow UI — cover guide is a recallable popup (no full cover leaf in scroll mode). */
const isMobileUi = ref(false);
const guideOpen = ref(false);

const coverTitle = computed(() => props.bookOptions?.coverTitle ?? props.altPrefix);
const coverSubtitle = computed(() => props.bookOptions?.coverSubtitle ?? "Experiment");
const coverSynopsis = computed(() => props.bookOptions?.coverSynopsis ?? null);

function guideStorageKey(): string {
  return `flipframe-cover-guide:${props.altPrefix}`;
}

function openGuide(): void {
  guideOpen.value = true;
}

function onGuideOpenUpdate(open: boolean): void {
  guideOpen.value = open;
  if (!open && typeof sessionStorage !== "undefined") {
    try {
      sessionStorage.setItem(guideStorageKey(), "1");
    } catch {
      /* ignore */
    }
  }
  // Story popup blocked the first paint — re-apply ?page= deep-link after close.
  if (!open) {
    releaseBodyScrollLock();
    void nextTick(() => {
      releaseBodyScrollLock();
      scrollVerticalToQueryPage();
      // After Story, invite one click so browser autoplay unlocks for captions.
      autoRead.maybeShowPrompt();
    });
  }
}

function onAutoReadEnable(): void {
  autoRead.enableFromPrompt();
  releaseBodyScrollLock();
  // Single post-dialog reflow kick (controller does not schedule a second one).
  void nextTick(() => {
    releaseBodyScrollLock();
    autoRead.kick();
  });
}

function onAutoReadDismiss(): void {
  autoRead.dismissPrompt();
  releaseBodyScrollLock();
}

function syncMobileUi(): void {
  isMobileUi.value = prefersSinglePage();
}

let mobileMq: MediaQueryList | null = null;
function onMobileMq(): void {
  syncMobileUi();
}

/**
 * Vertical-strip scroll → auto-read pause.
 * Throttled: flings fire 100+ scroll events/s; notifyScroll must stay cheap.
 */
function throttleTrailing(fn: () => void, waitMs: number): (() => void) & { cancel: () => void } {
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const wrapped = (): void => {
    const now = Date.now();
    const remaining = waitMs - (now - last);
    if (remaining <= 0) {
      if (timer != null) {
        clearTimeout(timer);
        timer = null;
      }
      last = now;
      fn();
      return;
    }
    if (timer == null) {
      timer = setTimeout(() => {
        timer = null;
        last = Date.now();
        fn();
      }, remaining);
    }
  };
  wrapped.cancel = (): void => {
    if (timer != null) clearTimeout(timer);
    timer = null;
  };
  return wrapped;
}

const onWindowScroll = throttleTrailing(() => {
  if (!viewMode.isVertical.value) return;
  autoRead.notifyScroll();
}, 32);

onMounted(() => {
  syncMobileUi();
  mobileMq = window.matchMedia("(max-width: 768px)");
  if (typeof mobileMq.addEventListener === "function") {
    mobileMq.addEventListener("change", onMobileMq);
  } else {
    mobileMq.addListener(onMobileMq);
  }

  window.addEventListener("scroll", onWindowScroll, { passive: true });

  // Auto-show story/guide once per session on mobile (or vertical scroll).
  void nextTick(() => {
    if (!isMobileUi.value && !viewMode.isVertical.value) {
      // Desktop book: no Story modal — still need one click for caption audio.
      autoRead.maybeShowPrompt();
      return;
    }
    let seen = false;
    try {
      seen = sessionStorage.getItem(guideStorageKey()) === "1";
    } catch {
      seen = false;
    }
    if (!seen) guideOpen.value = true;
    else autoRead.maybeShowPrompt();
  });

  void viewMode.loadPages().then(async () => {
    await nextTick();
    scrollVerticalToQueryPage();
  });
});

onUnmounted(() => {
  window.removeEventListener("scroll", onWindowScroll);
  onWindowScroll.cancel();
  autoRead.stop();
  if (!mobileMq) return;
  if (typeof mobileMq.removeEventListener === "function") {
    mobileMq.removeEventListener("change", onMobileMq);
  } else if (mobileMq.removeListener) {
    mobileMq.removeListener(onMobileMq);
  }
});

defineExpose<ToonReaderShellExpose>({
  refreshCaptions,
  repaintCover,
});
</script>

<template>
  <slot name="overlays" />

  <a href="/" class="toons-back" title="27 Pictures" aria-label="27 Pictures - Return to homepage">
    <img
      src="/logo.png"
      class="nav-logo-img toons-back-logo"
      alt="27 Pictures"
      title="27 Pictures - Horror Film Production Studio"
      height="40"
      width="40"
    />
  </a>

  <ReaderTopBar
    :is-vertical="viewMode.isVertical.value"
    :highlight-pulse="highlightPulse"
    :after-fullscreen-change="refreshCaptions"
    :hide-view-toggle="isMobileUi"
    @toggle-view="onViewModeClick"
  >
    <template #start>
      <slot name="top-controls-start" />
      <button
        v-if="isMobileUi || viewMode.isVertical.value"
        type="button"
        class="toon-fs-btn cover-guide-toolbar-btn"
        title="Story & guide"
        aria-label="Story and guide"
        @click="openGuide"
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
          <path d="M4 5h16v14H4z" stroke-linejoin="round" />
          <path d="M8 9h8M8 13h5" stroke-linecap="round" />
        </svg>
        <span class="toon-fs-label">Story</span>
      </button>
    </template>
    <template #mid>
      <slot name="top-controls-mid" />
    </template>
  </ReaderTopBar>

  <CoverGuideDialog
    :open="guideOpen"
    :title="coverTitle"
    :subtitle="coverSubtitle"
    :synopsis="coverSynopsis"
    @update:open="onGuideOpenUpdate"
  />

  <AutoReadPrompt
    :open="autoReadPromptOpen && !guideOpen"
    @update:open="(v) => !v && onAutoReadDismiss()"
    @enable="onAutoReadEnable"
    @dismiss="onAutoReadDismiss"
  />

  <main class="reader" id="main-content" ref="readerEl" role="main">
    <BookSurface
      :engine="engine"
      :alt-prefix="altPrefix"
      :cover-texture="coverTexture"
      :cover-title="coverTitle"
      :cover-subtitle="coverSubtitle"
      :cover-synopsis="coverSynopsis"
      :front-cover-logo="frontCoverLogo"
      :sound-hint="bookOptions?.soundHint"
      :sound-enabled="soundEnabled"
      :back-href="bookOptions?.backHref"
      :back-label="bookOptions?.backLabel"
      @sound-toggle="bookOptions?.onSoundToggle?.()"
    />

    <div class="vertical-strip" aria-label="Vertical page scroll" :hidden="!viewMode.isVertical.value">
      <VerticalStrip
        v-if="viewMode.isVertical.value && viewMode.pages.value.length"
        :pages="viewMode.pages.value"
        :alt-prefix="altPrefix"
        @ready="onStripReady"
      />
    </div>
  </main>
</template>
