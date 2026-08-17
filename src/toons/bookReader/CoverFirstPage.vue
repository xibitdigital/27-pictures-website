<script setup lang="ts">
/**
 * Shared first-page / cover layout for every FlipFrame experiment.
 * Used on the book plate and in the mobile cover guide dialog.
 */
import { computed, onMounted, onUnmounted, ref } from "vue";
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from "@headlessui/vue";
import { resolveCoverStory } from "./coverStory";
import { pickLocalized, useFlipframeCopy, useReaderLocale, type LocalizedString } from "./flipframeCopy";

const props = withDefaults(
  defineProps<{
    title?: string;
    subtitle?: LocalizedString | null;
    logo?: string | null;
    altPrefix?: string;
    /** Story synopsis (front-cover manual). Newlines preserved. */
    synopsis?: LocalizedString | null;
    soundHint?: string | null;
    soundEnabled?: boolean;
    /**
     * plate — absolute fill on the book inside-cover.
     * modal — flow layout inside CoverGuideDialog (parent scrolls).
     */
    variant?: "plate" | "modal";
  }>(),
  {
    title: "",
    subtitle: null,
    logo: null,
    altPrefix: "Page",
    synopsis: null,
    soundHint: null,
    soundEnabled: false,
    variant: "plate",
  }
);

const emit = defineEmits<{
  soundToggle: [];
}>();

const aboutOpen = ref(false);

const locale = useReaderLocale();
const t = useFlipframeCopy();

const soundTitle = computed(() => (props.soundEnabled ? t.value.muteSound : t.value.enableSound));
const soundLabel = computed(() => (props.soundEnabled ? t.value.soundOn : props.soundHint || t.value.soundOff));
const storyText = computed(() => resolveCoverStory(props.synopsis, locale.value));
const isModal = computed(() => props.variant === "modal");

/**
 * A wide touch screen (Pro Max in landscape, any iPad) is over the 768px mobile
 * cut-off, so it gets the book plate — and the plate used to tell it to press
 * arrow keys and click. Drive the how-to off the pointer, not the width.
 */
const coarsePointer = ref(false);
let pointerMq: MediaQueryList | null = null;
function syncPointer(): void {
  coarsePointer.value = !!pointerMq?.matches;
}

onMounted(() => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
  pointerMq = window.matchMedia("(pointer: coarse)");
  syncPointer();
  // Rotating a tablet can swap the matching media query, so stay subscribed.
  if (typeof pointerMq.addEventListener === "function") pointerMq.addEventListener("change", syncPointer);
  else pointerMq.addListener?.(syncPointer);
});

onUnmounted(() => {
  if (!pointerMq) return;
  if (typeof pointerMq.removeEventListener === "function") pointerMq.removeEventListener("change", syncPointer);
  else pointerMq.removeListener?.(syncPointer);
});

/** Keyboard + mouse diagrams only make sense for a fine pointer. */
const showPointerHowto = computed(() => !isModal.value && !coarsePointer.value);

const howtoCaption = computed(() => {
  if (isModal.value) return t.value.howtoScroll;
  return coarsePointer.value ? t.value.howtoTap : t.value.howtoBook;
});
const displayTitle = computed(() => props.title || (isModal.value ? t.value.storyTitle : ""));
const displaySubtitle = computed(() => pickLocalized(props.subtitle, locale.value, t.value.experiment));
/** Build id from Vite (git short SHA or VITE_FLIPFRAME_BUILD). */
const buildId = (import.meta.env.VITE_FLIPFRAME_BUILD || "").trim();
</script>

