<script setup lang="ts">
/**
 * Caption language dropdown for FlipFrame toons (Jax, Nero, …).
 * Languages come from the injected toon captions store (config.json), or from
 * `languages` + `modelValue` when used in the editor (no store).
 */
import { ChevronDown } from "@lucide/vue";
import { computed } from "vue";
import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from "@headlessui/vue";
import { useToonCaptions } from "./captions/useToonCaptions";
import type { LangOption } from "./types";

const props = defineProps<{
  languages?: LangOption[];
  modelValue?: string;
}>();

const emit = defineEmits<{
  change: [];
  "update:modelValue": [code: string];
}>();

const captions = useToonCaptions();

const languages = computed(() => props.languages ?? captions?.languages.value ?? []);
const lang = computed(() => props.modelValue ?? captions?.lang.value ?? "en");

const currentLabel = computed(() => {
  const hit = languages.value.find((l) => l.code === lang.value);
  return hit?.label ?? lang.value.toUpperCase();
});

/** Nothing to switch between until there are at least two languages. */
const visible = computed(() => languages.value.length > 1);

function onLangUpdate(code: string): void {
  emit("update:modelValue", code);
  if (props.modelValue == null) captions?.setLang(code);
  emit("change");
}
</script>

<template>
  <div v-if="visible" class="toon-lang-switcher">
    <Listbox v-slot="{ open }" :model-value="lang" @update:model-value="onLangUpdate">
      <div class="toon-lang-dropdown" :class="{ 'is-open': open }">
        <ListboxButton class="toon-fs-btn toon-lang-toggle" type="button" :title="`Language: ${currentLabel}`">
          <span class="toon-lang-toggle-label">{{ currentLabel }}</span>
          <ChevronDown class="toon-lang-chevron" :size="12" :stroke-width="1.5" aria-hidden="true" />
        </ListboxButton>

        <ListboxOptions class="toon-lang-menu" as="div">
          <ListboxOption
            v-for="l in languages"
            :key="l.code"
            v-slot="{ active, selected }"
            :value="l.code"
            as="template"
          >
            <button type="button" class="toon-lang-option" :class="{ 'is-active': active || selected }">
              {{ l.label }}
            </button>
          </ListboxOption>
        </ListboxOptions>
      </div>
    </Listbox>
  </div>
</template>
