<script setup lang="ts">
import { Upload } from "@lucide/vue";
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
  replacing?: boolean;
}>();

const emit = defineEmits<{
  select: [id: string];
  move: [id: string, x: number, y: number];
  persist: [id: string, x: number, y: number];
  add: [pos: { x: number; y: number }];
  replace: [file: File];
}>();

const imgEl = ref<HTMLImageElement | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const plateStyle = computed(() => ({
  "--plate-aspect": `${props.designWidth} / ${props.designHeight}`,
}));

function onReplaceFile(ev: Event): void {
  const input = ev.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (file) emit("replace", file);
}
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
      <input
        ref="fileInput"
        type="file"
        name="replace-page-file"
        accept="image/webp,image/jpeg,image/png"
        hidden
        :disabled="replacing"
        @change="onReplaceFile"
      />
      <button
        class="editor-plate-replace"
        type="button"
        name="replace-page"
        :disabled="replacing"
        :aria-label="replacing ? 'Replacing plate' : 'Replace plate'"
        :title="replacing ? 'Replacing plate' : 'Replace plate'"
        @click="fileInput?.click()"
      >
        <Upload :size="14" :stroke-width="1.4" aria-hidden="true" />
        {{ replacing ? "Replacing…" : "Replace" }}
      </button>
    </div>
  </div>
</template>
