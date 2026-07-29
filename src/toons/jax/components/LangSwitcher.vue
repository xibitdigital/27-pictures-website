<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
} from "@headlessui/vue";
import type { WordOverlay } from "../../shared/words";

const props = defineProps<{
  overlay: WordOverlay | null;
}>();

const emit = defineEmits<{
  change: [];
}>();

const lang = ref("en");

const languages = computed(() => props.overlay?.getLanguages() ?? []);

const currentLabel = computed(() => {
  const hit = languages.value.find((l) => l.code === lang.value);
  return hit?.label ?? lang.value.toUpperCase();
});

watch(
  () => props.overlay,
  (o) => {
    if (o) lang.value = o.getLang();
  },
  { immediate: true }
);

function onLangUpdate(code: string): void {
  if (!props.overlay) return;
  props.overlay.setLang(code);
  lang.value = code;
  emit("change");
}
</script>

<template>
  <div v-if="overlay" class="jax-lang-switcher">
    <Listbox v-slot="{ open }" :model-value="lang" @update:model-value="onLangUpdate">
      <div class="jax-lang-dropdown" :class="{ 'is-open': open }">
        <ListboxButton class="jax-lang-toggle" type="button">
          <span class="jax-lang-toggle-label">{{ currentLabel }}</span>
          <svg class="jax-lang-chevron" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <path
              d="M3 4.5 L6 8 L9 4.5"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
            />
          </svg>
        </ListboxButton>

        <ListboxOptions class="jax-lang-menu" as="div">
          <ListboxOption
            v-for="l in languages"
            :key="l.code"
            v-slot="{ active, selected }"
            :value="l.code"
            as="template"
          >
            <button
              type="button"
              class="jax-lang-option"
              :class="{ 'is-active': active || selected }"
            >
              {{ l.label }}
            </button>
          </ListboxOption>
        </ListboxOptions>
      </div>
    </Listbox>
  </div>
</template>
