<script setup lang="ts">
/**
 * Shared first-page / cover layout for every FlipFrame experiment.
 * Used on the book plate and in the mobile cover guide dialog.
 */
import { computed, ref } from "vue";
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from "@headlessui/vue";
import { resolveCoverStory } from "./coverStory";

const props = withDefaults(
  defineProps<{
    title?: string;
    subtitle?: string | null;
    logo?: string | null;
    altPrefix?: string;
    /** Story synopsis (front-cover manual). Newlines preserved. */
    synopsis?: string | null;
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
    subtitle: "Experiment",
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

const soundTitle = computed(() => (props.soundEnabled ? "Mute sound" : "Enable sound"));
const soundLabel = computed(() => (props.soundEnabled ? "Sound on" : props.soundHint || "Sound"));
const storyText = computed(() => resolveCoverStory(props.synopsis));
const isModal = computed(() => props.variant === "modal");
const displayTitle = computed(() => props.title || (isModal.value ? "Story" : ""));
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
    <p v-if="subtitle" class="front-cover-subtitle">{{ subtitle }}</p>

    <div class="front-cover-separator front-cover-separator--before-story" role="separator" aria-hidden="true"></div>
    <section class="front-cover-story" aria-label="Story">
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
            title="About FlipFrame"
            aria-label="About FlipFrame"
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
        <p class="front-cover-brand-by">by twentyseven.pictures</p>
      </div>

      <!-- Visual how-to: keyboard arrows + click on page -->
      <div class="front-cover-howto" role="group" aria-label="How to read">
        <div class="front-cover-howto-icons" aria-hidden="true">
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
        <p class="front-cover-howto-caption">Use the arrow keys, or click on a page, to turn</p>
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
      <p class="front-cover-sound-note">Hover (or tap) glowing captions on any page to hear them</p>
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
            <DialogTitle as="h2">FlipFrame beta</DialogTitle>
            <p>
              FlipFrame is a beta product by
              <strong>twentyseven.pictures</strong>. If you’d like to integrate this reader on your site, get in touch
              via our contact form.
            </p>
            <div class="sound-prompt__actions">
              <a href="/#contact" class="sound-prompt__btn sound-prompt__btn--primary" @click.stop> Contact us </a>
              <button type="button" class="sound-prompt__btn" @click.stop="aboutOpen = false">Close</button>
            </div>
          </DialogPanel>
        </div>
      </TransitionChild>
    </Dialog>
  </TransitionRoot>
</template>
