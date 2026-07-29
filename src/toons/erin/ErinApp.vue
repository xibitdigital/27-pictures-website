<script setup lang="ts">
import ToonReaderShell from "../bookReader/ToonReaderShell.vue";

const COVER_TEXTURE = "/toons/assets/3d2d90aafc6ae28a9cb9f841a3b7183f.jpg";
</script>

<template>
  <ToonReaderShell alt-prefix="Erin" front-cover-logo="/logosquare.png" :cover-texture="COVER_TEXTURE" />
</template>
