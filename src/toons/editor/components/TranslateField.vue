<script setup lang="ts">
import { Languages, LoaderCircle } from "@lucide/vue";
import { ref } from "vue";
import { translateFromEnglish, type CaptionTranslations } from "../api";
import { pushToast } from "../toast";

const props = defineProps<{
  source: string;
}>();

const emit = defineEmits<{
  translated: [CaptionTranslations];
}>();

const busy = ref(false);

async function onTranslate(): Promise<void> {
  const text = props.source.trim();
  if (!text || busy.value) return;
  busy.value = true;
  try {
    emit("translated", await translateFromEnglish(text));
  } catch (err) {
    pushToast(err instanceof Error ? err.message : "Translation failed");
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="editor-translate-field">
    <slot />
    <button
      class="editor-icon-btn editor-translate-btn"
      type="button"
      name="translate-langs"
      :disabled="busy || !source.trim()"
      aria-label="Translate English into Italian, German and French"
      title="Translate to it / de / fr"
      @click="onTranslate"
    >
      <LoaderCircle v-if="busy" class="editor-spin" :size="14" aria-hidden="true" />
      <Languages v-else :size="14" :stroke-width="1.4" aria-hidden="true" />
    </button>
  </div>
</template>
