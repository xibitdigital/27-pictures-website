<script setup lang="ts">
/**
 * Semi-transparent page-down control, pinned to the bottom centre of the strip.
 * Parent mounts it only in scroll mode, and not over an open dialog or how-to.
 */
import { ChevronDown } from "@lucide/vue";
import { onMounted, onUnmounted, ref } from "vue";
import { useFlipframeCopy } from "../flipframeCopy";
import { canScrollPageDown, scrollPageDown } from "./scrollPage";

const t = useFlipframeCopy();
const atEnd = ref(false);

function measure(): void {
  atEnd.value = !canScrollPageDown(
    window.scrollY || window.pageYOffset || 0,
    window.innerHeight,
    document.documentElement.scrollHeight
  );
}

onMounted(() => {
  measure();
  window.addEventListener("scroll", measure, { passive: true });
  window.addEventListener("resize", measure);
});

onUnmounted(() => {
  window.removeEventListener("scroll", measure);
  window.removeEventListener("resize", measure);
});
</script>

<template>
  <button
    v-show="!atEnd"
    type="button"
    class="scroll-down-btn"
    data-scroll-down
    :title="t.scrollDown"
    :aria-label="t.scrollDown"
    @click="scrollPageDown()"
  >
    <ChevronDown aria-hidden="true" />
  </button>
</template>
