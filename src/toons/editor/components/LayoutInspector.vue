<script setup lang="ts">
/** Right-panel counterpart to CaptionInspector.vue for a selected Layout-mode region. */
import { ChevronDown, ChevronUp } from "@lucide/vue";
import { computed, ref, watch } from "vue";
import { parseHexColor } from "../mapConfig";
import { scaleFromSliderPosition, sliderPositionFromScale } from "../regionFit";
import type { RegionBorderStyle, RegionRecord } from "../types";
import EditorSelect from "./ui/EditorSelect.vue";
import EditorSelectItem from "./ui/EditorSelectItem.vue";

const FALLBACK_SWATCH = "#111111";
const DEFAULT_BORDER_WIDTH = 2;
const BORDER_WIDTH_MAX = 20;

type BorderPatch = { borderColor?: string | null; borderWidth?: number; borderStyle?: RegionBorderStyle };

const props = defineProps<{
  region: RegionRecord | null;
  layerIndex?: number;
  layerCount?: number;
  /** Editor-set backdrop color for the whole page, shown through any gap between regions. Independent of which (if any) region is selected. */
  pageBgColor?: string | null;
}>();

const emit = defineEmits<{
  reassign: [];
  scale: [value: number];
  "persist-scale": [value: number];
  border: [patch: BorderPatch];
  "persist-border": [patch: BorderPatch];
  reorder: [direction: "forward" | "backward"];
  remove: [];
  "page-bg-color": [value: string | null];
  "persist-page-bg-color": [value: string | null];
}>();

const layerIndex = computed(() => props.layerIndex ?? 0);
const layerCount = computed(() => props.layerCount ?? 0);
const canMoveForward = computed(() => layerCount.value > 1 && layerIndex.value < layerCount.value - 1);
const canMoveBackward = computed(() => layerCount.value > 1 && layerIndex.value > 0);

/** 0-100 track position, not the raw imageScale — position 50 is always "no zoom" (scale 1), see scaleFromSliderPosition. */
const scaleSliderDraft = ref(50);

watch(
  () => [props.region?.id, props.region?.imageScale] as const,
  () => {
    scaleSliderDraft.value = sliderPositionFromScale(props.region?.imageScale ?? 1);
  },
  { immediate: true }
);

const shapeLabel = computed(() => (props.region?.shapeType === "polygon" ? "Polygon" : "Rectangle"));

const scaleValue = computed(() => scaleFromSliderPosition(scaleSliderDraft.value));

function onScaleInput(ev: Event): void {
  const position = Number((ev.target as HTMLInputElement).value);
  scaleSliderDraft.value = position;
  emit("scale", scaleFromSliderPosition(position));
}

function onScaleChange(ev: Event): void {
  const position = Number((ev.target as HTMLInputElement).value);
  emit("persist-scale", scaleFromSliderPosition(position));
}

// --- Page background color — always visible, independent of region selection ---

const pageBgDraft = ref("");

watch(
  () => props.pageBgColor,
  (v) => {
    pageBgDraft.value = v || "";
  },
  { immediate: true }
);

const pageBgSwatch = computed(() => parseHexColor(pageBgDraft.value) || FALLBACK_SWATCH);

function onPageBgPicker(ev: Event): void {
  const hex = parseHexColor((ev.target as HTMLInputElement).value);
  if (!hex) return;
  pageBgDraft.value = hex;
  emit("page-bg-color", hex);
  emit("persist-page-bg-color", hex);
}

function onPageBgInput(ev: Event): void {
  pageBgDraft.value = (ev.target as HTMLInputElement).value;
  const hex = parseHexColor(pageBgDraft.value);
  if (hex) emit("page-bg-color", hex);
}

function onPageBgBlur(): void {
  const hex = parseHexColor(pageBgDraft.value);
  pageBgDraft.value = hex || "";
  emit("persist-page-bg-color", hex);
}

// --- Region border ---

type BorderOption = "none" | RegionBorderStyle;

const borderOption = computed<BorderOption>(() =>
  props.region && props.region.borderWidth > 0 ? props.region.borderStyle : "none"
);

function onBorderOptionChange(value: string): void {
  if (value === "none") {
    emit("persist-border", { borderWidth: 0 });
    return;
  }
  const style = value as RegionBorderStyle;
  const width = props.region && props.region.borderWidth > 0 ? props.region.borderWidth : DEFAULT_BORDER_WIDTH;
  emit("persist-border", { borderStyle: style, borderWidth: width });
}

