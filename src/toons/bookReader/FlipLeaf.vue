<script setup lang="ts">
/**
 * Animated page-turn leaf. Markup only — engine owns timing via safety timeout
 * and listens for @done when CSS animation ends.
 * Page faces get caption paint so bubbles travel with the flipping plate.
 */
import { nextTick, onMounted, onUpdated, ref } from "vue";
import CoverFirstPage from "./CoverFirstPage.vue";
import BackCoverLink from "./BackCoverLink.vue";
import type { FlipFaceModel, FlipModel } from "./bookModels";
import type { PagePaintHandler } from "./types";

const props = withDefaults(
  defineProps<{
    flip: FlipModel;
    coverTexture?: string | null;
    coverTitle?: string;
    coverSubtitle?: string | null;
    coverSynopsis?: string | null;
    frontCoverLogo?: string | null;
    altPrefix?: string;
    soundHint?: string | null;
    soundEnabled?: boolean;
    backHref?: string;
    backLabel?: string;
    onPagePaint?: PagePaintHandler;
  }>(),
  {
    coverTexture: null,
    coverTitle: "",
    coverSubtitle: "Experiment",
    coverSynopsis: null,
    frontCoverLogo: null,
    altPrefix: "Page",
    soundHint: null,
    soundEnabled: false,
    backHref: "/experiments/",
    backLabel: "← experiments",
  }
);

const emit = defineEmits<{
  done: [];
  soundToggle: [];
}>();

const flipping = ref(false);
const rootEl = ref<HTMLElement | null>(null);
const frontFaceEl = ref<HTMLElement | null>(null);
const backFaceEl = ref<HTMLElement | null>(null);

function faceIsCover(face: FlipFaceModel): boolean {
  return face.kind === "front" || face.kind === "back" || face.kind === "cover";
}

function paintFace(el: HTMLElement | null, face: FlipFaceModel | undefined): void {
  if (!el || !face || face.kind !== "page" || !props.onPagePaint) return;
  el.dataset.pageNum = String(face.pageNum);
  props.onPagePaint(el, face.pageNum);
}

function paintFaces(): void {
  paintFace(frontFaceEl.value, props.flip.front);
  paintFace(backFaceEl.value, props.flip.back);
}

onMounted(() => {
  void nextTick(() => {
    paintFaces();
    requestAnimationFrame(() => {
      flipping.value = true;
    });
  });
});

onUpdated(() => {
  void nextTick(paintFaces);
});

function onAnimationEnd(e: AnimationEvent): void {
  if (e.target !== rootEl.value) return;
  emit("done");
}
</script>

<template>
  <div
    ref="rootEl"
    class="flip-page"
    :class="[flip.direction === 'next' ? 'from-right' : 'from-left', { flipping }]"
    @animationend="onAnimationEnd"
  >
    <div
      ref="frontFaceEl"
      class="flip-face front"
      :class="{
        'inside-cover': faceIsCover(flip.front),
        'has-cover-texture': faceIsCover(flip.front) && !!coverTexture,
      }"
      :data-page-num="flip.front.kind === 'page' ? String(flip.front.pageNum) : undefined"
    >
      <img
        v-if="faceIsCover(flip.front) && coverTexture"
        class="cover-texture-img"
        :src="coverTexture"
        alt=""
        draggable="false"
        aria-hidden="true"
      />
      <img
        v-if="flip.front.kind === 'page'"
        :key="`f-${flip.front.pageNum}`"
        :src="flip.front.src"
        alt=""
        draggable="false"
      />
      <CoverFirstPage
        v-else-if="flip.front.kind === 'front'"
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
      <BackCoverLink v-else-if="flip.front.kind === 'back'" :href="backHref" :label="backLabel" />
    </div>

    <div
      v-if="flip.mode === 'desktop' && flip.back"
      ref="backFaceEl"
      class="flip-face back"
      :class="{
        'inside-cover': faceIsCover(flip.back),
        'has-cover-texture': faceIsCover(flip.back) && !!coverTexture,
      }"
      :data-page-num="flip.back.kind === 'page' ? String(flip.back.pageNum) : undefined"
    >
      <img
        v-if="faceIsCover(flip.back) && coverTexture"
        class="cover-texture-img"
        :src="coverTexture"
        alt=""
        draggable="false"
        aria-hidden="true"
      />
      <img
        v-if="flip.back.kind === 'page'"
        :key="`b-${flip.back.pageNum}`"
        :src="flip.back.src"
        alt=""
        draggable="false"
      />
      <CoverFirstPage
        v-else-if="flip.back.kind === 'front'"
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
      <BackCoverLink v-else-if="flip.back.kind === 'back'" :href="backHref" :label="backLabel" />
    </div>
  </div>
</template>
