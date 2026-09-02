<script setup lang="ts">
import { computed, ref } from "vue";
import EditorCaptionLayer from "./EditorCaptionLayer.vue";
import type { BubbleRecord } from "../types";

const props = defineProps<{
  src: string;
  pageNum: number;
  bubbles: BubbleRecord[];
  selectedId: string | null;
  lang?: string;
  designWidth: number;
  designHeight: number;
}>();

const emit = defineEmits<{
  select: [id: string];
  move: [id: string, x: number, y: number];
  persist: [id: string, x: number, y: number];
  add: [pos: { x: number; y: number }];
}>();

const imgEl = ref<HTMLImageElement | null>(null);
const plateStyle = computed(() => ({
  "--plate-aspect": `${props.designWidth} / ${props.designHeight}`,
}));
</script>

<template>
  <div class="editor-canvas">
    <div class="editor-plate" :style="plateStyle">
      <img ref="imgEl" :src="src" alt="" />
      <EditorCaptionLayer
        v-if="imgEl"
        :page-num="pageNum"
        :bubbles="bubbles"
        :selected-id="selectedId"
        :lang="lang || 'en'"
        :design-width="designWidth"
        :design-height="designHeight"
        :image-el="imgEl"
        @select="emit('select', $event)"
        @move="(id, x, y) => emit('move', id, x, y)"
        @persist="(id, x, y) => emit('persist', id, x, y)"
        @add="emit('add', $event)"
      />
    </div>
  </div>
</template>
