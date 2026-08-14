<script setup lang="ts">
import { resolveAssetUrl } from "../bookReader/assetUrl";
import LangSwitcher from "../bookReader/LangSwitcher.vue";
import { LikeButton } from "../bookReader/chrome";
import ToonReaderShell from "../bookReader/ToonReaderShell.vue";
import type { ToonShellBookOptions } from "../bookReader/types";
import { toonConfigUrl } from "../configUrls";

const ASSET_PAGE_DIR = "/toons/redsmile-static/";
/** Content-hashed config from config-lock.json. */
const CONFIG_URL = toonConfigUrl("redsmile-static");
const COVER_TEXTURE = resolveAssetUrl("/toons/assets/9e8cbf85e48ac7eb7d1afd5981efb20f.jpg");

/** Front-cover story — see content/toons/redsmile-static/README.md */
const COVER_SYNOPSIS =
  "The first episode of the Elena series.\n\n" +
  "Psychological horror drawn in heavy black-and-white gekiga ink — crushed shadows, hand-inked plates, light that never quite reaches the corners.\n\n" +
  "Elena is alone in the flat when the television finds a channel that should not exist.";

/** Stable options — shell owns page source, captions, and cover identity. */
const bookOptions: ToonShellBookOptions = {
  coverSubtitle: "RED SMILE",
  coverSynopsis: COVER_SYNOPSIS,
};
</script>

<template>
  <ToonReaderShell
    alt-prefix="static"
    :config-url="CONFIG_URL"
    :asset-page-dir="ASSET_PAGE_DIR"
    front-cover-logo="/logosquare.png"
    :cover-texture="COVER_TEXTURE"
    caption-lang-storage-key="redsmile-static-toon-lang"
    :book-options="bookOptions"
  >
    <template #top-controls-start>
      <LangSwitcher />
      <LikeButton toon-id="redsmile-static" />
    </template>
  </ToonReaderShell>
</template>
