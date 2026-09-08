<script setup lang="ts">
/** Floating tool switch over the Layout-mode canvas — draw tools are explicit so idle clicks never start a shape. */
import { MousePointer2, Pentagon, Square } from "@lucide/vue";
import type { LayoutTool } from "./GeometryLayer.vue";

defineProps<{ tool: LayoutTool }>();
const emit = defineEmits<{ "update:tool": [tool: LayoutTool] }>();
</script>

<template>
  <div class="editor-layout-toolbar" role="radiogroup" aria-label="Draw tool">
    <button
      class="editor-icon-btn"
      type="button"
      name="tool-select"
      :aria-pressed="tool === 'select'"
      title="Select"
      @click="emit('update:tool', 'select')"
    >
      <MousePointer2 :size="16" :stroke-width="1.6" aria-hidden="true" />
    </button>
    <button
      class="editor-icon-btn"
      type="button"
      name="tool-rect"
      :aria-pressed="tool === 'rect'"
      title="Draw rectangle"
      @click="emit('update:tool', 'rect')"
    >
      <Square :size="16" :stroke-width="1.6" aria-hidden="true" />
    </button>
    <button
      class="editor-icon-btn"
      type="button"
      name="tool-polygon"
      :aria-pressed="tool === 'polygon'"
      title="Draw polygon — click to place points, double-click or Enter to close"
      @click="emit('update:tool', 'polygon')"
    >
      <Pentagon :size="16" :stroke-width="1.6" aria-hidden="true" />
    </button>
  </div>
</template>
