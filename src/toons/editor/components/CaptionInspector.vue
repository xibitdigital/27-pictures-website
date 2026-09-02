<script setup lang="ts">
import { Upload, WandSparkles } from "@lucide/vue";
import { computed, ref, watch } from "vue";
import { defaultSize } from "../../bookReader/captions/captionModel";
import { editorApiBase, generateAudio, uploadAudio } from "../api";
import { pushToast } from "../toast";
import {
  BUBBLE_TAILS,
  BUBBLE_VARIANTS,
  CAPTION_LANGS,
  VOICE_NAMES,
  bubbleAudio,
  bubbleColor,
  bubbleStrokeColor,
  bubbleStrokeThickness,
  bubbleTextMap,
  bubbleVoice,
  extraPatch,
  letteringPatch,
  parseHexColor,
  spokenElevenLine,
  textPatch,
} from "../mapConfig";
import { resolveAssetUrl } from "../../bookReader/assetUrl";
import type { LangCode } from "../../bookReader/types";
import type { BubbleRecord } from "../types";

const SIZE_MIN = 10;
const SIZE_MAX = 100;
const ANGLE_MIN = -45;
const ANGLE_MAX = 45;
const STROKE_MIN = 0;
const STROKE_MAX = 16;
const FALLBACK_SWATCH = "#111111";

const props = defineProps<{
  bubble: BubbleRecord | null;
  toonId?: string;
  assetPageDir?: string | null;
}>();

const emit = defineEmits<{
  change: [patch: Partial<BubbleRecord>];
  preview: [lang: LangCode];
  remove: [];
}>();

const textMap = computed(() => (props.bubble ? bubbleTextMap(props.bubble) : {}));
const sizeDraft = ref("");
const sizeFocused = ref(false);
const angleDraft = ref("");
const angleFocused = ref(false);
const colorDraft = ref("");
const strokeDraft = ref("");
const strokeThickDraft = ref("");
const strokeThickFocused = ref(false);
const uploading = ref(false);
const generating = ref(false);
const audioFileInput = ref<HTMLInputElement | null>(null);
const audioBusy = computed(() => uploading.value || generating.value);

const englishLine = computed(() => {
  if (!props.bubble) return "";
  return (textMap.value.en || props.bubble.textEn || "").trim();
});

const spokenLine = computed(() => {
  if (!props.bubble) return "";
  return spokenElevenLine({ text: englishLine.value, variant: props.bubble.variant });
});

const canGenerateAudio = computed(() => Boolean(props.toonId && spokenLine.value && props.bubble));

