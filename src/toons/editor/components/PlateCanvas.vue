<script setup lang="ts">
import { X } from "@lucide/vue";
import { computed, ref } from "vue";
import EditorCaptionLayer from "./EditorCaptionLayer.vue";
import GeometryLayer, { type LayoutTool } from "./GeometryLayer.vue";
import LayoutToolbar, { type StudioMode } from "./LayoutToolbar.vue";
import type { BubbleRecord, PageKind, RegionGeometry, RegionRecord } from "../types";
import type { BubbleTail } from "../mapConfig";

const HINT_KEY = "editor-plate-click-hint";

function readHintDismissed(): boolean {
  try {
    return localStorage.getItem(HINT_KEY) === "1";
  } catch {
    return false;
  }
}

const showHint = ref(!readHintDismissed());
/** Pure view/interaction preference, not persisted per-region — resets when the studio remounts. */
const showGrid = ref(false);

function dismissHint(): void {
  showHint.value = false;
  try {
    localStorage.setItem(HINT_KEY, "1");
  } catch {
    /* private mode — stay gone for this visit */
  }
}

const props = withDefaults(
  defineProps<{
    src: string;
    pageNum: number;
    bubbles: BubbleRecord[];
    selectedId: string | null;
    lang?: string;
    designWidth: number;
    designHeight: number;
    kind?: PageKind;
    regions?: RegionRecord[];
    layoutTool?: LayoutTool;
    studioMode?: StudioMode;
    /** Live preview of the page's editor-set backdrop color, shown through any transparent gap. */
    bgColor?: string | null;
  }>(),
  { kind: "plate", regions: () => [], layoutTool: "select", studioMode: "bubbles", bgColor: null }
);

const emit = defineEmits<{
  select: [id: string];
  move: [id: string, x: number, y: number];
  persist: [id: string, x: number, y: number];
  add: [pos: { x: number; y: number }];
  tail: [id: string, tail: BubbleTail];
  "create-region": [geometry: RegionGeometry];
  "update-region-geometry": [id: string, geometry: RegionGeometry];
  "persist-region-geometry": [id: string, geometry: RegionGeometry];
  "move-region-image": [id: string, offsetX: number, offsetY: number];
  "persist-region-image": [id: string, offsetX: number, offsetY: number];
  "request-region-assign": [id: string];
  "update-layout-tool": [tool: LayoutTool];
  "update-studio-mode": [mode: StudioMode];
}>();

const imgEl = ref<HTMLImageElement | null>(null);
const plateStyle = computed(() => ({
  "--plate-aspect": `${props.designWidth} / ${props.designHeight}`,
  ...(props.bgColor ? { backgroundColor: props.bgColor } : {}),
}));
const showBubbleLayer = computed(() => props.kind !== "layout" || props.studioMode === "bubbles");
</script>

<template>
  <div class="editor-canvas">
    <p v-if="showHint && showBubbleLayer" class="editor-plate-hint" data-plate-hint role="status">
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
    <div v-if="kind === 'layout'" class="editor-toolbar-sticky">
      <LayoutToolbar
        :tool="layoutTool"
        :mode="studioMode"
        :grid="showGrid"
        @update:tool="emit('update-layout-tool', $event)"
        @update:mode="emit('update-studio-mode', $event)"
        @update:grid="showGrid = $event"
      />
    </div>
    <div class="editor-plate" :style="plateStyle">
      <img ref="imgEl" :src="src" alt="" />
      <EditorCaptionLayer
        v-if="imgEl && showBubbleLayer"
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
        @tail="(id, tail) => emit('tail', id, tail)"
      />
      <GeometryLayer
        v-if="imgEl && kind === 'layout'"
        :regions="regions"
        :selected-id="selectedId"
        :design-width="designWidth"
        :design-height="designHeight"
        :image-el="imgEl"
        :tool="layoutTool"
        :grid="showGrid && !showBubbleLayer"
        :interactive="!showBubbleLayer"
        @select="emit('select', $event)"
        @create="emit('create-region', $event)"
        @update-geometry="(id, g) => emit('update-region-geometry', id, g)"
        @persist-geometry="(id, g) => emit('persist-region-geometry', id, g)"
        @move-image="(id, x, y) => emit('move-region-image', id, x, y)"
        @persist-image="(id, x, y) => emit('persist-region-image', id, x, y)"
        @request-assign="emit('request-region-assign', $event)"
      />
    </div>
  </div>
</template>
