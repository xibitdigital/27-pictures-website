<script setup lang="ts">
/**
 * Drop-in caption layer for a page slot: pulls words + language from the
 * injected toon captions store, so slots only pass the page and its image.
 * Renders nothing for toons without captions (e.g. Erin).
 */
import { computed } from "vue";
import WordLayer from "./WordLayer.vue";
import { useToonCaptions } from "./useToonCaptions";

const props = defineProps<{
  pageNum: number;
  imageEl?: HTMLImageElement | null;
}>();

const emit = defineEmits<{
  measured: [ready: boolean];
}>();

const captions = useToonCaptions();

const words = computed(() => captions?.wordsForPage(props.pageNum) ?? []);
</script>

<template>
  <WordLayer
    v-if="captions && words.length"
    :page-num="pageNum"
    :words="words"
    :lang="captions.lang.value"
    :design-width="captions.designWidth.value"
    :design-height="captions.designHeight.value"
    :font-family="captions.fontFamily.value"
    :image-el="imageEl ?? null"
    @measured="emit('measured', $event)"
  />
</template>
