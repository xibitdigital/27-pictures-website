<script setup lang="ts">
/** Right-panel counterpart to CaptionInspector.vue for a selected Layout-mode region. */
import { ChevronDown, ChevronUp } from "@lucide/vue";
import { computed, ref, watch } from "vue";
import { MAX_IMAGE_SCALE, MIN_IMAGE_SCALE } from "../regionFit";
import type { RegionRecord } from "../types";

const props = defineProps<{
  region: RegionRecord | null;
  layerIndex?: number;
  layerCount?: number;
}>();

const emit = defineEmits<{
  reassign: [];
  scale: [value: number];
  "persist-scale": [value: number];
  reorder: [direction: "forward" | "backward"];
  remove: [];
}>();

const layerIndex = computed(() => props.layerIndex ?? 0);
const layerCount = computed(() => props.layerCount ?? 0);
const canMoveForward = computed(() => layerCount.value > 1 && layerIndex.value < layerCount.value - 1);
const canMoveBackward = computed(() => layerCount.value > 1 && layerIndex.value > 0);

const scaleDraft = ref(1);

watch(
  () => [props.region?.id, props.region?.imageScale] as const,
  () => {
    scaleDraft.value = props.region?.imageScale ?? 1;
  },
  { immediate: true }
);

const shapeLabel = computed(() => (props.region?.shapeType === "polygon" ? "Polygon" : "Rectangle"));

function onScaleInput(ev: Event): void {
  const n = Number((ev.target as HTMLInputElement).value);
  scaleDraft.value = n;
  emit("scale", n);
}

function onScaleChange(ev: Event): void {
  const n = Number((ev.target as HTMLInputElement).value);
  emit("persist-scale", n);
}
</script>

<template>
  <aside class="editor-inspector">
    <h2>Layout</h2>
    <p v-if="!region" class="editor-muted">
      Select a shape, or use the toolbar over the plate to draw a rectangle or polygon.
    </p>
    <template v-else>
      <p class="editor-inspector-subtitle">{{ shapeLabel }}{{ region.fileUrl ? "" : " — no image yet" }}</p>

      <div class="editor-audio-field">
        <span class="editor-prompt-head">
          Layer
          <span class="editor-prompt-actions">
            <button
              class="editor-icon-btn"
              type="button"
              name="layer-backward"
              :disabled="!canMoveBackward"
              aria-label="Send backward"
              title="Send backward"
              @click="emit('reorder', 'backward')"
            >
              <ChevronDown :size="14" :stroke-width="1.4" aria-hidden="true" />
            </button>
            <button
              class="editor-icon-btn"
              type="button"
              name="layer-forward"
              :disabled="!canMoveForward"
              aria-label="Bring forward"
              title="Bring forward"
              @click="emit('reorder', 'forward')"
            >
              <ChevronUp :size="14" :stroke-width="1.4" aria-hidden="true" />
            </button>
          </span>
        </span>
        <p class="editor-muted">{{ layerIndex + 1 }} of {{ layerCount || 1 }} — later layers paint on top</p>
      </div>

      <button
        class="editor-btn editor-btn--ghost editor-field-btn"
        type="button"
        name="region-reassign"
        @click="emit('reassign')"
      >
        {{ region.fileUrl ? "Replace image" : "Add image" }}
      </button>

      <label v-if="region.fileUrl">
        Zoom
        <input
          type="range"
          name="region-scale"
          :min="MIN_IMAGE_SCALE"
          :max="MAX_IMAGE_SCALE"
          step="0.05"
          :value="scaleDraft"
          :aria-valuemin="MIN_IMAGE_SCALE"
          :aria-valuemax="MAX_IMAGE_SCALE"
          :aria-valuenow="scaleDraft"
          @input="onScaleInput"
          @change="onScaleChange"
        />
      </label>

      <button
        class="editor-btn editor-btn--ghost editor-field-btn"
        type="button"
        name="region-delete"
        @click="emit('remove')"
      >
        Delete shape
      </button>
    </template>
  </aside>
</template>
