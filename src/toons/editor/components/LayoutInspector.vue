<script setup lang="ts">
/** Right-panel counterpart to CaptionInspector.vue for a selected Layout-mode region. */
import { computed, ref, watch } from "vue";
import { MAX_IMAGE_SCALE, MIN_IMAGE_SCALE } from "../regionFit";
import type { RegionRecord } from "../types";

const props = defineProps<{
  region: RegionRecord | null;
  dirty?: boolean;
  saving?: boolean;
}>();

const emit = defineEmits<{
  reassign: [];
  scale: [value: number];
  "persist-scale": [value: number];
  remove: [];
  save: [];
}>();

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
      <p class="editor-muted">{{ shapeLabel }}{{ region.fileUrl ? "" : " — no image yet" }}</p>
      <div class="editor-form-actions">
        <button class="editor-btn editor-btn--ghost" type="button" name="region-reassign" @click="emit('reassign')">
          {{ region.fileUrl ? "Replace image" : "Add image" }}
        </button>
      </div>
      <label v-if="region.fileUrl">
        Zoom
        <span class="editor-slider-row">
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
        </span>
      </label>
      <div class="editor-form-actions">
        <button class="editor-btn editor-btn--ghost" type="button" name="region-delete" @click="emit('remove')">
          Delete shape
        </button>
      </div>
      <div class="editor-form-actions">
        <button class="editor-btn" type="button" name="save-layout" :disabled="!dirty || saving" @click="emit('save')">
          {{ saving ? "Saving…" : dirty ? "Retry flatten" : "Layout saved" }}
        </button>
      </div>
    </template>
  </aside>
</template>
