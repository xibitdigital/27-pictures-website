<script setup lang="ts">
/**
 * Shared FlipFrame chrome for Erin, Jax, and future toons.
 * Owns view-mode, config load, strip, captions, and the Vue book surface.
 */
import { computed, nextTick, onMounted, onUnmounted, ref, toRef, watch } from "vue";
import { useToonBook } from "./useToonBook";
import BookSurface from "./BookSurface.vue";
import CoverGuideDialog from "./CoverGuideDialog.vue";
import { AutoReadBand, ReaderTopBar, ReadingProgress } from "./chrome";
import { useViewMode } from "./useViewMode";
import { createConfigLoader, resolveConfigUrl } from "./loadConfig";
import { deepLinkReleased, parsePageQuery, visiblePageNum, writePageQuery, type SlotBox } from "./pageQuery";
import VerticalStrip from "./VerticalStrip.vue";
import AutoReadPrompt from "./captions/AutoReadPrompt.vue";
import { FOCUS_BAND_END, provideAutoRead } from "./captions/useAutoRead";
import { writeProgress } from "./readingProgress";
import { provideToonCaptions } from "./captions/useToonCaptions";
import type { ToonReaderShellExpose, ToonShellBookOptions } from "./types";
import { prefersSinglePage } from "./bookModels";
import { localePath, withCaptionLang } from "../../site/i18n";
import { resolveReaderLocale } from "./flipframeCopy";
import ScrollHowToHint from "./ScrollHowToHint.vue";
import { SCROLL_HOWTO_DISMISS_PX, hasSeenScrollHowTo, markScrollHowToSeen, shouldShowScrollHowTo } from "./scrollHowTo";

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
    /**
     * Which view a reader opens in. Defaults to `"scroll"` at every width.
     *
     * A plate is a single image: in book mode panel 3 is on screen the moment
     * panel 1 is, so the page's own payoff is spoiled before the reader gets
     * there. The strip is what withholds it — the fold is the reveal. Pass
     * `"book"` for a toon whose pages are composed as spreads rather than as
     * top-to-bottom beats.
     */
    defaultView?: "scroll" | "book";
    /** localStorage key for caption language; defaults to `<altPrefix>-toon-lang`. */
    captionLangStorageKey?: string;
    /** Silence between auto-read caption clips, in ms. */
    autoReadGapMs?: number;
    /**
     * Toon id (matches content/toons/<id>/). Set it and the reader remembers
     * the page locally, which is what feeds "continue reading" on /toons/.
     */
    toonId?: string;
  }>(),
  {
    mobileDefault: true,
    defaultView: "scroll",
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
  defaultVertical: props.defaultView !== "book",
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
/**
 * The deep link must stop fighting the reader.
 *
 * This function is called from several places (strip ready, guide close, pages
 * loaded) and each call schedules retries plus an image `load` hook, because a
 * plate that has not decoded yet has no height to scroll to. On a phone those
 * retries kept landing *after* the first swipe: measured on an iPhone
 * simulator, six `scrollTo(0, 32)` calls yanked the strip back to the `?page=`
 * target while plates streamed in, which reads as "the page will not scroll".
 *
 * So: re-applies are allowed only until the reader scrolls somewhere else.
 */
let deepLinkAbandoned = false;
let deepLinkAppliedY: number | null = null;
const deepLinkTimers: ReturnType<typeof setTimeout>[] = [];

function clearDeepLinkTimers(): void {
  for (const t of deepLinkTimers.splice(0)) clearTimeout(t);
}

/** One genuine scroll away from the target and the deep link is done. */
function abandonDeepLink(): void {
  if (deepLinkAbandoned) return;
  deepLinkAbandoned = true;
  deepLinkAppliedY = null;
  clearDeepLinkTimers();
}

function scrollVerticalToQueryPage(): void {
  if (deepLinkAbandoned) return;
  if (!viewMode.isVertical.value) return;
  const page = parsePageQuery();
  if (page == null) return;
  // The strip hands us its slot elements on ready — no DOM lookup, and no
  // dependency on what those slots happen to be called in CSS.
  const el = stripSlots.value.find((slot) => slot.dataset.pageNum === String(page));
  if (!el) return;

  const apply = (): void => {
    if (deepLinkAbandoned || !viewMode.isVertical.value) return;
    const top = el.getBoundingClientRect().top + (window.scrollY || window.pageYOffset || 0);
    const target = Math.max(0, top - 4);
    deepLinkAppliedY = target;
    window.scrollTo(0, target);
  };

  const img = el.querySelector("img");
  if (img && !img.complete) {
    img.addEventListener(
      "load",
      () => {
        if (deepLinkAbandoned) return;
        requestAnimationFrame(() => {
          apply();
          deepLinkTimers.push(setTimeout(apply, 50));
        });
      },
      { once: true }
    );
  }

  requestAnimationFrame(() => {
    apply();
    // Images that were already cached still reflow a frame later.
    deepLinkTimers.push(setTimeout(apply, 80));
    deepLinkTimers.push(setTimeout(apply, 320));
  });
}

/**
 * Called from the throttled scroll handler: if the position is more than a
 * plate-reflow's worth away from what we last set, the reader moved it, not us.
 */
function noticeScrollAwayFromDeepLink(): void {
  if (deepLinkAbandoned) return;
  if (!deepLinkReleased(deepLinkAppliedY, currentScrollY())) return;
  abandonDeepLink();
}

const soundEnabled = computed(() => !!props.bookOptions?.getSoundEnabled?.());

/** Mobile / narrow UI — cover guide is a recallable popup (no full cover leaf in scroll mode). */
const isMobileUi = ref(false);
const guideOpen = ref(false);
const scrollHowToOpen = ref(false);
/** Scroll offset the toast opened at — it stays put until the reader moves. */
let scrollHowToShownAtY = 0;

function currentScrollY(): number {
  return window.scrollY || window.pageYOffset || 0;
}

function dismissScrollHowTo(): void {
  scrollHowToOpen.value = false;
}

function maybeShowScrollHowTo(): void {
  if (
    !shouldShowScrollHowTo({
      seen: hasSeenScrollHowTo() || scrollHowToOpen.value,
      vertical: viewMode.isVertical.value,
      guideOpen: guideOpen.value,
      promptOpen: autoRead.promptOpen.value,
    })
  ) {
    return;
  }
  markScrollHowToSeen();
  scrollHowToShownAtY = currentScrollY();
  scrollHowToOpen.value = true;
}

/**
 * Freeze the strip behind an open dialog.
 *
 * reader-shared.css unfreezes vertical mode with `overflow-y: visible
 * !important` — it has to, because HeadlessUI leaves an inline `overflow:
 * hidden` on <html> behind after a dialog closes, which froze the reader. That
 * !important also beats HeadlessUI's lock while the dialog is *open*, so the
 * 16k-tall strip stayed scrollable underneath it. `body.dialog-open` re-locks
 * from the stylesheet side, where it can out-specify those rules.
 */
const dialogOpen = computed(() => guideOpen.value || autoRead.promptOpen.value);

let bodyLocked = false;

function lockBodyForDialog(): void {
  if (bodyLocked) return;
  document.body.classList.add("dialog-open");
  bodyLocked = true;
}

function unlockBodyForDialog(): void {
  if (!bodyLocked) return;
  bodyLocked = false;
  document.body.classList.remove("dialog-open");
}

watch(dialogOpen, (locked) => (locked ? lockBodyForDialog() : unlockBodyForDialog()), { immediate: true });

/** No timer: the toast is the answer to "what do I do", so it waits for the doing. */
function notifyScrollHowToScroll(): void {
  if (!scrollHowToOpen.value) return;
  if (Math.abs(currentScrollY() - scrollHowToShownAtY) < SCROLL_HOWTO_DISMISS_PX) return;
  scrollHowToOpen.value = false;
}

const coverTitle = computed(() => props.bookOptions?.coverTitle ?? props.altPrefix);
const coverSubtitle = computed(() => props.bookOptions?.coverSubtitle ?? null);
const coverSynopsis = computed(() => props.bookOptions?.coverSynopsis ?? null);

/** Same language as captions / the landing they came from — not the English reader URL. */
const readerLocale = computed(() => resolveReaderLocale(captions));
const toonsHubHref = computed(() => localePath("/toons/", readerLocale.value));
const backHref = computed(() => localePath(props.bookOptions?.backHref ?? "/toons/", readerLocale.value));
const backNav = computed(() => {
  const nav = props.bookOptions?.backNav;
  if (!nav) return null;
  const loc = readerLocale.value;
  return {
    ...nav,
    prev: nav.prev ? { ...nav.prev, href: withCaptionLang(nav.prev.href, loc) } : undefined,
    next: nav.next ? { ...nav.next, href: nav.next.href ? withCaptionLang(nav.next.href, loc) : undefined } : undefined,
  };
});

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
      maybeShowScrollHowTo();
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
    maybeShowScrollHowTo();
  });
}

