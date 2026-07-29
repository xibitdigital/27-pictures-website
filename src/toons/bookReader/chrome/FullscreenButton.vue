<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";

const props = defineProps<{
  afterChange?: () => void;
}>();

const isFs = ref(false);
const supported = ref(true);

const title = computed(() => (isFs.value ? "Exit fullscreen" : "Fullscreen"));
const label = computed(() => (isFs.value ? "Exit" : "Full"));
const pathD = computed(() =>
  isFs.value ? "M8 8H3V3M16 8h5V3M8 16H3v5M16 16h5v5" : "M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"
);

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
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      aria-hidden="true"
    >
      <path :d="pathD" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
    <span class="toon-fs-label">{{ label }}</span>
  </button>
</template>
