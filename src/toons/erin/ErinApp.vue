<script setup lang="ts">
import { resolveAssetUrl } from "../bookReader/assetUrl";
import ToonReaderShell from "../bookReader/ToonReaderShell.vue";
import { LikeButton } from "../bookReader/chrome";
import type { ToonShellBookOptions } from "../bookReader/types";
import { episodeNav } from "../series";
import { toonConfigUrl } from "../configUrls";

const ASSET_PAGE_DIR = "/toons/erin/";
/** Content-hashed config from config-lock.json. */
const CONFIG_URL = toonConfigUrl("erin");
const COVER_TEXTURE = resolveAssetUrl("/toons/assets/9e8cbf85e48ac7eb7d1afd5981efb20f.jpg");

/**
 * CoverFirstPage props via ToonReaderShell (same component as Jax / Nero).
 * Title falls back to alt-prefix "Erin" when coverTitle is omitted.
 */
const COVER_SYNOPSIS =
  "Erin is half human, half vampire — too much of each world to belong fully to either.\n\n" +
  "She lives in a small town that is not really a town at all: a thin place, a passage between the goblin world and the human one, where roads fold wrong at night and doors open onto forests that do not appear on any map.\n\n" +
  "Blood, bargains, and old names move through her streets. She is the threshold’s keeper — and its most dangerous secret.";

/** Back cover points at the rest of the series, not a generic index. */
const BACK_NAV = episodeNav("erin");

const bookOptions: ToonShellBookOptions = {
  coverTitle: "Erin",
  coverSubtitle: "Between two worlds",
  coverSynopsis: COVER_SYNOPSIS,
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
    :book-options="bookOptions"
  >
    <template #top-controls-start>
      <LikeButton toon-id="erin" />
    </template>
  </ToonReaderShell>
</template>
