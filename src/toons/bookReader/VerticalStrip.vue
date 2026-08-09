<script setup lang="ts">
/**
 * Vertical scroll strip of page images, each with its own caption layer.
 * Emits the page slots once the DOM settles (deep-link scrolling).
 */
import { nextTick, onMounted, ref, watch } from "vue";
import PageCaptions from "./captions/PageCaptions.vue";

const props = defineProps<{
  pages: string[];
  altPrefix?: string;
}>();

const emit = defineEmits<{
  ready: [slots: HTMLElement[]];
}>();

const rootEl = ref<HTMLElement | null>(null);
const slotEls = ref<HTMLElement[]>([]);
const imgEls = ref<HTMLImageElement[]>([]);

function setSlotRef(el: Element | null, i: number): void {
  if (el) slotEls.value[i] = el as HTMLElement;
}

function setImgRef(el: Element | null, i: number): void {
  if (el) imgEls.value[i] = el as HTMLImageElement;
}

async function emitReady(): Promise<void> {
  await nextTick();
  emit("ready", slotEls.value.filter(Boolean).slice(0, props.pages.length));
}

onMounted(() => {
  void emitReady();
});

watch(
  () => props.pages,
  () => {
    slotEls.value = [];
    imgEls.value = [];
    void emitReady();
  }
);
</script>

<template>
  <div ref="rootEl" class="vertical-strip-pages">
    <div
      v-for="(src, i) in pages"
      :key="src + '-' + i"
      :ref="(el) => setSlotRef(el as Element | null, i)"
      class="vertical-page page-slot"
      :data-page-num="i + 1"
    >
      <img
        :ref="(el) => setImgRef(el as Element | null, i)"
        :src="src"
        :alt="`${altPrefix || 'Page'} — page ${i + 1}`"
        draggable="false"
        :loading="i > 1 ? 'lazy' : 'eager'"
      />
      <PageCaptions :page-num="i + 1" :image-el="imgEls[i] ?? null" />
    </div>
  </div>
</template>
