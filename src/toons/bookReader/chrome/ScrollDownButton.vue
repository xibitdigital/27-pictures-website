<script setup lang="ts">
/**
 * Semi-transparent page-down control, pinned to the bottom centre of the strip.
 * Parent mounts it only in scroll mode, and not over an open dialog or how-to.
 */
import { ChevronDown } from "@lucide/vue";
import { onMounted, onUnmounted, ref } from "vue";
import { useFlipframeCopy } from "../flipframeCopy";
import { canScrollPageDown, docScrollHeight, scrollPageDown, viewHeight } from "./scrollPage";

const props = defineProps<{
  /** Vertical-strip page slots, document order. Used to snap the next plate. */
  pages?: HTMLElement[];
}>();

const t = useFlipframeCopy();
const atEnd = ref(false);

function measure(): void {
  atEnd.value = !canScrollPageDown(window.scrollY || window.pageYOffset || 0, viewHeight(), docScrollHeight());
}

function onScrollDown(): void {
  scrollPageDown(window, { pages: props.pages ?? [] });
}

let ro: ResizeObserver | null = null;

onMounted(() => {
  measure();
  window.addEventListener("scroll", measure, { passive: true });
  window.addEventListener("resize", measure);
  window.visualViewport?.addEventListener("resize", measure);
  window.visualViewport?.addEventListener("scroll", measure);
  if (typeof ResizeObserver === "function") {
    ro = new ResizeObserver(measure);
    ro.observe(document.documentElement);
  }
});

onUnmounted(() => {
  window.removeEventListener("scroll", measure);
  window.removeEventListener("resize", measure);
  window.visualViewport?.removeEventListener("resize", measure);
  window.visualViewport?.removeEventListener("scroll", measure);
  ro?.disconnect();
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
    @click="onScrollDown"
  >
    <ChevronDown aria-hidden="true" />
  </button>
</template>
