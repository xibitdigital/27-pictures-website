<script setup lang="ts">
/**
 * Back cover. A standalone book keeps the single "← toons" link; a book that
 * belongs to a series shows where to go next, because the last page is where
 * a reader decides whether the series continues for them.
 */
import type { EpisodeNav } from "../series";

withDefaults(
  defineProps<{
    href?: string;
    label?: string;
    nav?: EpisodeNav | null;
  }>(),
  {
    href: "/toons/",
    label: "← experiments",
    nav: null,
  }
);
</script>

<template>
  <a v-if="!nav" :href="href" class="back-cover-link">{{ label }}</a>

  <div v-else class="back-cover-nav">
    <p class="back-cover-series">{{ nav.seriesTitle }}</p>
    <p class="back-cover-current">{{ nav.current }} ends here</p>

    <a v-if="nav.next?.href" :href="nav.next.href" class="back-cover-next">
      {{ nav.next.label }}
      <span aria-hidden="true">→</span>
    </a>
    <p v-else-if="nav.next" class="back-cover-next is-soon">{{ nav.next.label }}</p>

    <a v-if="nav.prev" :href="nav.prev.href" class="back-cover-prev">← {{ nav.prev.label }}</a>
    <a :href="href" class="back-cover-all">{{ label }}</a>
  </div>
</template>
