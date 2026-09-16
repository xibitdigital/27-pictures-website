<script setup lang="ts">
/**
 * Floating tool switch over the plate. Layout draw tools are explicit so idle clicks never
 * start a shape. Bubbles mode gets the same chrome: select (move / click-to-add) vs reshape
 * (drag the balloon's spline handles). The layout/bubbles mode switch itself lives in the
 * inspector column header (PageStudio.vue), not here.
 */
import { Magnet, Move, MousePointer2, Pentagon, RotateCcw, Spline, Square } from "@lucide/vue";
import type { LayoutTool } from "./GeometryLayer.vue";
import EditorIconButton from "./ui/EditorIconButton.vue";

export type StudioMode = "layout" | "bubbles";
export type BubbleTool = "select" | "reshape";

defineProps<{
  tool: LayoutTool;
  mode: StudioMode;
  grid?: boolean;
  bubbleTool?: BubbleTool;
  canResetShape?: boolean;
}>();
const emit = defineEmits<{
  "update:tool": [tool: LayoutTool];
  "update:grid": [grid: boolean];
  "update:bubbleTool": [tool: BubbleTool];
  "reset-shape": [];
}>();
</script>

<template>
  <div class="editor-layout-toolbar">
    <div v-if="mode === 'layout'" class="editor-toolbar-group" role="radiogroup" aria-label="Draw tool">
      <EditorIconButton
        name="tool-select"
        :aria-pressed="tool === 'select'"
        title="Select"
        @click="emit('update:tool', 'select')"
      >
        <MousePointer2 :size="16" :stroke-width="1.6" aria-hidden="true" />
      </EditorIconButton>
      <EditorIconButton
        name="tool-rect"
        :aria-pressed="tool === 'rect'"
        title="Draw rectangle"
        @click="emit('update:tool', 'rect')"
      >
        <Square :size="16" :stroke-width="1.6" aria-hidden="true" />
      </EditorIconButton>
      <EditorIconButton
        name="tool-polygon"
        :aria-pressed="tool === 'polygon'"
        title="Draw polygon — click to place points, double-click or Enter to close"
        @click="emit('update:tool', 'polygon')"
      >
        <Pentagon :size="16" :stroke-width="1.6" aria-hidden="true" />
      </EditorIconButton>
      <EditorIconButton
        name="tool-move"
        :aria-pressed="tool === 'move'"
        title="Move — drag a region to reposition it, same size"
        @click="emit('update:tool', 'move')"
      >
        <Move :size="16" :stroke-width="1.6" aria-hidden="true" />
      </EditorIconButton>
      <EditorIconButton
        name="tool-grid-snap"
        :aria-pressed="!!grid"
        title="Snap to grid"
        @click="emit('update:grid', !grid)"
      >
        <Magnet :size="16" :stroke-width="1.6" aria-hidden="true" />
      </EditorIconButton>
    </div>
    <div v-else class="editor-toolbar-group" role="radiogroup" aria-label="Bubble tool">
      <EditorIconButton
        name="tool-select"
        :aria-pressed="bubbleTool !== 'reshape'"
        title="Select — drag to move, click empty plate to add"
        @click="emit('update:bubbleTool', 'select')"
      >
        <MousePointer2 :size="16" :stroke-width="1.6" aria-hidden="true" />
      </EditorIconButton>
      <EditorIconButton
        name="tool-reshape"
        :aria-pressed="bubbleTool === 'reshape'"
        title="Reshape — drag control points to change the balloon"
        @click="emit('update:bubbleTool', 'reshape')"
      >
        <Spline :size="16" :stroke-width="1.6" aria-hidden="true" />
      </EditorIconButton>
      <EditorIconButton
        name="tool-reset-shape"
        title="Reset shape to the default balloon"
        :disabled="!canResetShape"
        @click="emit('reset-shape')"
      >
        <RotateCcw :size="16" :stroke-width="1.6" aria-hidden="true" />
      </EditorIconButton>
    </div>
  </div>
</template>
