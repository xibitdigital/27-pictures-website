<script setup lang="ts">
/** Floating tool switch over the Layout-mode canvas — draw tools are explicit so idle clicks never start a shape. */
import { LayoutGrid, MessageSquare, MousePointer2, Pentagon, Square } from "@lucide/vue";
import type { LayoutTool } from "./GeometryLayer.vue";

export type StudioMode = "layout" | "bubbles";

defineProps<{ tool: LayoutTool; mode: StudioMode }>();
const emit = defineEmits<{ "update:tool": [tool: LayoutTool]; "update:mode": [mode: StudioMode] }>();
</script>

<template>
  <div class="editor-layout-toolbar">
    <div class="editor-toolbar-group" role="radiogroup" aria-label="Studio mode">
      <button
        class="editor-icon-btn"
        type="button"
        name="mode-layout"
        :aria-pressed="mode === 'layout'"
        title="Layout — draw and fill panels"
        @click="emit('update:mode', 'layout')"
      >
        <LayoutGrid :size="16" :stroke-width="1.6" aria-hidden="true" />
      </button>
      <button
        class="editor-icon-btn"
        type="button"
        name="mode-bubbles"
        :aria-pressed="mode === 'bubbles'"
        title="Bubbles — place captions on the flattened plate"
        @click="emit('update:mode', 'bubbles')"
      >
        <MessageSquare :size="16" :stroke-width="1.6" aria-hidden="true" />
      </button>
    </div>
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
    </div>
  </div>
</template>