function audioPreviewSrc(path: string): string {
  if (!path) return "";
  if (/^https?:\/\//i.test(path) || path.startsWith("data:") || path.startsWith("blob:")) return path;
  if (path.startsWith("editor/")) {
    const base = editorApiBase();
    return base ? `${base}/media/${path}` : "";
  }
  try {
    return resolveAssetUrl(path, props.assetPageDir || undefined);
  } catch {
    return path;
  }
}

const audioSrc = computed(() => (props.bubble ? audioPreviewSrc(bubbleAudio(props.bubble)) : ""));

watch(
  () => [props.bubble?.id, props.bubble?.size] as const,
  () => {
    if (sizeFocused.value) return;
    sizeDraft.value = props.bubble?.size != null ? String(props.bubble.size) : "";
  },
  { immediate: true }
);

watch(
  () => [props.bubble?.id, props.bubble?.angle] as const,
  () => {
    if (angleFocused.value) return;
    angleDraft.value = props.bubble?.angle != null ? String(props.bubble.angle) : "";
  },
  { immediate: true }
);

watch(
  () => [props.bubble?.id, props.bubble?.extraJson] as const,
  () => {
    if (!props.bubble) {
      colorDraft.value = "";
      strokeDraft.value = "";
      if (!strokeThickFocused.value) strokeThickDraft.value = "";
      return;
    }
    colorDraft.value = bubbleColor(props.bubble);
    strokeDraft.value = bubbleStrokeColor(props.bubble);
    if (strokeThickFocused.value) return;
    const thick = bubbleStrokeThickness(props.bubble);
    strokeThickDraft.value = thick != null ? String(thick) : "";
  },
  { immediate: true }
);

const colorSwatch = computed(() => parseHexColor(colorDraft.value) || FALLBACK_SWATCH);
const strokeSwatch = computed(() => parseHexColor(strokeDraft.value) || FALLBACK_SWATCH);

function onColorPicker(ev: Event): void {
  if (!props.bubble) return;
  const hex = parseHexColor((ev.target as HTMLInputElement).value);
  if (!hex) return;
  colorDraft.value = hex;
  emit("change", letteringPatch(props.bubble, { color: hex }));
}

function onColorInput(ev: Event): void {
  if (!props.bubble) return;
  colorDraft.value = (ev.target as HTMLInputElement).value;
  const hex = parseHexColor(colorDraft.value);
  if (hex) emit("change", letteringPatch(props.bubble, { color: hex }));
}

function onColorBlur(): void {
  if (!props.bubble) return;
  const hex = parseHexColor(colorDraft.value);
  colorDraft.value = hex || "";
  emit("change", letteringPatch(props.bubble, { color: hex }));
}

function onStrokePicker(ev: Event): void {
  if (!props.bubble) return;
  const hex = parseHexColor((ev.target as HTMLInputElement).value);
  if (!hex) return;
  strokeDraft.value = hex;
  emit("change", letteringPatch(props.bubble, { stroke: hex }));
}

function onStrokeInput(ev: Event): void {
  if (!props.bubble) return;
  strokeDraft.value = (ev.target as HTMLInputElement).value;
  const hex = parseHexColor(strokeDraft.value);
  if (hex) emit("change", letteringPatch(props.bubble, { stroke: hex }));
}

function onStrokeBlur(): void {
  if (!props.bubble) return;
  const hex = parseHexColor(strokeDraft.value);
  strokeDraft.value = hex || "";
  emit("change", letteringPatch(props.bubble, { stroke: hex }));
}

function parseStrokeThick(raw: string): number | null {
  if (raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function clampStrokeThick(n: number): number {
  return Math.max(STROKE_MIN, Math.min(STROKE_MAX, Math.round(n)));
}

const strokeThickSlider = computed(() => {
  const n = parseStrokeThick(strokeThickDraft.value);
  if (n != null) return clampStrokeThick(n);
  return STROKE_MIN;
});

function onStrokeThickSlider(ev: Event): void {
  if (!props.bubble) return;
  const n = clampStrokeThick(Number((ev.target as HTMLInputElement).value));
  strokeThickDraft.value = String(n);
  emit("change", letteringPatch(props.bubble, { strokeThickness: n }));
}

function onStrokeThickInput(ev: Event): void {
  if (!props.bubble) return;
  const raw = (ev.target as HTMLInputElement).value;
  strokeThickDraft.value = raw;
  const n = parseStrokeThick(raw);
  emit("change", letteringPatch(props.bubble, { strokeThickness: n == null ? null : Math.round(n) }));
}

function onStrokeThickBlur(): void {
  if (!props.bubble) return;
  strokeThickFocused.value = false;
  const n = parseStrokeThick(strokeThickDraft.value);
  if (n == null) {
    strokeThickDraft.value = "";
    emit("change", letteringPatch(props.bubble, { strokeThickness: null }));
    return;
  }
  const clamped = clampStrokeThick(n);
  strokeThickDraft.value = String(clamped);
  emit("change", letteringPatch(props.bubble, { strokeThickness: clamped }));
}

function onLangInput(lang: LangCode, ev: Event): void {
  if (!props.bubble) return;
  const value = (ev.target as HTMLTextAreaElement).value;
  emit("preview", lang);
  emit("change", textPatch(props.bubble, lang, value));
}

function parseSize(raw: string): number | null {
  if (raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function clampSize(n: number): number {
  return Math.max(SIZE_MIN, Math.min(SIZE_MAX, Math.round(n)));
}

const sizeSlider = computed(() => {
  const n = parseSize(sizeDraft.value);
  if (n != null) return clampSize(n);
  return clampSize(defaultSize(props.bubble?.variant || "bubble"));
});

function onSizeInput(ev: Event): void {
  const raw = (ev.target as HTMLInputElement).value;
  sizeDraft.value = raw;
  const n = parseSize(raw);
  // Do not clamp while typing: min 10 turned "3" into "10", then the next
  // keystroke made "100" when the user meant "30".
  emit("change", { size: n == null ? null : Math.round(n) });
}

function onSizeSlider(ev: Event): void {
  const n = clampSize(Number((ev.target as HTMLInputElement).value));
  sizeDraft.value = String(n);
  emit("change", { size: n });
}

function onSizeBlur(): void {
  sizeFocused.value = false;
  const n = parseSize(sizeDraft.value);
  if (n == null) {
    sizeDraft.value = "";
    emit("change", { size: null });
    return;
  }
  const clamped = clampSize(n);
  sizeDraft.value = String(clamped);
  emit("change", { size: clamped });
}

function parseAngle(raw: string): number | null {
  if (raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function clampAngle(n: number): number {
  return Math.max(ANGLE_MIN, Math.min(ANGLE_MAX, Math.round(n)));
}

const angleSlider = computed(() => {
  const n = parseAngle(angleDraft.value);
  if (n != null) return clampAngle(n);
  return 0;
});

function onAngleInput(ev: Event): void {
  const raw = (ev.target as HTMLInputElement).value;
  angleDraft.value = raw;
  const n = parseAngle(raw);
  emit("change", { angle: n == null ? null : Math.round(n) });
}

function onAngleSlider(ev: Event): void {
  const n = clampAngle(Number((ev.target as HTMLInputElement).value));
  angleDraft.value = String(n);
  emit("change", { angle: n });
}

function onAngleBlur(): void {
  angleFocused.value = false;
  const n = parseAngle(angleDraft.value);
  if (n == null) {
    angleDraft.value = "";
    emit("change", { angle: null });
    return;
  }
  const clamped = clampAngle(n);
  angleDraft.value = String(clamped);
  emit("change", { angle: clamped });
}

function onAudioInput(ev: Event): void {
  if (!props.bubble) return;
  emit("change", extraPatch(props.bubble, "audio", (ev.target as HTMLInputElement).value));
}

function onAudioBlur(ev: Event): void {
  if (!props.bubble) return;
  const trimmed = (ev.target as HTMLInputElement).value.trim();
  emit("change", extraPatch(props.bubble, "audio", trimmed));
}

function onVoiceChange(ev: Event): void {
  if (!props.bubble) return;
  emit("change", extraPatch(props.bubble, "voice", (ev.target as HTMLSelectElement).value));
}

async function onAudioFile(ev: Event): Promise<void> {
  const input = ev.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file || !props.bubble || !props.toonId) return;
  uploading.value = true;
  try {
    const out = await uploadAudio(props.toonId, file);
    emit("change", extraPatch(props.bubble, "audio", out.audio));
  } catch (err) {
    pushToast(err instanceof Error ? err.message : "Upload failed");
  } finally {
    uploading.value = false;
  }
}

async function onGenerateAudio(): Promise<void> {
  if (!props.bubble || !props.toonId || !canGenerateAudio.value) return;
  generating.value = true;
  try {
    const out = await generateAudio(props.toonId, {
      text: spokenLine.value,
      voice: bubbleVoice(props.bubble),
      model: "eleven_v3",
      stability: 0.3,
    });
    emit("change", extraPatch(props.bubble, "audio", out.audio));
  } catch (err) {
    pushToast(err instanceof Error ? err.message : "Generate failed");
  } finally {
    generating.value = false;
  }
}
</script>

<template>
  <aside class="editor-inspector">
    <h2>Bubble</h2>
    <p v-if="!bubble" class="editor-muted">Select a bubble, or click the plate to add one.</p>
    <template v-else>
      <div class="editor-pair-row">
        <label>
          Variant
          <select
            name="variant"
            :value="bubble.variant"
            @change="emit('change', { variant: ($event.target as HTMLSelectElement).value })"
          >
            <option v-for="v in BUBBLE_VARIANTS" :key="v" :value="v">{{ v }}</option>
          </select>
        </label>
        <label>
          Tail
          <select
            name="tail"
            :value="bubble.tail || 'bottom-left'"
            @change="emit('change', { tail: ($event.target as HTMLSelectElement).value })"
          >
            <option v-for="t in BUBBLE_TAILS" :key="t" :value="t">{{ t }}</option>
          </select>
        </label>
      </div>
      <label v-for="lang in CAPTION_LANGS" :key="lang.code">
        {{ lang.label }}
        <textarea
          :value="textMap[lang.code] || ''"
          rows="3"
          :lang="lang.code"
          @focus="emit('preview', lang.code)"
          @input="onLangInput(lang.code, $event)"
        />
      </label>
      <label>
        Size
        <span class="editor-slider-row">
          <input
            type="range"
            name="size-slider"
            :min="SIZE_MIN"
            :max="SIZE_MAX"
            step="1"
            :value="sizeSlider"
            :aria-valuemin="SIZE_MIN"
            :aria-valuemax="SIZE_MAX"
            :aria-valuenow="sizeSlider"
            @input="onSizeSlider"
          />
          <input
            type="number"
            name="size"
            :min="SIZE_MIN"
            :max="SIZE_MAX"
            step="1"
            v-model="sizeDraft"
            :placeholder="String(defaultSize(bubble.variant))"
            @focus="sizeFocused = true"
            @input="onSizeInput"
            @blur="onSizeBlur"
          />
        </span>
      </label>
      <label>
        Angle
        <span class="editor-slider-row">
          <input
            type="range"
            name="angle-slider"
            min="-45"
            max="45"
            step="1"
            :value="angleSlider"
            :aria-valuemin="-45"
            :aria-valuemax="45"
            :aria-valuenow="angleSlider"
            @input="onAngleSlider"
          />
          <input
            type="number"
            name="angle"
            min="-45"
            max="45"
            step="1"
            v-model="angleDraft"
            placeholder="0"
            @focus="angleFocused = true"
            @input="onAngleInput"
            @blur="onAngleBlur"
          />
        </span>
      </label>
      <label>
        Color
        <span class="editor-color-row">
          <input
            type="color"
            name="color-swatch"
            :value="colorSwatch"
            :aria-label="colorDraft ? 'Lettering color' : 'Lettering color (default)'"
            @input="onColorPicker"
          />
          <input
            type="text"
            name="color"
            :value="colorDraft"
            placeholder="default"
            spellcheck="false"
            autocomplete="off"
            @input="onColorInput"
            @blur="onColorBlur"
          />
        </span>
      </label>
      <label>
        Stroke
        <span class="editor-color-row">
          <input
            type="color"
            name="stroke-swatch"
            :value="strokeSwatch"
            :aria-label="strokeDraft ? 'Lettering stroke' : 'Lettering stroke (default)'"
            @input="onStrokePicker"
          />
          <input
            type="text"
            name="stroke"
            :value="strokeDraft"
            placeholder="default"
            spellcheck="false"
            autocomplete="off"
            @input="onStrokeInput"
            @blur="onStrokeBlur"
          />
        </span>
      </label>
      <label>
        Stroke thickness
        <span class="editor-slider-row">
          <input
            type="range"
            name="stroke-thickness-slider"
            :min="STROKE_MIN"
            :max="STROKE_MAX"
            step="1"
            :value="strokeThickSlider"
            :aria-valuemin="STROKE_MIN"
            :aria-valuemax="STROKE_MAX"
            :aria-valuenow="strokeThickSlider"
            @input="onStrokeThickSlider"
          />
          <input
            type="number"
            name="stroke-thickness"
            :min="STROKE_MIN"
            :max="STROKE_MAX"
            step="1"
            v-model="strokeThickDraft"
            placeholder="default"
            @focus="strokeThickFocused = true"
            @input="onStrokeThickInput"
            @blur="onStrokeThickBlur"
          />
        </span>
      </label>
      <label>
        Voice
        <select name="voice" :value="bubbleVoice(bubble)" @change="onVoiceChange">
          <option value="">None (SFX)</option>
          <option v-for="name in VOICE_NAMES" :key="name" :value="name">{{ name }}</option>
        </select>
      </label>
      <div class="editor-audio-field">
        <span class="editor-prompt-head">
          Audio
          <span class="editor-prompt-actions">
            <input
              ref="audioFileInput"
              type="file"
              name="audio-file"
              accept="audio/mpeg,.mp3"
              hidden
              :disabled="audioBusy || !toonId"
              @change="onAudioFile"
            />
            <button
              class="editor-icon-btn"
              type="button"
              name="audio-upload"
              :disabled="audioBusy || !toonId"
              :aria-label="uploading ? 'Uploading' : 'Upload audio'"
              :title="uploading ? 'Uploading' : 'Upload audio'"
              @click="audioFileInput?.click()"
            >
              <Upload :size="14" :stroke-width="1.4" aria-hidden="true" />
            </button>
            <button
              class="editor-icon-btn"
              type="button"
              name="audio-generate"
              :disabled="audioBusy || !canGenerateAudio"
              :aria-label="generating ? 'Generating' : 'Generate audio'"
              :title="
                generating
                  ? 'Generating'
                  : canGenerateAudio
                    ? bubbleVoice(bubble)
                      ? 'Generate voice with ElevenLabs'
                      : 'Generate SFX with ElevenLabs'
                    : 'Type an English caption first'
              "
              @click="onGenerateAudio"
            >
              <WandSparkles :size="14" :stroke-width="1.4" aria-hidden="true" />
            </button>
          </span>
        </span>
        <input
          type="text"
          name="audio"
          :value="bubbleAudio(bubble)"
          placeholder="assets/sfx/….mp3"
          spellcheck="false"
          autocomplete="off"
          @input="onAudioInput"
          @blur="onAudioBlur"
        />
        <audio v-if="audioSrc" controls preload="none" :src="audioSrc" />
      </div>
      <div class="editor-form-actions">
        <button class="editor-btn editor-btn--ghost" type="button" name="delete" @click="emit('remove')">
          Delete bubble
        </button>
      </div>
    </template>
  </aside>
</template>
