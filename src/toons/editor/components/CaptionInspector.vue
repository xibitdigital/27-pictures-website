<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { defaultSize } from "../../bookReader/captions/captionModel";
import { editorApiBase, uploadAudio } from "../api";
import {
  BUBBLE_TAILS,
  BUBBLE_VARIANTS,
  CAPTION_LANGS,
  VOICE_NAMES,
  bubbleAudio,
  bubbleTextMap,
  bubbleVoice,
  extraPatch,
  suggestElevenPrompt,
  textPatch,
} from "../mapConfig";
import { resolveAssetUrl } from "../../bookReader/assetUrl";
import type { LangCode } from "../../bookReader/types";
import type { BubbleRecord } from "../types";

const SIZE_MIN = 10;
const SIZE_MAX = 100;
const ANGLE_MIN = -45;
const ANGLE_MAX = 45;

const props = defineProps<{
  bubble: BubbleRecord | null;
  toonId?: string;
  assetPageDir?: string | null;
  dirty?: boolean;
  saving?: boolean;
}>();

const emit = defineEmits<{
  change: [patch: Partial<BubbleRecord>];
  preview: [lang: LangCode];
  save: [];
  remove: [];
}>();

const textMap = computed(() => (props.bubble ? bubbleTextMap(props.bubble) : {}));
const sizeDraft = ref("");
const sizeFocused = ref(false);
const angleDraft = ref("");
const angleFocused = ref(false);
const copied = ref(false);
const uploading = ref(false);
const uploadError = ref("");
const audioFileInput = ref<HTMLInputElement | null>(null);
let copiedTimer = 0;

const elevenPrompt = computed(() => {
  if (!props.bubble) return "";
  const map = textMap.value;
  return suggestElevenPrompt({
    voice: bubbleVoice(props.bubble),
    text: map.en || props.bubble.textEn || "",
    variant: props.bubble.variant,
  });
});

onBeforeUnmount(() => window.clearTimeout(copiedTimer));

watch(
  () => props.bubble?.id,
  () => {
    copied.value = false;
    uploadError.value = "";
  }
);

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
  uploadError.value = "";
  try {
    const out = await uploadAudio(props.toonId, file);
    emit("change", extraPatch(props.bubble, "audio", out.audio));
  } catch (err) {
    uploadError.value = err instanceof Error ? err.message : "Upload failed";
  } finally {
    uploading.value = false;
  }
}

async function copyPrompt(): Promise<void> {
  const text = elevenPrompt.value;
  try {
    await navigator.clipboard.writeText(text);
    copied.value = true;
    window.clearTimeout(copiedTimer);
    copiedTimer = window.setTimeout(() => {
      copied.value = false;
    }, 1600);
  } catch {
    copied.value = false;
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
        Voice
        <select name="voice" :value="bubbleVoice(bubble)" @change="onVoiceChange">
          <option value="">None (SFX)</option>
          <option v-for="name in VOICE_NAMES" :key="name" :value="name">{{ name }}</option>
        </select>
      </label>
      <div class="editor-audio-field">
        <span class="editor-prompt-head">
          Audio
          <input
            ref="audioFileInput"
            type="file"
            name="audio-file"
            accept="audio/mpeg,.mp3"
            hidden
            :disabled="uploading || !toonId"
            @change="onAudioFile"
          />
          <button
            class="editor-icon-btn"
            type="button"
            name="audio-upload"
            :disabled="uploading || !toonId"
            :aria-label="uploading ? 'Uploading' : 'Upload audio'"
            :title="uploading ? 'Uploading' : 'Upload audio'"
            @click="audioFileInput?.click()"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M8 2.5v8M5 5.5 8 2.5 11 5.5M3 13.5h10" fill="none" stroke="currentColor" stroke-width="1.4" />
            </svg>
          </button>
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
        <p v-if="uploadError" class="editor-error" role="alert">{{ uploadError }}</p>
      </div>
      <label>
        <span class="editor-prompt-head">
          ElevenLabs Studio prompt
          <button
            class="editor-icon-btn"
            type="button"
            name="copy-prompt"
            :aria-label="copied ? 'Copied' : 'Copy prompt'"
            :title="copied ? 'Copied' : 'Copy prompt'"
            @click.prevent="copyPrompt"
          >
            <svg v-if="copied" width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3 8.5 6.5 12 13 4.5" fill="none" stroke="currentColor" stroke-width="1.6" />
            </svg>
            <svg v-else width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
              <rect x="5" y="4.5" width="8" height="9" rx="1" fill="none" stroke="currentColor" stroke-width="1.4" />
              <path d="M3.5 11.5V3.5H11" fill="none" stroke="currentColor" stroke-width="1.4" />
            </svg>
          </button>
        </span>
        <textarea name="eleven-prompt" rows="4" readonly :value="elevenPrompt" spellcheck="false" />
      </label>
      <div class="editor-form-actions">
        <button class="editor-btn" type="button" name="save" :disabled="!dirty || saving" @click="emit('save')">
          {{ saving ? "Saving…" : "Save" }}
        </button>
        <button class="editor-btn editor-btn--ghost" type="button" name="delete" @click="emit('remove')">
          Delete bubble
        </button>
      </div>
    </template>
  </aside>
</template>
