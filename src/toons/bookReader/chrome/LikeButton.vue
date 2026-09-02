<script setup lang="ts">
/**
 * Heart toggle for the reader top bar. Sits beside LangSwitcher.
 *
 * The reader's own vote is remembered in localStorage; the running total comes
 * from the likes Worker and is shown to everyone. It used to hide behind
 * `?stats=true` so a cold counter never showed a discouraging "0" — the books
 * have votes now, and a count nobody can see cannot encourage anyone to add to
 * it. A missing total still renders as nothing rather than as zero.
 */
import { Heart } from "@lucide/vue";
import { computed } from "vue";
import { useToonLikes } from "../useToonLikes";

const props = defineProps<{
  /** Toon id the counter is keyed on (`jax`, `nero`, `redsmile-static`, …). */
  toonId: string;
}>();

const { liked, total, pending, like } = useToonLikes(props.toonId);

// Past tense once cast, and the button is disabled: a vote is final on this
// device, so "Liked" describes a state rather than offering an action.
const label = computed(() => (liked.value ? "Liked" : "Like this toon"));
const countLabel = computed(() => (total.value == null ? "" : String(total.value)));
</script>

<template>
  <button
    type="button"
    class="toon-fs-btn toon-like-btn"
    :class="{ 'is-liked': liked, 'is-pending': pending, 'has-stats': countLabel !== '' }"
    :aria-pressed="liked"
    :disabled="liked"
    :title="label"
    :aria-label="label"
    @click="like"
  >
    <Heart :fill="liked ? 'currentColor' : 'none'" aria-hidden="true" />
    <span class="toon-fs-label">{{ label }}</span>
    <!-- Stacked under the heart, so the bar keeps one icon per control. -->
    <span v-if="countLabel" class="toon-like-count" aria-hidden="true">{{ countLabel }}</span>
  </button>
</template>
