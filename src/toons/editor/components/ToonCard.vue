<script setup lang="ts">
/**
 * Same .series-card the /toons/ landing uses (styles.css). Preview and the
 * editor list share this — density is a property of the container, not a second card.
 */
import { ImageOff, Share } from "@lucide/vue";
import { RouterLink } from "vue-router";
import { pushToast } from "../toast";
import type { ToonVisibility } from "../types";

const props = withDefaults(
  defineProps<{
    title: string;
    meta?: string;
    cue?: string;
    description?: string;
    coverUrl?: string | null;
    to?: string;
    badge?: string;
    visibility?: ToonVisibility | "";
    shareHref?: string;
    add?: boolean;
  }>(),
  {
    meta: "",
    cue: "",
    description: "",
    coverUrl: null,
    to: "",
    badge: "",
    visibility: "",
    shareHref: "",
    add: false,
  }
);

async function onShare(ev: Event): Promise<void> {
  ev.preventDefault();
  ev.stopPropagation();
  if (!props.shareHref) return;
  const href = new URL(props.shareHref, window.location.origin).href;
  try {
    await navigator.clipboard.writeText(href);
    pushToast("Link copied", "success");
  } catch {
    pushToast("Could not copy link");
  }
}
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
        <span v-else class="editor-cover-placeholder" aria-hidden="true">
          <ImageOff :size="32" :stroke-width="1.4" />
        </span>
        <span v-if="badge" class="editor-visibility-badge" :data-visibility="visibility || undefined">{{ badge }}</span>
        <button
          v-if="shareHref && !add"
          class="editor-share-btn"
          type="button"
          name="share-toon"
          aria-label="Copy public link"
          title="Copy public link"
          @click="onShare"
          @pointerdown.stop
        >
          <Share :size="14" :stroke-width="2" aria-hidden="true" />
        </button>
      </span>
      <span v-if="meta" class="series-card-meta">{{ meta }}</span>
      <h3 class="series-card-title">{{ title }}</h3>
      <span v-if="cue" class="series-card-cue">{{ cue }}</span>
    </span>
    <span v-if="description" class="series-card-desc">{{ description }}</span>
  </component>
</template>