function onAutoReadDismiss(): void {
  autoRead.dismissPrompt();
  releaseBodyScrollLock();
  maybeShowScrollHowTo();
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

/**
 * Reading position for the top bar. Book mode reads the engine's view index;
 * scroll mode has no view index, so it tracks document scroll instead.
 */
const scrollProgress = ref(0);

function syncScrollProgress(): void {
  const doc = document.documentElement;
  const span = doc.scrollHeight - window.innerHeight;
  scrollProgress.value = span > 0 ? Math.min(1, Math.max(0, window.scrollY / span)) : 0;
}

const readingProgress = computed(() => (viewMode.isVertical.value ? scrollProgress.value : engine.state.progress));

const readingProgressLabel = computed(() => (viewMode.isVertical.value ? "" : engine.state.indicator));

/**
 * Mirror the scrolled position into `?page=N`.
 *
 * The flip engine writes the param as the spread changes, but the strip has no
 * view index, so in scroll mode nothing wrote it at all: the address bar kept
 * whatever page the document was loaded with. That also froze `rememberPosition`
 * — it reads the query — so "continue reading" on /toons/ never advanced either.
 * Now that scroll is the default view, both were broken for every reader.
 */
function syncScrollPageQuery(): void {
  if (!viewMode.isVertical.value) return;
  const boxes: SlotBox[] = [];
  for (const slot of stripSlots.value) {
    if (!slot) continue;
    const r = slot.getBoundingClientRect();
    boxes.push({ pageNum: Number.parseInt(slot.dataset.pageNum ?? "", 10), top: r.top, bottom: r.bottom });
  }
  const page = visiblePageNum(boxes, window.innerHeight / 2);
  if (page != null) writePageQuery(page);
}

/**
 * Remember the page locally. Both view modes agree on `?page=<n>` — the engine
 * writes it as the spread changes, `syncScrollPageQuery` as the strip moves —
 * so that query stays the single source, with no second one to keep in step.
 */
function rememberPosition(): void {
  if (!props.toonId) return;
  const pages = engine.state.pages.length;
  const page = parsePageQuery(window.location.search);
  if (!pages || !page) return;
  writeProgress(props.toonId, page, pages);
}

// Book mode: the spread index is the page change worth recording.
watch(() => engine.state.viewIndex, rememberPosition);

const onWindowScroll = throttleTrailing(() => {
  syncScrollProgress();
  syncScrollPageQuery();
  rememberPosition();
  noticeScrollAwayFromDeepLink();
  notifyScrollHowToScroll();
  if (!viewMode.isVertical.value) return;
  autoRead.notifyScroll();
}, 32);

onMounted(() => {
  syncMobileUi();
  syncScrollProgress();
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
    maybeShowScrollHowTo();
  });

  void viewMode.loadPages().then(async () => {
    await nextTick();
    scrollVerticalToQueryPage();
  });
});

