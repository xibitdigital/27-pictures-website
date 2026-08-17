<script setup lang="ts">
import { resolveAssetUrl } from "../bookReader/assetUrl";
import LangSwitcher from "../bookReader/LangSwitcher.vue";
import { LikeButton } from "../bookReader/chrome";
import ToonReaderShell from "../bookReader/ToonReaderShell.vue";
import type { ToonShellBookOptions } from "../bookReader/types";
import { episodeNav } from "../series";
import { toonConfigUrl } from "../configUrls";
import { COVER } from "../coverCopy";

const ASSET_PAGE_DIR = "/toons/erin-the-revenge/";
/** Content-hashed config from config-lock.json. */
const CONFIG_URL = toonConfigUrl("erin-the-revenge");
const COVER_TEXTURE = resolveAssetUrl("/toons/assets/9e8cbf85e48ac7eb7d1afd5981efb20f.jpg");

/** Back cover points at the rest of the series, not a generic index. */
const BACK_NAV = episodeNav("erin-the-revenge");

const bookOptions: ToonShellBookOptions = {
  coverTitle: "ERIN EP 2",
  coverSubtitle: COVER["erin-the-revenge"].subtitle,
  coverSynopsis: COVER["erin-the-revenge"].synopsis,
  backNav: BACK_NAV,
};
</script>

<template>
  <ToonReaderShell
    alt-prefix="Erin EP 2"
    :config-url="CONFIG_URL"
    :asset-page-dir="ASSET_PAGE_DIR"
    toon-id="erin-the-revenge"
    front-cover-logo="/logosquare.png"
    :cover-texture="COVER_TEXTURE"
    caption-lang-storage-key="erin-the-revenge-toon-lang"
    :book-options="bookOptions"
  >
    <template #top-controls-start>
      <LangSwitcher />
      <LikeButton toon-id="erin-the-revenge" />
    </template>
  </ToonReaderShell>
</template>
