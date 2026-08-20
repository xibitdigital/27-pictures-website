<script setup lang="ts">
import { resolveAssetUrl } from "../bookReader/assetUrl";
import LangSwitcher from "../bookReader/LangSwitcher.vue";
import { LikeButton } from "../bookReader/chrome";
import ToonReaderShell from "../bookReader/ToonReaderShell.vue";
import type { ToonShellBookOptions } from "../bookReader/types";
import { devToonConfigUrl } from "../configUrls";
import { COVER } from "../coverCopy";

const ASSET_PAGE_DIR = "/toons/redsmile-marcus/";
/**
 * NOT PUBLISHED YET. Every other toon uses `toonConfigUrl(id)`, which resolves a
 * content-hashed config from config-lock.json — and cannot type-check an id that
 * has no lock entry. This episode has none, because publishing writes that entry
 * and publishing is blocked (wrangler auth).
 *
 * So this reads content/toons/redsmile-marcus/config.json through the dev
 * middleware, which works in `make dev` and in unit tests and **does not work in
 * a production build**. That is the honest state of a one-page work in progress:
 * the page is noindex and unlinked, and it has no plates on the CDN either.
 *
 * To ship: `npm run upload-assets`, `npm run publish-toon-config -- --toon
 * redsmile-marcus`, then swap this line for `toonConfigUrl("redsmile-marcus")`.
 */
const CONFIG_URL = devToonConfigUrl("redsmile-marcus");
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
