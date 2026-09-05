<script setup lang="ts">
/**
 * Share control for the reader top bar. Prefers the system share sheet;
 * copies the current URL when that is not available.
 */
import { Share } from "@lucide/vue";
import { computed, onUnmounted, ref } from "vue";

const copied = ref(false);
let copiedTimer = 0;

const title = computed(() => (copied.value ? "Link copied" : "Share"));
const label = computed(() => (copied.value ? "Copied" : "Share"));

function flashCopied(): void {
  copied.value = true;
  window.clearTimeout(copiedTimer);
  copiedTimer = window.setTimeout(() => {
    copied.value = false;
  }, 1600);
}

async function onShare(): Promise<void> {
  const href = window.location.href;
  const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
  if (typeof nav.share === "function") {
    try {
      await nav.share({ title: document.title, url: href });
      return;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(href);
    flashCopied();
  } catch {
    /* no clipboard — leave the button as Share */
  }
}

onUnmounted(() => window.clearTimeout(copiedTimer));
</script>

<template>
  <button
    type="button"
    class="toon-fs-btn"
    :class="{ 'is-active': copied }"
    name="share-toon"
    :title="title"
    :aria-label="title"
    @click.stop="onShare"
  >
    <Share aria-hidden="true" />
    <span class="toon-fs-label">{{ label }}</span>
  </button>
</template>
