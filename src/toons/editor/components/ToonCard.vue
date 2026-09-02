<script setup lang="ts">
/**
 * Same .series-card the /toons/ landing uses (styles.css). Preview and the
 * editor list share this — density is a property of the container, not a second card.
 */
import { RouterLink } from "vue-router";
import type { ToonVisibility } from "../types";

withDefaults(
  defineProps<{
    title: string;
    meta?: string;
    cue?: string;
    description?: string;
    coverUrl?: string | null;
    to?: string;
    badge?: string;
    visibility?: ToonVisibility | "";
    add?: boolean;
  }>(),
  { meta: "", cue: "", description: "", coverUrl: null, to: "", badge: "", visibility: "", add: false }
);
</script>

<template>
  <component
    :is="to ? RouterLink : 'div'"
    class="series-card"
    :class="{ 'series-card--add': add }"
    :to="to || undefined"
    :aria-label="add ? title : undefined"
  >
    <span class="series-card-face">
      <span class="series-card-art">
        <span v-if="add" class="editor-add-plus" aria-hidden="true">+</span>
        <img v-else-if="coverUrl" :src="coverUrl" :alt="title" width="1152" height="1728" />
        <span v-if="badge" class="editor-visibility-badge" :data-visibility="visibility || undefined">{{ badge }}</span>
      </span>
      <span v-if="meta" class="series-card-meta">{{ meta }}</span>
      <h3 class="series-card-title">{{ title }}</h3>
      <span v-if="cue" class="series-card-cue">{{ cue }}</span>
    </span>
    <span v-if="description" class="series-card-desc">{{ description }}</span>
  </component>
</template>
