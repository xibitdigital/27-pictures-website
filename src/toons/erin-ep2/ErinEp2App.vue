<script setup lang="ts">
import { resolveAssetUrl } from "../bookReader/assetUrl";
import LangSwitcher from "../bookReader/LangSwitcher.vue";
import { LikeButton } from "../bookReader/chrome";
import ToonReaderShell from "../bookReader/ToonReaderShell.vue";
import type { ToonShellBookOptions } from "../bookReader/types";
import { toonConfigUrl } from "../configUrls";

const ASSET_PAGE_DIR = "/toons/erin-ep2/";
/** Content-hashed config from config-lock.json. */
const CONFIG_URL = toonConfigUrl("erin-ep2");
const COVER_TEXTURE = resolveAssetUrl("/toons/assets/9e8cbf85e48ac7eb7d1afd5981efb20f.jpg");

/** Front-cover story — keep in step with the fallback article in index.html. */
const COVER_SYNOPSIS =
  "Erin tears a portal open and crosses into the goblin world. She wakes in a forest that is already watching her, and something winged and made of stone takes her out of it. What saves her is a stranger who can move the ground itself — and who is willing to teach. Erin came looking for a missing child. She goes back for the debt.";

const bookOptions: ToonShellBookOptions = {
  coverTitle: "ERIN EP 2",
  coverSubtitle: "The Revenge",
  coverSynopsis: COVER_SYNOPSIS,
};
</script>

<template>
  <ToonReaderShell
    alt-prefix="Erin EP 2"
    :config-url="CONFIG_URL"
    :asset-page-dir="ASSET_PAGE_DIR"
    front-cover-logo="/logosquare.png"
    :cover-texture="COVER_TEXTURE"
    caption-lang-storage-key="erin-ep2-toon-lang"
    :book-options="bookOptions"
  >
    <template #top-controls-start>
      <LangSwitcher />
      <LikeButton toon-id="erin-ep2" />
    </template>
  </ToonReaderShell>
</template>
