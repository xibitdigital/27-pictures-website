<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionChild,
  TransitionRoot,
} from "@headlessui/vue";
import { useToonBook } from "../shared/useToonBook";
import { useViewMode } from "../shared/useViewMode";
import VerticalStrip from "../shared/VerticalStrip.vue";
import FullscreenButton from "../shared/FullscreenButton.vue";
import { WordOverlay, loadWords } from "../shared/words";
import type { ToonBookApi } from "../shared/types";
import LangSwitcher from "./components/LangSwitcher.vue";

// ── Book engine refs ──
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
const bgMusicEl = ref<HTMLAudioElement | null>(null);

// ── Reactive chrome ──
const soundEnabled = ref(false);
const musicEnabled = ref(false);
const soundPromptVisible = ref(false);
let soundPromptShown = false;
const wordOverlay = ref<WordOverlay | null>(null);
/** Slots currently shown in the vertical strip (for caption re-paint). */
const stripSlots = ref<HTMLElement[]>([]);

window.__jaxSoundEnabled = false;

const soundTitle = computed(() =>
  soundEnabled.value ? "Mute sound" : "Enable sound effects"
);
const soundLabel = computed(() => (soundEnabled.value ? "Sound on" : "Sound"));
const musicTitle = computed(() =>
  musicEnabled.value ? "Pause music" : "Play music"
);
const musicLabel = computed(() => (musicEnabled.value ? "Music on" : "Music"));

/** Bumps on every stop so an in-flight play() cannot restart audio after off. */
let musicPlayGen = 0;

function setSoundEnabled(enabled: boolean): void {
  soundEnabled.value = enabled;
  window.__jaxSoundEnabled = enabled;
  if (enabled) {
    const confirm = new Audio("assets/sfx/83f9d2254039840ee2c9c109bc8eb2fb.mp3");
    confirm.play().catch(() => {});
    soundPromptVisible.value = false;
    soundPromptShown = true;
  }
  // Re-paint front cover so the engine-built sound button matches state.
  bookApi?.updateView(false);
}

window.__jaxSetSoundEnabled = setSoundEnabled;
window.__jaxMaybePromptSound = function maybePromptSound() {
  if (window.__jaxSoundEnabled) return;
  if (soundPromptShown) return;
  soundPromptShown = true;
  soundPromptVisible.value = true;
};

function onSoundClick(): void {
  setSoundEnabled(!soundEnabled.value);
}

function stopBgMusic(): void {
  musicPlayGen += 1;
  musicEnabled.value = false;
  const bg = bgMusicEl.value;
  if (!bg) return;
  try {
    bg.pause();
  } catch {
    /* ignore */
  }
  // muted is a hard stop on iOS/WebKit when pause alone is flaky mid-buffer.
  bg.muted = true;
}

async function startBgMusic(): Promise<void> {
  const bg = bgMusicEl.value;
  if (!bg) return;
  const gen = ++musicPlayGen;
  musicEnabled.value = true;
  bg.muted = false;
  try {
    await bg.play();
    // User turned music off while play() was still pending (large track).
    if (gen !== musicPlayGen) {
      try {
        bg.pause();
      } catch {
        /* ignore */
      }
      bg.muted = true;
    }
  } catch {
    // Autoplay / abort — keep UI honest.
    if (gen === musicPlayGen) musicEnabled.value = false;
  }
}

function onMusicClick(): void {
  const bg = bgMusicEl.value;
  if (!bg) return;
  // Prefer real element state so we always stop if audio is still audible,
  // even if the Vue flag drifted (e.g. failed play, interrupted promise).
  if (!bg.paused || musicEnabled.value) {
    stopBgMusic();
  } else {
    void startBgMusic();
  }
}

function enableSoundFromPrompt(): void {
  setSoundEnabled(true);
}

function dismissSoundPrompt(): void {
  soundPromptShown = true;
  soundPromptVisible.value = false;
}

function paintBook(): void {
  wordOverlay.value?.refreshSlots([slotLeft.value, slotRight.value]);
}

function paintStrip(): void {
  wordOverlay.value?.refreshSlots(stripSlots.value);
}

function onStripReady(slots: HTMLElement[]): void {
  // Avoid re-assigning an identical list (extra parent renders).
  const prev = stripSlots.value;
  const same =
    prev.length === slots.length && prev.every((el, i) => el === slots[i]);
  if (!same) stripSlots.value = slots;
  paintStrip();
}

/** Stable paint callback — do not inline in template (new fn each render). */
function onStripPagePaint(slot: HTMLElement, pageNum: number): void {
  wordOverlay.value?.render(slot, pageNum);
}

