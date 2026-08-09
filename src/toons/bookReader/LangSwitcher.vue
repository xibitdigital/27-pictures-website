<script setup lang="ts">
/**
 * Caption language dropdown for FlipFrame toons (Jax, Nero, …).
 * Languages come from the injected toon captions store (config.json).
 */
import { computed } from "vue";
import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from "@headlessui/vue";
import { useToonCaptions } from "./captions/useToonCaptions";

const emit = defineEmits<{
  change: [];
}>();

const captions = useToonCaptions();

const languages = computed(() => captions?.languages.value ?? []);
const lang = computed(() => captions?.lang.value ?? "en");

const currentLabel = computed(() => {
  const hit = languages.value.find((l) => l.code === lang.value);
  return hit?.label ?? lang.value.toUpperCase();
});

/** Nothing to switch between until the config lands (or for caption-less toons). */
const visible = computed(() => !!captions && languages.value.length > 1);

function onLangUpdate(code: string): void {
  if (!captions) return;
  captions.setLang(code);
  emit("change");
}
</script>

<template>
  <div v-if="visible" class="toon-lang-switcher">
    <Listbox v-slot="{ open }" :model-value="lang" @update:model-value="onLangUpdate">
      <div class="toon-lang-dropdown" :class="{ 'is-open': open }">
        <ListboxButton class="toon-fs-btn toon-lang-toggle" type="button" :title="`Language: ${currentLabel}`">
          <span class="toon-lang-toggle-label">{{ currentLabel }}</span>
          <svg class="toon-lang-chevron" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <path d="M3 4.5 L6 8 L9 4.5" fill="none" stroke="currentColor" stroke-width="1.5" />
          </svg>
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
