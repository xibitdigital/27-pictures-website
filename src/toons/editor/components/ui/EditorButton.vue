<script setup lang="ts">
/**
 * Wraps the editor's `.editor-btn` styling behind `variant` (primary / ghost / danger) and
 * `size` (small / default / large) instead of every caller hand-assembling those classes.
 * Renders a RouterLink when `to` is set,
 * otherwise a <button>; content, icons and any extra class (e.g. `is-busy`) are the caller's own,
 * via the default slot and normal class/attr fallthrough.
 */
import { computed, ref } from "vue";
import { RouterLink, type RouteLocationRaw } from "vue-router";

const props = withDefaults(
  defineProps<{
    variant?: "primary" | "ghost" | "danger";
    size?: "small" | "default" | "large";
    to?: RouteLocationRaw;
    type?: "button" | "submit";
    disabled?: boolean;
  }>(),
  { variant: "primary", size: "default", type: "button" }
);

const rootClass = computed(() => ({
  "editor-btn": true,
  "editor-btn--ghost": props.variant === "ghost",
  "editor-btn--danger": props.variant === "danger",
  "editor-btn--small": props.size === "small",
  "editor-btn--large": props.size === "large",
}));

/** So a caller can still do `someRef.value?.focus()` on this component, same as it could on a
 * plain <button> before — e.g. ConfirmDialog's focus-confirm-on-open. Only meaningful without
 * `to` (a real <button>); a RouterLink render has no button element to expose. */
const buttonEl = ref<HTMLButtonElement | null>(null);
defineExpose({ focus: () => buttonEl.value?.focus() });
</script>

<template>
  <RouterLink v-if="to" :to="to" :class="rootClass">
    <slot />
  </RouterLink>
  <button v-else ref="buttonEl" :type="type" :disabled="disabled" :class="rootClass">
    <slot />
  </button>
</template>
