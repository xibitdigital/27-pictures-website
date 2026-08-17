<script setup lang="ts">
import { resolveAssetUrl } from "../bookReader/assetUrl";
import LangSwitcher from "../bookReader/LangSwitcher.vue";
import ToonReaderShell from "../bookReader/ToonReaderShell.vue";
import { LikeButton } from "../bookReader/chrome";
import type { ToonShellBookOptions } from "../bookReader/types";
import { episodeNav } from "../series";
import { toonConfigUrl } from "../configUrls";
import { COVER } from "../coverCopy";

const ASSET_PAGE_DIR = "/toons/erin/";
/** Content-hashed config from config-lock.json. */
const CONFIG_URL = toonConfigUrl("erin");
const COVER_TEXTURE = resolveAssetUrl("/toons/assets/9e8cbf85e48ac7eb7d1afd5981efb20f.jpg");

/**
 * CoverFirstPage props via ToonReaderShell (same component as Jax / Nero).
 * Title falls back to alt-prefix "Erin" when coverTitle is omitted.
 */

/** Back cover points at the rest of the series, not a generic index. */
const BACK_NAV = episodeNav("erin");

const bookOptions: ToonShellBookOptions = {
  coverTitle: "Erin",
  coverSubtitle: COVER.erin.subtitle,
  coverSynopsis: COVER.erin.synopsis,
  backNav: BACK_NAV,
};
</script>

<template>
  <ToonReaderShell
    alt-prefix="Erin"
    :config-url="CONFIG_URL"
    :asset-page-dir="ASSET_PAGE_DIR"
    toon-id="erin"
    front-cover-logo="/logosquare.png"
    :cover-texture="COVER_TEXTURE"
    caption-lang-storage-key="erin-toon-lang"
    :book-options="bookOptions"
  >
    <template #top-controls-start>
      <LangSwitcher />
      <LikeButton toon-id="erin" />
    </template>
  </ToonReaderShell>
</template>