const viewMode = useViewMode({
  mobileDefault: true,
  reader: readerEl,
  onEnterScroll: paintStrip,
  onEnterBook: paintBook,
});

let bookApi: ToonBookApi | undefined;

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
    altPrefix: "Jax",
    frontCoverLogo: "/logosquare.png",
    coverTexture: "/toons/assets/3d2d90aafc6ae28a9cb9f841a3b7183f.jpg",
    soundHint: "Turn the sound on",
    getSoundEnabled: () => soundEnabled.value,
    onSoundToggle: () => setSoundEnabled(!soundEnabled.value),
    onPagePaint(slot, pageNum) {
      wordOverlay.value?.render(slot, pageNum);
    },
    onPageClear(slot) {
      wordOverlay.value?.render(slot, null);
    },
    async beforeStart() {
      const wordsConfig = await loadWords("words.json");
      wordOverlay.value = new WordOverlay(wordsConfig);
      if (viewMode.isVertical.value) paintStrip();
    },
  }
);

onMounted(() => {
  const bg = bgMusicEl.value;
  if (bg) {
    bg.volume = 0.22;
    // Keep the button in sync if the element pauses/plays outside our click handler.
    bg.addEventListener("play", () => {
      musicEnabled.value = true;
    });
    bg.addEventListener("pause", () => {
      musicEnabled.value = false;
    });
  }
  bookApi = getApi();
  void viewMode.loadPages();
});

function onLangChange(): void {
  if (viewMode.isVertical.value) paintStrip();
  else paintBook();
}

function onViewModeClick(): void {
  void viewMode.toggle();
}
</script>

<template>
  <audio
    id="bgMusic"
    ref="bgMusicEl"
    src="/toons/jax/assets/music/990f5db70e833cdaa0a411a9f0025275.mp3"
    loop
    preload="metadata"
    aria-hidden="true"
  />

  <TransitionRoot :show="soundPromptVisible" as="template">
    <Dialog class="sound-prompt-dialog" as="div" @close="dismissSoundPrompt">
      <TransitionChild
        as="template"
        enter="sound-prompt-enter"
        enter-from="sound-prompt-enter-from"
        enter-to="sound-prompt-enter-to"
        leave="sound-prompt-leave"
        leave-from="sound-prompt-leave-from"
        leave-to="sound-prompt-leave-to"
      >
        <div class="sound-prompt">
          <DialogPanel class="sound-prompt__panel">
            <svg
              class="sound-prompt__icon"
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.75"
              aria-hidden="true"
            >
              <path d="M4 9v6h4l5 4V5L8 9H4z" stroke-linecap="round" stroke-linejoin="round" />
              <path
                d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            <DialogTitle as="h2">Enable sound</DialogTitle>
            <p>This caption has audio. Turn sound on to hear dialogue, onomatopoeia, and SFX.</p>
            <div class="sound-prompt__actions">
              <button
                type="button"
                class="sound-prompt__btn sound-prompt__btn--primary"
                @click="enableSoundFromPrompt"
              >
                Enable sound
              </button>
              <button type="button" class="sound-prompt__btn" @click="dismissSoundPrompt">
                Not now
              </button>
            </div>
          </DialogPanel>
        </div>
      </TransitionChild>
    </Dialog>
  </TransitionRoot>

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
    <LangSwitcher :overlay="wordOverlay" @change="onLangChange" />
    <button
      type="button"
      class="toon-fs-btn"
      :class="{ 'is-active': soundEnabled }"
      :aria-pressed="soundEnabled"
      :title="soundTitle"
      :aria-label="soundTitle"
      @click="onSoundClick"
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
        <path d="M4 9v6h4l5 4V5L8 9H4z" stroke-linecap="round" stroke-linejoin="round" />
        <path
          class="toon-fs-sound-waves"
          d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      <span class="toon-fs-label">{{ soundLabel }}</span>
    </button>
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
    <button
      type="button"
      class="toon-fs-btn"
      :class="{ 'is-active': musicEnabled }"
      :aria-pressed="musicEnabled"
      :title="musicTitle"
      :aria-label="musicTitle"
      @click.stop="onMusicClick"
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
        <path
          d="M9 18V5l10-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm10-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      <span class="toon-fs-label">{{ musicLabel }}</span>
    </button>
    <FullscreenButton :after-change="paintBook" />
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
        alt-prefix="Jax"
        :on-page-paint="onStripPagePaint"
        @ready="onStripReady"
      />
    </div>
  </main>
</template>
