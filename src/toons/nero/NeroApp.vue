<script setup lang="ts">
import { ref } from "vue";
import { resolveAssetUrl } from "../bookReader/assetUrl";
import { collectWordAudioUrls, preloadAudioUrls } from "../bookReader/audio/preloadAudio";
import { resolveConfigUrl } from "../bookReader/loadConfig";
import ToonReaderShell from "../bookReader/ToonReaderShell.vue";
import type { ToonShellBookOptions } from "../bookReader/types";
import { WordOverlay, loadWords } from "../bookReader/words";
import { toonConfigUrl } from "../configUrls";

const ASSET_PAGE_DIR = "/toons/nero/";
/** Content-hashed config from config-lock.json. */
const CONFIG_URL = toonConfigUrl("nero");
const COVER_TEXTURE = resolveAssetUrl("/toons/assets/3d2d90aafc6ae28a9cb9f841a3b7183f.jpg");

const wordOverlay = ref<WordOverlay | null>(null);

/** Stable options — shell owns page source; we paint captions like Jax. */
const bookOptions: ToonShellBookOptions = {
  coverSubtitle: "Sicario",
  onPagePaint(slot, pageNum) {
    wordOverlay.value?.render(slot, pageNum);
  },
  onPageClear(slot) {
    wordOverlay.value?.render(slot, null);
  },
  async beforeStart() {
    const wordsConfig = await loadWords(resolveConfigUrl(CONFIG_URL, ASSET_PAGE_DIR), ASSET_PAGE_DIR);
    wordOverlay.value = new WordOverlay(wordsConfig);
    void preloadAudioUrls(collectWordAudioUrls(wordsConfig));
  },
};
</script>

<template>
  <ToonReaderShell
    alt-prefix="Nero"
    :config-url="CONFIG_URL"
    :asset-page-dir="ASSET_PAGE_DIR"
    front-cover-logo="/logosquare.png"
    :cover-texture="COVER_TEXTURE"
    :book-options="bookOptions"
  />
</template>
