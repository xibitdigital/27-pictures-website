<script setup lang="ts">
import { resolveAssetUrl } from "../bookReader/assetUrl";
import ToonReaderShell from "../bookReader/ToonReaderShell.vue";
import type { ToonShellBookOptions } from "../bookReader/types";

const COVER_TEXTURE = resolveAssetUrl("/toons/assets/3d2d90aafc6ae28a9cb9f841a3b7183f.jpg");

const bookOptions: ToonShellBookOptions = {
  coverSubtitle: "The Missing Child",
};
</script>

<template>
  <ToonReaderShell
    alt-prefix="Erin"
    asset-page-dir="/toons/erin/"
    front-cover-logo="/logosquare.png"
    :cover-texture="COVER_TEXTURE"
    :book-options="bookOptions"
  />
</template>
