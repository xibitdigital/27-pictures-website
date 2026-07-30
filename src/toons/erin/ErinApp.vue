<script setup lang="ts">
import { resolveAssetUrl } from "../bookReader/assetUrl";
import ToonReaderShell from "../bookReader/ToonReaderShell.vue";
import type { ToonShellBookOptions } from "../bookReader/types";
import { toonConfigUrl } from "../configUrls";

const ASSET_PAGE_DIR = "/toons/erin/";
/** Content-hashed config from config-lock.json. */
const CONFIG_URL = toonConfigUrl("erin");
const COVER_TEXTURE = resolveAssetUrl("/toons/assets/3d2d90aafc6ae28a9cb9f841a3b7183f.jpg");

const bookOptions: ToonShellBookOptions = {
  coverSubtitle: "The Missing Child",
};
</script>

<template>
  <ToonReaderShell
    alt-prefix="Erin"
    :config-url="CONFIG_URL"
    :asset-page-dir="ASSET_PAGE_DIR"
    front-cover-logo="/logosquare.png"
    :cover-texture="COVER_TEXTURE"
    :book-options="bookOptions"
  />
</template>
