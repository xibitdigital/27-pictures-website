<script setup lang="ts">
withDefaults(
  defineProps<{
    href?: string;
    label?: string;
  }>(),
  {
    href: "/experiments/",
    label: "← experiments",
  }
);
</script>

<template>
  <a :href="href" class="back-cover-link">{{ label }}</a>
</template>
