<script setup lang="ts">
/**
 * Vertical scroll strip of page images.
 * Paints captions / emits ready only after DOM settles — never from
 * function-ref callbacks (those re-run every update and can recurse).
 */
import { nextTick, onMounted, ref, watch } from "vue";
import type { PagePaintHandler } from "./types";

const props = defineProps<{
  pages: string[];
  altPrefix?: string;
  onPagePaint?: PagePaintHandler;
}>();

const emit = defineEmits<{
  ready: [slots: HTMLElement[]];
}>();

const rootEl = ref<HTMLElement | null>(null);

function collectSlots(): HTMLElement[] {
  const root = rootEl.value;
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>(".vertical-page.page-slot"));
}

async function paintAndEmitReady(): Promise<void> {
  await nextTick();
  const slots = collectSlots();
  for (const slot of slots) {
    const pageNum = Number(slot.dataset.pageNum);
    if (pageNum && props.onPagePaint) props.onPagePaint(slot, pageNum);
  }
  emit("ready", slots);
}

onMounted(() => {
  void paintAndEmitReady();
});

watch(
  () => props.pages,
  () => {
    void paintAndEmitReady();
  }
);
</script>

<template>
  <div ref="rootEl" class="vertical-strip-pages">
    <div v-for="(src, i) in pages" :key="src + '-' + i" class="vertical-page page-slot" :data-page-num="i + 1">
      <img
        :src="src"
        :alt="`${altPrefix || 'Page'} — page ${i + 1}`"
        draggable="false"
        :loading="i > 1 ? 'lazy' : 'eager'"
      />
    </div>
  </div>
</template>
