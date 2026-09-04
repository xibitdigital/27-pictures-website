<script setup lang="ts">
import { X } from "@lucide/vue";
import { computed, ref } from "vue";
import EditorCaptionLayer from "./EditorCaptionLayer.vue";
import type { BubbleRecord } from "../types";

const HINT_KEY = "editor-plate-click-hint";

function readHintDismissed(): boolean {
  try {
    return localStorage.getItem(HINT_KEY) === "1";
  } catch {
    return false;
  }
}

const showHint = ref(!readHintDismissed());

function dismissHint(): void {
  showHint.value = false;
  try {
    localStorage.setItem(HINT_KEY, "1");
  } catch {
    /* private mode — stay gone for this visit */
  }
}

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
    <p v-if="showHint" class="editor-plate-hint" data-plate-hint role="status">
      Click the page to add a bubble.
      <button
        class="editor-plate-hint-dismiss"
        type="button"
        name="dismiss-plate-hint"
        aria-label="Dismiss"
        @click="dismissHint"
      >
        <X :size="18" :stroke-width="2.2" aria-hidden="true" />
      </button>
    </p>
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
