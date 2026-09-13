<script setup lang="ts">
/**
 * Floating tool switch over the Layout-mode canvas — draw tools are explicit so idle clicks never
 * start a shape. The bubbles/layout mode switch itself lives in the inspector column header
 * (PageStudio.vue), not here — it used to be the first button group in this floating toolbar,
 * which made it easy to miss since it's only visible while already in Layout mode.
 */
import { Magnet, MousePointer2, Pentagon, Square } from "@lucide/vue";
import type { LayoutTool } from "./GeometryLayer.vue";

export type StudioMode = "layout" | "bubbles";

defineProps<{ tool: LayoutTool; mode: StudioMode; grid?: boolean }>();
const emit = defineEmits<{
  "update:tool": [tool: LayoutTool];
  "update:grid": [grid: boolean];
}>();
</script>

<template>
  <div class="editor-layout-toolbar">
    <div v-if="mode === 'layout'" class="editor-toolbar-group" role="radiogroup" aria-label="Draw tool">
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
      <button
        class="editor-icon-btn"
        type="button"
        name="tool-grid-snap"
        :aria-pressed="!!grid"
        title="Snap to grid"
        @click="emit('update:grid', !grid)"
      >
        <Magnet :size="16" :stroke-width="1.6" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>
