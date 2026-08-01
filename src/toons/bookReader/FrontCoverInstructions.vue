<script setup lang="ts">
/**
 * Book-plate front cover — thin wrapper around shared CoverFirstPage.
 * Kept as the public name used by BookSlot / FlipLeaf.
 */
import CoverFirstPage from "./CoverFirstPage.vue";

withDefaults(
  defineProps<{
    title?: string;
    subtitle?: string | null;
    logo?: string | null;
    altPrefix?: string;
    synopsis?: string | null;
    soundHint?: string | null;
    soundEnabled?: boolean;
  }>(),
  {
    title: "",
    subtitle: "Experiment",
    logo: null,
    altPrefix: "Page",
    synopsis: null,
    soundHint: null,
    soundEnabled: false,
  }
);

defineEmits<{
  soundToggle: [];
}>();
</script>

<template>
  <CoverFirstPage
    variant="plate"
    :title="title"
    :subtitle="subtitle"
    :logo="logo"
    :alt-prefix="altPrefix"
    :synopsis="synopsis"
    :sound-hint="soundHint"
    :sound-enabled="soundEnabled"
    @sound-toggle="$emit('soundToggle')"
  />
</template>
