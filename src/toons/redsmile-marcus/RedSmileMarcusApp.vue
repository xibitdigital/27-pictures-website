<script setup lang="ts">
import { resolveAssetUrl } from "../bookReader/assetUrl";
import LangSwitcher from "../bookReader/LangSwitcher.vue";
import { LikeButton } from "../bookReader/chrome";
import ToonReaderShell from "../bookReader/ToonReaderShell.vue";
import type { ToonShellBookOptions } from "../bookReader/types";
import { toonConfigUrl } from "../configUrls";
import { COVER } from "../coverCopy";

const ASSET_PAGE_DIR = "/toons/redsmile-marcus/";
/**
 * One page so far, so the reader stays `noindex` — but the config and its plate
 * are on the CDN, so the locked hash is the real source, same as every other
 * toon. Republish with `npm run publish-toon-config -- --toon redsmile-marcus`
 * after editing content/toons/redsmile-marcus/config.json, or production keeps
 * asking for the previous hash.
 */
const CONFIG_URL = toonConfigUrl("redsmile-marcus");
/** Same cover stock as episode 1 — one series, one book. */
const COVER_TEXTURE = resolveAssetUrl("/toons/assets/9e8cbf85e48ac7eb7d1afd5981efb20f.jpg");

/** Stable options — shell owns page source, captions, and cover identity. */
const bookOptions: ToonShellBookOptions = {
  coverSubtitle: COVER["redsmile-marcus"].subtitle,
  coverSynopsis: COVER["redsmile-marcus"].synopsis,
};
</script>

<template>
  <ToonReaderShell
    alt-prefix="Marcus"
    :config-url="CONFIG_URL"
    :asset-page-dir="ASSET_PAGE_DIR"
    toon-id="redsmile-marcus"
    front-cover-logo="/logosquare.png"
    :cover-texture="COVER_TEXTURE"
    caption-lang-storage-key="redsmile-marcus-toon-lang"
    :book-options="bookOptions"
  >
    <template #top-controls-start>
      <LangSwitcher />
      <LikeButton toon-id="redsmile-marcus" />
    </template>
  </ToonReaderShell>
</template>
