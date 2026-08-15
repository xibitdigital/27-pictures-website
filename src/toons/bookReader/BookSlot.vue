<script setup lang="ts">
/**
 * One half of a spread (or the single-page face). Vue owns all markup —
 * no createElement / appendChild in the engine.
 */
import { computed, ref } from "vue";
import CoverFirstPage from "./CoverFirstPage.vue";
import BackCoverLink from "./BackCoverLink.vue";
import type { EpisodeNav } from "../series";
import PageCaptions from "./captions/PageCaptions.vue";
import type { SlotModel } from "./bookModels";

const props = withDefaults(
  defineProps<{
    model: SlotModel;
    side?: "left" | "right";
    altPrefix?: string;
    coverTexture?: string | null;
    coverTitle?: string;
    coverSubtitle?: string | null;
    coverSynopsis?: string | null;
    frontCoverLogo?: string | null;
    soundHint?: string | null;
    soundEnabled?: boolean;
    backHref?: string;
    backLabel?: string;
    backNav?: EpisodeNav | null;
  }>(),
  {
    side: "right",
    altPrefix: "Page",
    coverTexture: null,
    coverTitle: "",
    coverSubtitle: "Experiment",
    coverSynopsis: null,
    frontCoverLogo: null,
    soundHint: null,
    soundEnabled: false,
    backHref: "/toons/",
    backLabel: "← experiments",
    backNav: null,
  }
);

const emit = defineEmits<{
  soundToggle: [];
}>();

const rootEl = ref<HTMLElement | null>(null);
const pageImgEl = ref<HTMLImageElement | null>(null);
/** Plate art stays hidden until captions are placed (no bare-art flash). */
const captionsPending = ref(false);

const isCover = computed(
  () => props.model.kind === "front" || props.model.kind === "back" || props.model.kind === "cover"
);
const isBlank = computed(() => props.model.kind === "blank");
const pageNum = computed(() => (props.model.kind === "page" ? props.model.pageNum : undefined));

function onCaptionsMeasured(ready: boolean): void {
  captionsPending.value = !ready;
}
</script>

<template>
  <div
    ref="rootEl"
    class="page-slot"
    :class="[
      side,
      {
        blank: isBlank,
        'inside-cover': isCover,
        'has-cover-texture': isCover && !!coverTexture,
        'is-captions-pending': captionsPending,
      },
    ]"
    :data-page-num="pageNum != null ? String(pageNum) : undefined"
  >
    <img
      v-if="isCover && coverTexture"
      class="cover-texture-img"
      :src="coverTexture"
      alt=""
      draggable="false"
      aria-hidden="true"
    />

    <img
      v-if="model.kind === 'page'"
      :key="`${model.pageNum}:${model.src}`"
      ref="pageImgEl"
      :src="model.src"
      :alt="`${altPrefix} — page ${model.pageNum}`"
      draggable="false"
    />

    <PageCaptions
      v-if="model.kind === 'page'"
      :key="`captions-${model.pageNum}`"
      :page-num="model.pageNum"
      :image-el="pageImgEl"
      @measured="onCaptionsMeasured"
    />

    <CoverFirstPage
      v-else-if="model.kind === 'front'"
      variant="plate"
      :title="coverTitle"
      :subtitle="coverSubtitle"
      :synopsis="coverSynopsis"
      :logo="frontCoverLogo"
      :alt-prefix="altPrefix"
      :sound-hint="soundHint"
      :sound-enabled="soundEnabled"
      @sound-toggle="emit('soundToggle')"
    />

    <BackCoverLink v-else-if="model.kind === 'back'" :href="backHref" :label="backLabel" :nav="backNav" />
  </div>
</template>