<template>
  <div
    class="front-cover-instructions cover-first-page"
    :class="{
      'front-cover-instructions--modal': isModal,
      'cover-first-page--modal': isModal,
    }"
  >
    <slot name="title">
      <h1 v-if="displayTitle" class="front-cover-title">{{ displayTitle }}</h1>
    </slot>
    <p v-if="displaySubtitle" class="front-cover-subtitle">{{ displaySubtitle }}</p>

    <div class="front-cover-separator front-cover-separator--before-story" role="separator" aria-hidden="true"></div>
    <section class="front-cover-story" :aria-label="t.storyLabel">
      <div class="front-cover-synopsis">{{ storyText }}</div>
    </section>
    <div class="front-cover-separator front-cover-separator--after-story" role="separator" aria-hidden="true"></div>

    <div class="front-cover-manual">
      <div class="front-cover-brand">
        <p class="front-cover-brand-line">
          <span class="front-cover-brand-word">FlipFrame</span>
          <button
            type="button"
            class="front-cover-brand-info"
            :title="t.aboutAria"
            :aria-label="t.aboutAria"
            @click.stop="aboutOpen = true"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 11v5" stroke-linecap="round" />
              <circle cx="12" cy="8" r="0.75" fill="currentColor" stroke="none" />
            </svg>
          </button>
        </p>
        <p v-if="buildId" class="front-cover-brand-build" :title="`FlipFrame ${t.build} ${buildId}`">
          {{ t.build }} {{ buildId }}
        </p>
        <p class="front-cover-brand-by">by twentyseven.pictures</p>
      </div>

      <!-- Visual how-to: book = arrow keys + click on page; mobile = caption only -->
      <div class="front-cover-howto" role="group" :aria-label="t.howtoLabel">
        <div v-if="showPointerHowto" class="front-cover-howto-icons" aria-hidden="true">
          <svg
            class="front-cover-howto-svg front-cover-howto-keys"
            viewBox="0 0 120 64"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect class="front-cover-howto-key is-active" x="8" y="14" width="48" height="36" rx="6" stroke-width="2" />
            <path
              class="front-cover-howto-key-glyph is-active"
              d="M34 32H22m0 0l6-6m-6 6l6 6"
              stroke-width="2.25"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <rect
              class="front-cover-howto-key is-active"
              x="64"
              y="14"
              width="48"
              height="36"
              rx="6"
              stroke-width="2"
            />
            <path
              class="front-cover-howto-key-glyph is-active"
              d="M86 32h12m0 0l-6-6m6 6l-6 6"
              stroke-width="2.25"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>

          <svg
            class="front-cover-howto-svg front-cover-howto-click"
            viewBox="0 0 100 72"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect class="front-cover-howto-page" x="10" y="8" width="72" height="56" rx="3" stroke-width="2" />
            <line class="front-cover-howto-page" x1="46" y1="8" x2="46" y2="64" stroke-width="1.5" />
            <rect
              class="front-cover-howto-zone front-cover-howto-zone--prev"
              x="12"
              y="10"
              width="33"
              height="52"
              rx="1.5"
            />
            <rect
              class="front-cover-howto-zone front-cover-howto-zone--next"
              x="47"
              y="10"
              width="33"
              height="52"
              rx="1.5"
            />
            <path
              class="front-cover-howto-pointer"
              d="M62 28l1.2 18.5 4.2-3.6 3.8 8.4 3.6-1.6-3.8-8.2 5.4-1.2L62 28z"
              stroke-width="1.5"
              stroke-linejoin="round"
            />
            <circle class="front-cover-howto-click-dot" cx="63.5" cy="30" r="2.25" />
          </svg>
        </div>
        <p class="front-cover-howto-caption">{{ howtoCaption }}</p>
      </div>
    </div>

    <template v-if="soundHint">
      <button
        type="button"
        class="toon-fs-btn front-cover-sound-btn"
        :class="{ 'is-active': soundEnabled, 'is-enabled': soundEnabled }"
        :aria-pressed="soundEnabled"
        :title="soundTitle"
        :aria-label="soundTitle"
        @click.stop="emit('soundToggle')"
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
          <path d="M4 9v6h4l5 4V5L8 9H4z" stroke-linecap="round" stroke-linejoin="round" />
          <path
            class="front-cover-sound-waves"
            d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <span :data-off-label="soundHint">{{ soundLabel }}</span>
      </button>
      <p class="front-cover-sound-note">{{ t.soundNote }}</p>
    </template>
  </div>

  <TransitionRoot :show="aboutOpen" as="template">
    <Dialog class="sound-prompt-dialog" as="div" @close="aboutOpen = false">
      <TransitionChild
        as="template"
        enter="sound-prompt-enter"
        enter-from="sound-prompt-enter-from"
        enter-to="sound-prompt-enter-to"
        leave="sound-prompt-leave"
        leave-from="sound-prompt-leave-from"
        leave-to="sound-prompt-leave-to"
      >
        <div class="sound-prompt" @click.stop>
          <DialogPanel class="sound-prompt__panel">
            <svg
              class="sound-prompt__icon"
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.75"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 11v5" stroke-linecap="round" />
              <circle cx="12" cy="8" r="0.75" fill="currentColor" stroke="none" />
            </svg>
            <DialogTitle as="h2">{{ t.aboutTitle }}</DialogTitle>
            <p>
              {{ t.aboutLead }}
              <strong>twentyseven.pictures</strong>. {{ t.aboutCta }}
            </p>
            <div class="sound-prompt__actions">
              <a href="/#contact" class="sound-prompt__btn sound-prompt__btn--primary" @click.stop>{{ t.contact }}</a>
              <button type="button" class="sound-prompt__btn" @click.stop="aboutOpen = false">{{ t.close }}</button>
            </div>
          </DialogPanel>
        </div>
      </TransitionChild>
    </Dialog>
  </TransitionRoot>
</template>
