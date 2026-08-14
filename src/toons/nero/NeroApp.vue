<script setup lang="ts">
import { resolveAssetUrl } from "../bookReader/assetUrl";
import LangSwitcher from "../bookReader/LangSwitcher.vue";
import { LikeButton } from "../bookReader/chrome";
import ToonReaderShell from "../bookReader/ToonReaderShell.vue";
import type { ToonShellBookOptions } from "../bookReader/types";
import { toonConfigUrl } from "../configUrls";

const ASSET_PAGE_DIR = "/toons/nero/";
/** Content-hashed config from config-lock.json. */
const CONFIG_URL = toonConfigUrl("nero");
const COVER_TEXTURE = resolveAssetUrl("/toons/assets/9e8cbf85e48ac7eb7d1afd5981efb20f.jpg");

/** Front-cover story — full cast/synopsis in content/toons/nero/README.md */
const COVER_SYNOPSIS =
  "In a rain-soaked city of wetwork and wet labs, detective Nero — ex-military, one hand lost to a terrorist attack and rebuilt in steel — follows a trail of blood and crystal.\n\n" +
  "His ally Eve, a Scotland Yard forensic specialist whose AI-enhanced glasses can tag faces and materials, reads the evidence he cannot. Between them stands The Dog: a cold-blooded sicario who never misses.\n\n" +
  "Together Nero and Eve must crack the crystal case, hunt The Dog through the rooftops and the lab, and uncover who hired the bullet — and what near-invisible implant tech it was meant to protect.";

/** Stable options — shell owns page source, captions, and cover identity. */
const bookOptions: ToonShellBookOptions = {
  coverSubtitle: "Scotland Yard case",
  coverSynopsis: COVER_SYNOPSIS,
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
  >
    <template #top-controls-start>
      <LangSwitcher />
      <LikeButton toon-id="nero" />
    </template>
  </ToonReaderShell>
</template>
