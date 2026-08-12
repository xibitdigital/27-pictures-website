<script setup lang="ts">
withDefaults(
  defineProps<{
    href?: string;
    label?: string;
  }>(),
  {
    href: "/toons/",
    label: "← experiments",
  }
);
</script>

<template>
  <a :href="href" class="back-cover-link">{{ label }}</a>
</template>
