<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from "@headlessui/vue";
import { resolveAssetUrl } from "../bookReader/assetUrl";
import ToonReaderShell from "../bookReader/ToonReaderShell.vue";
import { useSoundGate } from "../bookReader/audio/useSoundGate";
import { collectWordAudioUrls, preloadAudioUrls } from "../bookReader/audio/preloadAudio";
import { resolveConfigUrl } from "../bookReader/loadConfig";
import { WordOverlay, loadWords } from "../bookReader/words";
import type { ToonReaderShellExpose, ToonShellBookOptions } from "../bookReader/types";
import { toonConfigUrl } from "../configUrls";
import LangSwitcher from "./components/LangSwitcher.vue";

/** Reader media root — explicit pageDir for CDN relative paths. */
const ASSET_PAGE_DIR = "/toons/jax/";
/** Content-hashed config from config-lock.json (changes when config bytes change). */
const CONFIG_URL = toonConfigUrl("jax");
const COVER_TEXTURE = resolveAssetUrl("/toons/assets/3d2d90aafc6ae28a9cb9f841a3b7183f.jpg");
const CONFIRM_SFX = resolveAssetUrl("assets/sfx/83f9d2254039840ee2c9c109bc8eb2fb.mp3", ASSET_PAGE_DIR);
const BG_MUSIC = resolveAssetUrl("/toons/jax/assets/music/990f5db70e833cdaa0a411a9f0025275.mp3");

const shellRef = ref<ToonReaderShellExpose | null>(null);
const bgMusicEl = ref<HTMLAudioElement | null>(null);
const musicEnabled = ref(false);
const wordOverlay = ref<WordOverlay | null>(null);

/** Bumps on every stop so an in-flight play() cannot restart audio after off. */
let musicPlayGen = 0;

const {
  enabled: soundEnabled,
  promptVisible: soundPromptVisible,
  title: soundTitle,
  label: soundLabel,
  toggle: toggleSound,
  dismissPrompt,
  enableFromPrompt,
  onEngage: onSoundEngage,
  gate: soundGate,
} = useSoundGate({
  confirmSrc: CONFIRM_SFX,
  // First scroll (vertical mode) or page turn — once per mount, desktop + mobile.
  promptOnScroll: true,
  onChange: () => {
    // Re-paint front cover so the engine-built sound button matches state.
    shellRef.value?.repaintCover();
  },
});

const musicTitle = computed(() => (musicEnabled.value ? "Pause music" : "Play music"));
const musicLabel = computed(() => (musicEnabled.value ? "Music on" : "Music"));

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
    if (gen !== musicPlayGen) {
      try {
        bg.pause();
      } catch {
        /* ignore */
      }
      bg.muted = true;
    }
  } catch {
    if (gen === musicPlayGen) musicEnabled.value = false;
  }
}

function onMusicClick(): void {
  const bg = bgMusicEl.value;
  if (!bg) return;
  if (!bg.paused || musicEnabled.value) {
    stopBgMusic();
  } else {
    void startBgMusic();
  }
}

function onLangChange(): void {
  shellRef.value?.refreshCaptions();
}

/** Stable options — shell owns page source and cover identity. */
const bookOptions: ToonShellBookOptions = {
  coverSubtitle: "Cyberpunk Chronicles",
  soundHint: "Turn the sound on",
  getSoundEnabled: () => soundEnabled.value,
  onSoundToggle: () => toggleSound(),
  onPageTurn() {
    onSoundEngage();
  },
  onPagePaint(slot, pageNum) {
    wordOverlay.value?.render(slot, pageNum);
  },
  onPageClear(slot) {
    wordOverlay.value?.render(slot, null);
  },
  async beforeStart() {
    // Same resolved URL as ToonReaderShell → one shared config fetch.
    const wordsConfig = await loadWords(resolveConfigUrl(CONFIG_URL, ASSET_PAGE_DIR), ASSET_PAGE_DIR);
    wordOverlay.value = new WordOverlay(wordsConfig, { sound: soundGate });
    // Warm SFX + confirm beep in the background; don't block first paint.
    void preloadAudioUrls([CONFIRM_SFX, ...collectWordAudioUrls(wordsConfig)]);
    // Shell calls refreshCaptions after beforeStart.
  },
};

onMounted(() => {
  const bg = bgMusicEl.value;
  if (!bg) return;
  bg.volume = 0.22;
  // Full buffer, not just metadata — music starts without a network stall.
  bg.preload = "auto";
  try {
    bg.load();
  } catch {
    /* ignore */
  }
  // Don't also pin music in the shared preload cache — a second element on the
  // same 4MB src just competes for bandwidth/decoders on mobile; #bgMusic's own
  // preload="auto" + load() already warms it.
  bg.addEventListener("play", () => {
    musicEnabled.value = true;
  });
  bg.addEventListener("pause", () => {
    musicEnabled.value = false;
  });
});
</script>

<template>
  <ToonReaderShell
    ref="shellRef"
    alt-prefix="Jax"
    :config-url="CONFIG_URL"
    :asset-page-dir="ASSET_PAGE_DIR"
    front-cover-logo="/logosquare.png"
    :cover-texture="COVER_TEXTURE"
    :book-options="bookOptions"
  >
    <template #overlays>
      <audio id="bgMusic" ref="bgMusicEl" :src="BG_MUSIC" loop preload="auto" aria-hidden="true" />

      <TransitionRoot :show="soundPromptVisible" as="template">
        <Dialog class="sound-prompt-dialog" as="div" @close="dismissPrompt">
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
                <p>This comic has audio. Turn sound on to hear dialogue, onomatopoeia, and SFX.</p>
                <div class="sound-prompt__actions">
                  <button type="button" class="sound-prompt__btn sound-prompt__btn--primary" @click="enableFromPrompt">
                    Enable sound
                  </button>
                  <button type="button" class="sound-prompt__btn" @click="dismissPrompt">Not now</button>
                </div>
              </DialogPanel>
            </div>
          </TransitionChild>
        </Dialog>
      </TransitionRoot>
    </template>

    <template #top-controls-start>
      <LangSwitcher :overlay="wordOverlay" @change="onLangChange" />
      <button
        type="button"
        class="toon-fs-btn"
        :class="{ 'is-active': soundEnabled }"
        :aria-pressed="soundEnabled"
        :title="soundTitle"
        :aria-label="soundTitle"
        @click="toggleSound"
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
    </template>

    <template #top-controls-mid>
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
    </template>
  </ToonReaderShell>
</template>
