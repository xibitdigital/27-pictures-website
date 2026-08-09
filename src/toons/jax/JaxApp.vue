<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { resolveAssetUrl } from "../bookReader/assetUrl";
import ToonReaderShell from "../bookReader/ToonReaderShell.vue";
import type { ToonShellBookOptions } from "../bookReader/types";
import LangSwitcher from "../bookReader/LangSwitcher.vue";
import { toonConfigUrl } from "../configUrls";

/** Reader media root — explicit pageDir for CDN relative paths. */
const ASSET_PAGE_DIR = "/toons/jax/";
/** Content-hashed config from config-lock.json (changes when config bytes change). */
const CONFIG_URL = toonConfigUrl("jax");
const COVER_TEXTURE = resolveAssetUrl("/toons/assets/3d2d90aafc6ae28a9cb9f841a3b7183f.jpg");
const BG_MUSIC = resolveAssetUrl("/toons/jax/assets/music/990f5db70e833cdaa0a411a9f0025275.mp3");

const bgMusicEl = ref<HTMLAudioElement | null>(null);
const musicEnabled = ref(false);

/** Bumps on every stop so an in-flight play() cannot restart audio after off. */
let musicPlayGen = 0;

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

/** Front-cover story — full manual in content/toons/jax/README.md */
const COVER_SYNOPSIS =
  "In a neon city that sells minds by the megacorp, Jax is a netrunner dying by inches: a rare sickness eats his body while his code still cuts like a blade. He does not rob banks — he steals mind-control tech from the corporations that build it, then turns their own weapons against the leash. A future Robin Hood in a trench coat and chrome, racing the clock inside his own skull: liberate the street, stay human long enough to finish the run.";

/** Stable options — shell owns page source, captions, and cover identity. */
const bookOptions: ToonShellBookOptions = {
  coverSubtitle: "Cyberpunk Chronicles",
  coverSynopsis: COVER_SYNOPSIS,
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
    alt-prefix="Jax"
    :config-url="CONFIG_URL"
    :asset-page-dir="ASSET_PAGE_DIR"
    front-cover-logo="/logosquare.png"
    :cover-texture="COVER_TEXTURE"
    :book-options="bookOptions"
  >
    <template #overlays>
      <audio id="bgMusic" ref="bgMusicEl" :src="BG_MUSIC" loop preload="auto" aria-hidden="true" />
    </template>

    <template #top-controls-start>
      <LangSwitcher />
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
