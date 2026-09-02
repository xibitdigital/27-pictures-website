<script setup lang="ts">
import { Maximize2, Minimize2 } from "@lucide/vue";
import { computed, onMounted, onUnmounted, ref } from "vue";

const props = defineProps<{
  afterChange?: () => void;
}>();

const isFs = ref(false);
const supported = ref(true);

const title = computed(() => (isFs.value ? "Exit fullscreen" : "Fullscreen"));
const label = computed(() => (isFs.value ? "Exit" : "Full"));
const icon = computed(() => (isFs.value ? Minimize2 : Maximize2));

function sync(): void {
  const doc = document as Document & {
    webkitFullscreenElement?: Element | null;
    msFullscreenElement?: Element | null;
  };
  isFs.value = !!(document.fullscreenElement || doc.webkitFullscreenElement || doc.msFullscreenElement);
  document.body.classList.toggle("is-fullscreen", isFs.value);
  props.afterChange?.();
}

async function toggle(): Promise<void> {
  try {
    const doc = document as Document & {
      webkitExitFullscreen?: () => void;
      msExitFullscreen?: () => void;
    };
    const el = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => void;
      msRequestFullscreen?: () => void;
    };
    if (isFs.value) {
      if (document.exitFullscreen) await document.exitFullscreen();
      else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen();
      else if (doc.msExitFullscreen) doc.msExitFullscreen();
    } else {
      if (el.requestFullscreen) await el.requestFullscreen();
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      else if (el.msRequestFullscreen) el.msRequestFullscreen();
    }
  } catch (err) {
    console.warn("Fullscreen not available:", err);
  }
}

onMounted(() => {
  const el = document.documentElement as HTMLElement & {
    webkitRequestFullscreen?: () => void;
    msRequestFullscreen?: () => void;
  };
  supported.value = !!(el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen);
  document.addEventListener("fullscreenchange", sync);
  document.addEventListener("webkitfullscreenchange", sync);
  sync();
});

onUnmounted(() => {
  document.removeEventListener("fullscreenchange", sync);
  document.removeEventListener("webkitfullscreenchange", sync);
});
</script>

<template>
  <button
    v-show="supported"
    type="button"
    class="toon-fs-btn"
    :class="{ 'is-active': isFs }"
    :aria-pressed="isFs"
    :title="title"
    :aria-label="isFs ? 'Exit fullscreen' : 'Enter fullscreen'"
    @click="toggle"
  >
    <component :is="icon" aria-hidden="true" />
    <span class="toon-fs-label">{{ label }}</span>
  </button>
</template>
