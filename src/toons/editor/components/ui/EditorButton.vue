<script setup lang="ts">
/**
 * Wraps the editor's `.editor-btn` styling behind a `variant` prop instead of every caller
 * hand-assembling `class="editor-btn editor-btn--ghost"` / `editor-btn--danger` — one place that
 * knows "danger" means .editor-btn--danger, not a string every consumer has to get right (and
 * remember to update if that class ever changes). Renders a RouterLink when `to` is set,
 * otherwise a <button>; content, icons and any extra class (e.g. `is-busy`) are the caller's own,
 * via the default slot and normal class/attr fallthrough.
 */
import { ref } from "vue";
import { RouterLink, type RouteLocationRaw } from "vue-router";

withDefaults(
  defineProps<{
    variant?: "primary" | "ghost" | "danger";
    to?: RouteLocationRaw;
    type?: "button" | "submit";
    disabled?: boolean;
  }>(),
  { variant: "primary", type: "button" }
);

/** So a caller can still do `someRef.value?.focus()` on this component, same as it could on a
 * plain <button> before — e.g. ConfirmDialog's focus-confirm-on-open. Only meaningful without
 * `to` (a real <button>); a RouterLink render has no button element to expose. */
const buttonEl = ref<HTMLButtonElement | null>(null);
defineExpose({ focus: () => buttonEl.value?.focus() });
</script>

<template>
  <RouterLink
    v-if="to"
    :to="to"
    class="editor-btn"
    :class="{ 'editor-btn--ghost': variant === 'ghost', 'editor-btn--danger': variant === 'danger' }"
  >
    <slot />
  </RouterLink>
  <button
    v-else
    ref="buttonEl"
    :type="type"
    :disabled="disabled"
    class="editor-btn"
    :class="{ 'editor-btn--ghost': variant === 'ghost', 'editor-btn--danger': variant === 'danger' }"
  >
    <slot />
  </button>
</template>
