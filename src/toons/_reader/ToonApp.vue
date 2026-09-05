<script setup lang="ts">
import { Music } from "@lucide/vue";
import { computed, onMounted, ref } from "vue";
import { resolveAssetUrl } from "../bookReader/assetUrl";
import LangSwitcher from "../bookReader/LangSwitcher.vue";
import { LikeButton, ShareButton } from "../bookReader/chrome";
import ToonReaderShell from "../bookReader/ToonReaderShell.vue";
import type { ToonShellBookOptions } from "../bookReader/types";
import { readerConfigUrl } from "../configUrls";
import { COVER } from "../coverCopy";
import type { EpisodeNav } from "../../site/catalogRender";

function readEpisodeNav(): EpisodeNav | null {
  const el = document.querySelector("script[data-episode-nav]");
  if (!el?.textContent?.trim()) return null;
  try {
    const parsed = JSON.parse(el.textContent) as EpisodeNav | null;
    return parsed && parsed.seriesTitle ? parsed : null;
  } catch {
    return null;
  }
}

const slug = document.documentElement.dataset.toonSlug || "";
const assetPageDir = document.documentElement.dataset.assetPageDir || `/toons/${slug}/`;
const cover = COVER[slug];
const COVER_TEXTURE = resolveAssetUrl("/toons/assets/9e8cbf85e48ac7eb7d1afd5981efb20f.jpg");
const isJax = slug === "jax";
const BG_MUSIC = isJax ? resolveAssetUrl("/toons/jax/assets/music/990f5db70e833cdaa0a411a9f0025275.mp3") : "";

const bgMusicEl = ref<HTMLAudioElement | null>(null);
const musicEnabled = ref(false);
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
  if (!bg.paused || musicEnabled.value) stopBgMusic();
  else void startBgMusic();
}

onMounted(() => {
  const bg = bgMusicEl.value;
  if (!bg) return;
  bg.volume = 0.22;
  bg.preload = "auto";
  try {
    bg.load();
  } catch {
    /* ignore */
  }
  bg.addEventListener("play", () => {
    musicEnabled.value = true;
  });
  bg.addEventListener("pause", () => {
    musicEnabled.value = false;
  });
});

const bookOptions: ToonShellBookOptions = {
  coverSubtitle: cover?.subtitle,
  coverSynopsis: cover?.synopsis,
  backNav: readEpisodeNav(),
};

const configUrl = slug ? readerConfigUrl(slug) : "";
</script>

<template>
  <ToonReaderShell
    v-if="slug && configUrl"
    :alt-prefix="slug"
    :config-url="configUrl"
    :asset-page-dir="assetPageDir"
    :toon-id="slug"
    front-cover-logo="/logosquare.png"
    :cover-texture="COVER_TEXTURE"
    :caption-lang-storage-key="`${slug}-toon-lang`"
    :book-options="bookOptions"
  >
    <template v-if="isJax" #overlays>
      <audio id="bgMusic" ref="bgMusicEl" :src="BG_MUSIC" loop preload="auto" aria-hidden="true" />
    </template>
    <template #top-controls-start>
      <LangSwitcher />
      <LikeButton :toon-id="slug" />
      <ShareButton />
    </template>
    <template v-if="isJax" #top-controls-mid>
      <button
        type="button"
        class="toon-fs-btn"
        :class="{ 'is-active': musicEnabled }"
        :aria-pressed="musicEnabled"
        :title="musicTitle"
        :aria-label="musicTitle"
        @click.stop="onMusicClick"
      >
        <Music aria-hidden="true" />
        <span class="toon-fs-label">{{ musicLabel }}</span>
      </button>
    </template>
  </ToonReaderShell>
</template>
