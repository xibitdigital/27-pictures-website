<script setup lang="ts">
import { resolveAssetUrl } from "../bookReader/assetUrl";
import LangSwitcher from "../bookReader/LangSwitcher.vue";
import { LikeButton } from "../bookReader/chrome";
import ToonReaderShell from "../bookReader/ToonReaderShell.vue";
import type { ToonShellBookOptions } from "../bookReader/types";
import { toonConfigUrl } from "../configUrls";
import { COVER } from "../coverCopy";

// A CDN key prefix, not a site route. The reader moved to /toons/nero-the-dog/
// when Nero became a series, but the plates are still keyed
// toons/nero/assets/<md5> on R2 — changing this 404s every page.
const ASSET_PAGE_DIR = "/toons/nero/";
/** Content-hashed config from config-lock.json. */
const CONFIG_URL = toonConfigUrl("nero");
const COVER_TEXTURE = resolveAssetUrl("/toons/assets/9e8cbf85e48ac7eb7d1afd5981efb20f.jpg");

/** Stable options — shell owns page source, captions, and cover identity. */
const bookOptions: ToonShellBookOptions = {
  coverSubtitle: COVER.nero.subtitle,
  coverSynopsis: COVER.nero.synopsis,
};
</script>

<template>
  <ToonReaderShell
    alt-prefix="Nero"
    :config-url="CONFIG_URL"
    :asset-page-dir="ASSET_PAGE_DIR"
    toon-id="nero"
    front-cover-logo="/logosquare.png"
    :cover-texture="COVER_TEXTURE"
    :book-options="bookOptions"
  >
    <template #top-controls-start>
      <LangSwitcher />
      <LikeButton toon-id="nero" />
    </template>
  </ToonReaderShell>
</template>