const borderColorDraft = ref("");

watch(
  () => [props.region?.id, props.region?.borderColor] as const,
  () => {
    borderColorDraft.value = props.region?.borderColor || "";
  },
  { immediate: true }
);

const borderColorSwatch = computed(() => parseHexColor(borderColorDraft.value) || FALLBACK_SWATCH);

function onBorderColorPicker(ev: Event): void {
  const hex = parseHexColor((ev.target as HTMLInputElement).value);
  if (!hex) return;
  borderColorDraft.value = hex;
  emit("persist-border", { borderColor: hex });
}

function onBorderColorInput(ev: Event): void {
  borderColorDraft.value = (ev.target as HTMLInputElement).value;
  const hex = parseHexColor(borderColorDraft.value);
  if (hex) emit("border", { borderColor: hex });
}

function onBorderColorBlur(): void {
  const hex = parseHexColor(borderColorDraft.value);
  borderColorDraft.value = hex || "";
  emit("persist-border", { borderColor: hex });
}

const borderWidthDraft = ref(DEFAULT_BORDER_WIDTH);

watch(
  () => [props.region?.id, props.region?.borderWidth] as const,
  () => {
    borderWidthDraft.value = props.region?.borderWidth || DEFAULT_BORDER_WIDTH;
  },
  { immediate: true }
);

function onBorderWidthInput(ev: Event): void {
  const n = Number((ev.target as HTMLInputElement).value);
  borderWidthDraft.value = n;
  emit("border", { borderWidth: n });
}

function onBorderWidthChange(ev: Event): void {
  const n = Number((ev.target as HTMLInputElement).value);
  emit("persist-border", { borderWidth: n });
}
</script>

<template>
  <aside class="editor-inspector">
    <h2>Layout</h2>

    <label>
      Page background
      <span class="editor-color-row">
        <input
          type="color"
          name="page-bg-swatch"
          :value="pageBgSwatch"
          :aria-label="pageBgDraft ? 'Page background color' : 'Page background color (default)'"
          @input="onPageBgPicker"
        />
        <input
          type="text"
          name="page-bg-color"
          :value="pageBgDraft"
          placeholder="default"
          spellcheck="false"
          autocomplete="off"
          @input="onPageBgInput"
          @blur="onPageBgBlur"
        />
      </span>
    </label>

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
        <span class="editor-muted">{{ scaleValue.toFixed(2) }}×</span>
        <input
          type="range"
          name="region-scale"
          min="0"
          max="100"
          step="0.5"
          :value="scaleSliderDraft"
          aria-valuemin="0.25"
          aria-valuemax="4"
          :aria-valuenow="scaleValue"
          @input="onScaleInput"
          @change="onScaleChange"
        />
      </label>

      <label>
        Border
        <EditorSelect
          name="region-border-style"
          :model-value="borderOption"
          aria-label="Border style"
          @update:model-value="onBorderOptionChange"
        >
          <EditorSelectItem value="none">None</EditorSelectItem>
          <EditorSelectItem value="solid">Solid</EditorSelectItem>
          <EditorSelectItem value="dashed">Dashed</EditorSelectItem>
          <EditorSelectItem value="dotted">Dotted</EditorSelectItem>
        </EditorSelect>
      </label>

      <template v-if="borderOption !== 'none'">
        <label>
          Border color
          <span class="editor-color-row">
            <input
              type="color"
              name="region-border-color-swatch"
              :value="borderColorSwatch"
              :aria-label="borderColorDraft ? 'Border color' : 'Border color (default)'"
              @input="onBorderColorPicker"
            />
            <input
              type="text"
              name="region-border-color"
              :value="borderColorDraft"
              placeholder="default"
              spellcheck="false"
              autocomplete="off"
              @input="onBorderColorInput"
              @blur="onBorderColorBlur"
            />
          </span>
        </label>
        <label>
          Border width
          <input
            type="range"
            name="region-border-width"
            min="1"
            :max="BORDER_WIDTH_MAX"
            step="1"
            :value="borderWidthDraft"
            :aria-valuemin="1"
            :aria-valuemax="BORDER_WIDTH_MAX"
            :aria-valuenow="borderWidthDraft"
            @input="onBorderWidthInput"
            @change="onBorderWidthChange"
          />
        </label>
      </template>

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
