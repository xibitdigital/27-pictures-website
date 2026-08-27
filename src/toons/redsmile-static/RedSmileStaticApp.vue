<script setup lang="ts">
import { resolveAssetUrl } from "../bookReader/assetUrl";
import LangSwitcher from "../bookReader/LangSwitcher.vue";
import { LikeButton } from "../bookReader/chrome";
import ToonReaderShell from "../bookReader/ToonReaderShell.vue";
import type { ToonShellBookOptions } from "../bookReader/types";
import { readerConfigUrl } from "../configUrls";
import { COVER } from "../coverCopy";

const ASSET_PAGE_DIR = "/toons/redsmile-static/";
/** Content-hashed config from config-lock.json. */
const CONFIG_URL = readerConfigUrl("redsmile-static");
const COVER_TEXTURE = resolveAssetUrl("/toons/assets/9e8cbf85e48ac7eb7d1afd5981efb20f.jpg");

/** Stable options — shell owns page source, captions, and cover identity. */
const bookOptions: ToonShellBookOptions = {
  coverSubtitle: COVER["redsmile-static"].subtitle,
  coverSynopsis: COVER["redsmile-static"].synopsis,
};
</script>

<template>
  <ToonReaderShell
    alt-prefix="static"
    :config-url="CONFIG_URL"
    :asset-page-dir="ASSET_PAGE_DIR"
    toon-id="redsmile-static"
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
