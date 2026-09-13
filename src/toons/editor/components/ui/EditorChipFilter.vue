<script setup lang="ts" generic="T extends string">
/**
 * Segmented chips (`.editor-visibility-filter`) — ToonList visibility radiogroup and the
 * gallery's Shapes/Pages tabs. Not the inspector Layout/Bubbles switch (different look).
 */
export type EditorChipOption<T extends string = string> = {
  value: T;
  label: string;
  /** Paints the draft/staging/public chip colors when set. */
  visibility?: string;
};

withDefaults(
  defineProps<{
    options: EditorChipOption<T>[];
    modelValue: T;
    role: "radiogroup" | "tablist";
    ariaLabel: string;
    namePrefix?: string;
  }>(),
  { namePrefix: "" }
);

const emit = defineEmits<{
  "update:modelValue": [value: T];
}>();
</script>

<template>
  <div class="editor-visibility-filter" :role="role" :aria-label="ariaLabel">
    <button
      v-for="opt in options"
      :key="opt.value"
      type="button"
      :name="namePrefix ? `${namePrefix}${opt.value}` : undefined"
      :role="role === 'tablist' ? 'tab' : undefined"
      :aria-pressed="modelValue === opt.value"
      :aria-selected="role === 'tablist' ? modelValue === opt.value : undefined"
      :data-visibility="opt.visibility || undefined"
      @click="emit('update:modelValue', opt.value)"
    >
      {{ opt.label }}
    </button>
  </div>
</template>
