<script setup lang="ts">
/**
 * Wraps `.editor-icon-btn` the same way EditorButton wraps `.editor-btn` — variant prop instead of
 * every caller repeating `class="editor-icon-btn editor-icon-btn--danger"`. Field-adjacent actions
 * (copy, upload, reorder, delete) never use EditorButton next to an input.
 *
 * Extra classes (`editor-dialog-close`, `editor-translate-btn`, `editor-bubble-delete`) and
 * `aria-pressed` stay on the caller via fallthrough. Pressed fill is a container rule
 * (`.editor-layout-toolbar`, `.editor-tail-ring`), not a variant here.
 */
withDefaults(
  defineProps<{
    variant?: "ghost" | "danger";
    type?: "button" | "submit";
    disabled?: boolean;
  }>(),
  { variant: "ghost", type: "button" }
);
</script>

<template>
  <button
    :type="type"
    :disabled="disabled"
    class="editor-icon-btn"
    :class="{ 'editor-icon-btn--danger': variant === 'danger' }"
  >
    <slot />
  </button>
</template>
