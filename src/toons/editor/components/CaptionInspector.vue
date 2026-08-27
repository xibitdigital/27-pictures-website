<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { defaultSize } from "../../bookReader/captions/captionModel";
import {
  BUBBLE_TAILS,
  BUBBLE_VARIANTS,
  CAPTION_LANGS,
  bubbleAudio,
  bubbleTextMap,
  extraPatch,
  textPatch,
} from "../mapConfig";
import type { LangCode } from "../../bookReader/types";
import type { BubbleRecord } from "../types";

const SIZE_MIN = 8;
const SIZE_MAX = 120;

const props = defineProps<{
  bubble: BubbleRecord | null;
}>();

const emit = defineEmits<{
  change: [patch: Partial<BubbleRecord>];
  preview: [lang: LangCode];
  remove: [];
}>();

const textMap = computed(() => (props.bubble ? bubbleTextMap(props.bubble) : {}));
const sizeDraft = ref("");
const sizeFocused = ref(false);

watch(
  () => [props.bubble?.id, props.bubble?.size] as const,
  () => {
    if (sizeFocused.value) return;
    sizeDraft.value = props.bubble?.size != null ? String(props.bubble.size) : "";
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

function onSizeInput(ev: Event): void {
  const raw = (ev.target as HTMLInputElement).value;
  sizeDraft.value = raw;
  const n = parseSize(raw);
  // Do not clamp while typing: min 8 turned "3" into "8", then the next
  // keystroke made "80" when the user meant "30".
  emit("change", { size: n == null ? null : Math.round(n) });
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

function onAudioInput(ev: Event): void {
  if (!props.bubble) return;
  emit("change", extraPatch(props.bubble, "audio", (ev.target as HTMLInputElement).value));
}

function onAudioBlur(ev: Event): void {
  if (!props.bubble) return;
  const trimmed = (ev.target as HTMLInputElement).value.trim();
  emit("change", extraPatch(props.bubble, "audio", trimmed));
}
</script>

<template>
  <aside class="editor-inspector">
    <h2>Bubble</h2>
    <p v-if="!bubble" class="editor-muted">Select a bubble, or click the plate to add one.</p>
    <template v-else>
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
        <input
          type="number"
          name="size"
          min="8"
          max="120"
          step="1"
          v-model="sizeDraft"
          :placeholder="String(defaultSize(bubble.variant))"
          @focus="sizeFocused = true"
          @input="onSizeInput"
          @blur="onSizeBlur"
        />
      </label>
      <label>
        Audio
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
      </label>
      <label>
        Variant
        <select
          :value="bubble.variant"
          @change="emit('change', { variant: ($event.target as HTMLSelectElement).value })"
        >
          <option v-for="v in BUBBLE_VARIANTS" :key="v" :value="v">{{ v }}</option>
        </select>
      </label>
      <label>
        Tail
        <select
          :value="bubble.tail || 'bottom-left'"
          @change="emit('change', { tail: ($event.target as HTMLSelectElement).value })"
        >
          <option v-for="t in BUBBLE_TAILS" :key="t" :value="t">{{ t }}</option>
        </select>
      </label>
      <button class="editor-btn editor-btn--ghost" type="button" @click="emit('remove')">Delete bubble</button>
    </template>
  </aside>
</template>