onUnmounted(() => {
  window.removeEventListener("scroll", onWindowScroll);
  onWindowScroll.cancel();
  clearDeepLinkTimers();
  unlockBodyForDialog();
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

  <!-- Back to the lab, not the homepage: the reader is reached from /toons/.
       Keep the locale they were reading in (/fr/toons/), or rememberDocumentLocale
       on the English hub would overwrite it. -->
  <a
    :href="toonsHubHref"
    class="toons-back"
    title="27 Pictures — Experiments"
    aria-label="27 Pictures - Back to Experiments"
  >
    <img
      src="/logosquare.png"
      class="nav-logo-img toons-back-logo"
      alt="27 Pictures"
      title="27 Pictures - Horror Film Production Studio"
      height="40"
      width="40"
    />
  </a>

  <ReadingProgress :value="readingProgress" :label="readingProgressLabel" />

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

  <ScrollHowToHint :open="scrollHowToOpen" @dismiss="dismissScrollHowTo" />

  <!-- Where a caption starts speaking. Scroll mode only: book mode's band is
       the whole viewport, so there is no line to draw. -->
  <AutoReadBand v-if="viewMode.isVertical.value && autoRead.unlocked.value" :band-end="FOCUS_BAND_END" />

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
      :back-href="backHref"
      :back-label="bookOptions?.backLabel"
      :back-nav="backNav"
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
