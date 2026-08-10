<script setup lang="ts">
/**
 * Caption layer for one plate. Sits over the page image, matched to the
 * image's object-fit:contain content box, and renders the page's captions.
 *
 * Visibility for auto-read is owned by the controller (geometry via getRect).
 * This component only reports layout changes — no parallel IO visibility policy.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch, type CSSProperties } from "vue";
import WordCaption from "./WordCaption.vue";
import { buildCaptions, imageContentBox, type CaptionModel } from "./captionModel";
import { useAutoReadController, type AutoReadCaptionRef } from "./useAutoRead";
import type { LangCode, WordEntry } from "../types";

const props = withDefaults(
  defineProps<{
    pageNum: number;
    words: WordEntry[];
    lang?: LangCode;
    designWidth?: number;
    designHeight?: number;
    fontFamily?: string;
    /** The plate this layer sits on — measured for the content box. */
    imageEl?: HTMLImageElement | null;
  }>(),
  {
    lang: "en",
    designWidth: 1008,
    designHeight: 1792,
    fontFamily: '"Bangers", cursive',
    imageEl: null,
  }
);

const emit = defineEmits<{
  measured: [ready: boolean];
}>();

const rootEl = ref<HTMLElement | null>(null);
const box = ref<{ left: number; top: number; width: number; height: number } | null>(null);

const designScale = computed(() => (box.value ? box.value.width / props.designWidth : 0));

const captions = computed<CaptionModel[]>(() => {
  if (!box.value || !designScale.value) return [];
  return buildCaptions(props.words || [], {
    lang: props.lang,
    pageNum: props.pageNum,
    designWidth: props.designWidth,
    designHeight: props.designHeight,
    designScale: designScale.value,
    fontFamily: props.fontFamily,
  });
});

const layerStyle = computed<CSSProperties>(() => ({
  position: "absolute",
  left: `${box.value?.left ?? 0}px`,
  top: `${box.value?.top ?? 0}px`,
  width: `${box.value?.width ?? 0}px`,
  height: `${box.value?.height ?? 0}px`,
  pointerEvents: "none",
  overflow: "visible",
  zIndex: 35,
}));

function measure(): void {
  const img = props.imageEl;
  if (!img || (!img.naturalWidth && !img.clientWidth)) {
    if (box.value) box.value = null;
    emit("measured", false);
    return;
  }
  const next = imageContentBox(img);
  const cur = box.value;
  const changed =
    !cur || cur.left !== next.left || cur.top !== next.top || cur.width !== next.width || cur.height !== next.height;
  if (changed) {
    box.value = { left: next.left, top: next.top, width: next.width, height: next.height };
  }
  emit("measured", true);
  // Only notify auto-read when the plate box actually moves/resizes — not on
  // every ResizeObserver tick (speaking highlight must not re-schedule the queue).
  if (changed) layer?.layoutChanged();
}

const autoRead = useAutoReadController();
const layer = autoRead
  ? autoRead.registerLayer({
      id: String(props.pageNum),
      getRect: () => {
        const layerRect = rootEl.value?.getBoundingClientRect() ?? null;
        if (layerRect && layerRect.width >= 2 && layerRect.height >= 2) return layerRect;
        const img = props.imageEl;
        if (img) {
          const ir = img.getBoundingClientRect();
          if (ir.width >= 2 && ir.height >= 2) return ir;
        }
        return layerRect;
      },
    })
  : null;

const speakingIndex = computed(() => layer?.speakingIndex.value ?? null);

const spokenCaptions = computed<AutoReadCaptionRef[]>(() =>
  captions.value
    .filter((c) => !!c.audio)
    .slice()
    // Keep config words[] order for auto-read (not DOM/geometry order).
    .sort((a, b) => a.index - b.index)
    .map((c) => ({ index: c.index, audio: c.audio as string, volume: c.volume, x: c.x, y: c.y }))
);

watch(spokenCaptions, (list) => layer?.setCaptions(list), { immediate: true });

function onCaptionPlay(caption: CaptionModel): void {
  if (!caption.audio || !layer) return;
  layer.playOne({
    index: caption.index,
    audio: caption.audio,
    volume: caption.volume,
    x: caption.x,
    y: caption.y,
  });
}

let resizeObserver: ResizeObserver | null = null;

function observeImage(img: HTMLImageElement | null): void {
  resizeObserver?.disconnect();
  resizeObserver = null;
  if (!img) {
    box.value = null;
    return;
  }
  measure();
  if (!img.complete || (!img.naturalWidth && !img.clientWidth)) {
    img.addEventListener("load", measure, { once: true });
  }
  resizeObserver = new ResizeObserver(() => measure());
  resizeObserver.observe(img);
  if (img.parentElement) resizeObserver.observe(img.parentElement);
}

onMounted(() => {
  observeImage(props.imageEl);
});

watch(
  () => props.imageEl,
  (img) => observeImage(img)
);

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  layer?.release();
});
</script>

<template>
  <!-- Interactive SFX bubbles need to stay in the a11y tree (role=button on WordCaption). -->
  <div ref="rootEl" class="jax-word-layer" :style="layerStyle" :data-page-num="pageNum">
    <WordCaption
      v-for="caption in captions"
      :key="caption.key"
      :caption="caption"
      :speaking="speakingIndex === caption.index"
      @play="onCaptionPlay"
    />
  </div>
</template>
