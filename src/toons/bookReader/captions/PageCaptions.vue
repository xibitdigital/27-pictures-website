<script setup lang="ts">
/**
 * Drop-in caption layer for a page slot: pulls words + language from the
 * injected toon captions store, so slots only pass the page and its image.
 * Renders nothing for toons without captions (e.g. Erin).
 */
import { computed, onBeforeUnmount, watchEffect } from "vue";
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

/**
 * Warm this page's clips only as its plate nears the viewport. The gate
 * matters in vertical-strip mode, where one PageCaptions mounts per page —
 * warming on mount there would re-create the whole-book SFX preload this
 * replaced. Book mode only mounts the visible slots, so it warms right away.
 */
let warmed = false;
let observer: IntersectionObserver | null = null;

function warm(): void {
  if (warmed) return;
  warmed = true;
  observer?.disconnect();
  observer = null;
  captions?.warmPageAudio(props.pageNum);
}

watchEffect(() => {
  if (warmed || !words.value.length) return;
  if (typeof IntersectionObserver === "undefined") {
    warm();
    return;
  }
  const el = props.imageEl;
  if (!el) return; // re-runs when the slot hands over its image ref
  observer?.disconnect();
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) warm();
    },
    // Two viewports of lookahead — the same "nearby, not everything" window
    // the engine uses for plates.
    { rootMargin: "200% 0px" }
  );
  observer.observe(el);
});

onBeforeUnmount(() => {
  observer?.disconnect();
  observer = null;
});
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
