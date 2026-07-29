<script setup lang="ts">
/**
 * One half of a spread (or the single-page face). Vue owns all markup —
 * no createElement / appendChild in the engine.
 */
import { computed, nextTick, onMounted, ref, watch } from "vue";
import FrontCoverInstructions from "./FrontCoverInstructions.vue";
import BackCoverLink from "./BackCoverLink.vue";
import type { SlotModel } from "./bookModels";
import type { PageClearHandler, PagePaintHandler } from "./types";

const props = withDefaults(
  defineProps<{
    model: SlotModel;
    side?: "left" | "right";
    altPrefix?: string;
    coverTexture?: string | null;
    coverTitle?: string;
    coverSubtitle?: string | null;
    frontCoverLogo?: string | null;
    soundHint?: string | null;
    soundEnabled?: boolean;
    backHref?: string;
    backLabel?: string;
    onPagePaint?: PagePaintHandler;
    onPageClear?: PageClearHandler;
  }>(),
  {
    side: "right",
    altPrefix: "Page",
    coverTexture: null,
    coverTitle: "",
    coverSubtitle: "Experiment",
    frontCoverLogo: null,
    soundHint: null,
    soundEnabled: false,
    backHref: "/experiments/",
    backLabel: "← experiments",
  }
);

const emit = defineEmits<{
  soundToggle: [];
}>();

const rootEl = ref<HTMLElement | null>(null);

const isCover = computed(
  () =>
    props.model.kind === "front" ||
    props.model.kind === "back" ||
    props.model.kind === "cover"
);
const isBlank = computed(() => props.model.kind === "blank");
const pageNum = computed(() =>
  props.model.kind === "page" ? props.model.pageNum : undefined
);

function notifyPaint(): void {
  const el = rootEl.value;
  if (!el) return;
  if (props.model.kind === "page") {
    props.onPagePaint?.(el, props.model.pageNum);
  } else {
    props.onPageClear?.(el);
  }
}

onMounted(() => {
  void nextTick(notifyPaint);
});

watch(
  () => props.model,
  () => {
    void nextTick(notifyPaint);
  },
  { deep: true }
);
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
      :src="model.src"
      :alt="`${altPrefix} — page ${model.pageNum}`"
      draggable="false"
    />

    <FrontCoverInstructions
      v-else-if="model.kind === 'front'"
      :title="coverTitle"
      :subtitle="coverSubtitle"
      :logo="frontCoverLogo"
      :alt-prefix="altPrefix"
      :sound-hint="soundHint"
      :sound-enabled="soundEnabled"
      @sound-toggle="emit('soundToggle')"
    />

    <BackCoverLink
      v-else-if="model.kind === 'back'"
      :href="backHref"
      :label="backLabel"
    />
  </div>
</template>
