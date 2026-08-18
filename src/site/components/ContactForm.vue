<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { UI, documentLocale } from "../i18n";

const props = withDefaults(
  defineProps<{
    action?: string;
    turnstileSiteKey?: string;
  }>(),
  {
    action: "https://contact-form.sangalli-marco.workers.dev",
    turnstileSiteKey: "0x4AAAAAACLlfOmi5SSMELBj",
  }
);

// The locale-page generator rewrites HTML templates only, so a Vue component's
// own strings stay English in /de/, /it/ and /fr/ unless it reads `<html lang>`
// itself — which is where every other bit of chrome gets its language too.
const t = UI[documentLocale()];

const name = ref("");
const email = ref("");
const message = ref("");
const nameError = ref("");
const emailError = ref("");
const messageError = ref("");
const formMessage = ref("");
const formMessageType = ref<"success" | "error">("success");
const submitting = ref(false);
const submitLabel = ref(t.contactSend);

let turnstileToken: string | null = null;
let formReadyToSubmit = false;

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clearErrors(): void {
  nameError.value = "";
  emailError.value = "";
  messageError.value = "";
  formMessage.value = "";
}

async function submitContactForm(): Promise<void> {
  formReadyToSubmit = false;
  submitting.value = true;
  submitLabel.value = t.contactSending;

  try {
    const body = new FormData();
    body.set("name", name.value.trim());
    body.set("email", email.value.trim());
    body.set("message", message.value.trim());
    if (turnstileToken) body.set("cf-turnstile-response", turnstileToken);

    const response = await fetch(props.action, { method: "POST", body });

    if (response.ok) {
      formMessage.value = t.contactSent;
      formMessageType.value = "success";
      name.value = "";
      email.value = "";
      message.value = "";
      turnstileToken = null;
    } else {
      const errorText = await response.text();
      formMessage.value = errorText || t.contactFailed;
      formMessageType.value = "error";
    }
  } catch {
    formMessage.value = t.contactError;
    formMessageType.value = "error";
  } finally {
    submitting.value = false;
    submitLabel.value = t.contactSend;
  }
}

function onSubmit(e: Event): void {
  e.preventDefault();
  clearErrors();
  let isValid = true;

  if (name.value.trim() === "") {
    nameError.value = t.contactErrName;
    isValid = false;
  }
  if (!emailRegex.test(email.value.trim())) {
    emailError.value = t.contactErrEmail;
    isValid = false;
  }
  if (message.value.trim() === "") {
    messageError.value = t.contactErrMessage;
    isValid = false;
  }
  if (!isValid) return;

  if (turnstileToken) {
    submitContactForm();
  } else {
    formReadyToSubmit = true;
    submitting.value = true;
    submitLabel.value = t.contactVerifying;
    if (window.turnstile) {
      window.turnstile.execute();
    } else {
      submitContactForm();
    }
  }
}

function onTurnstileSuccess(token: string): void {
  turnstileToken = token;
  if (formReadyToSubmit) submitContactForm();
}

function onTurnstileExpired(): void {
  turnstileToken = null;
}

const turnstileEl = ref<HTMLElement | null>(null);
let turnstileWidgetId: string | null = null;

function renderTurnstile(): void {
  const el = turnstileEl.value;
  if (!el || !window.turnstile) return;
  if (turnstileWidgetId) {
    try {
      window.turnstile.remove(turnstileWidgetId);
    } catch {
      /* ignore */
    }
    turnstileWidgetId = null;
  }
  turnstileWidgetId = window.turnstile.render(el, {
    sitekey: props.turnstileSiteKey,
    appearance: "interaction-only",
    callback: onTurnstileSuccess,
    "expired-callback": onTurnstileExpired,
  });
}

onMounted(() => {
  window.onTurnstileSuccess = onTurnstileSuccess;
  window.onTurnstileExpired = onTurnstileExpired;
  // Turnstile CDN may load before or after this form exists.
  renderTurnstile();
  const poll = window.setInterval(() => {
    if (window.turnstile) {
      renderTurnstile();
      window.clearInterval(poll);
    }
  }, 200);
  window.setTimeout(() => window.clearInterval(poll), 8000);
});

onUnmounted(() => {
  if (window.onTurnstileSuccess === onTurnstileSuccess) delete window.onTurnstileSuccess;
  if (window.onTurnstileExpired === onTurnstileExpired) delete window.onTurnstileExpired;
  if (turnstileWidgetId && window.turnstile) {
    try {
      window.turnstile.remove(turnstileWidgetId);
    } catch {
      /* ignore */
    }
  }
});
</script>

<template>
  <!--
    `novalidate` is what makes the localized errors below reachable. With
    `required` + `type="email"` the browser runs its own constraint check first,
    blocks submission and shows a native bubble — worded in the *browser's* UI
    language, not the page's, so an Italian page in an English Chrome scolds you
    in English and `onSubmit` never fires. The `required` attributes stay: they
    are the accessible semantics, and validation is ours to word.
  -->
  <form
    class="contact-form"
    :action="action"
    method="POST"
    novalidate
    :aria-label="t.contactFormLabel"
    @submit="onSubmit"
  >
    <div class="form-group">
      <label for="name" class="sr-only">{{ t.contactName }}</label>
      <input
        id="name"
        v-model="name"
        type="text"
        name="name"
        :placeholder="t.contactName"
        required
        autocomplete="name"
        :class="{ 'input-error': nameError }"
        :aria-invalid="nameError ? 'true' : undefined"
        :aria-describedby="nameError ? 'name-error' : undefined"
      />
      <span v-if="nameError" id="name-error" class="error-message" role="alert">{{ nameError }}</span>
    </div>
    <div class="form-group">
      <label for="email" class="sr-only">{{ t.contactEmail }}</label>
      <input
        id="email"
        v-model="email"
        type="email"
        name="email"
        :placeholder="t.contactEmail"
        required
        autocomplete="email"
        :class="{ 'input-error': emailError }"
        :aria-invalid="emailError ? 'true' : undefined"
        :aria-describedby="emailError ? 'email-error' : undefined"
      />
      <span v-if="emailError" id="email-error" class="error-message" role="alert">{{ emailError }}</span>
    </div>
    <div class="form-group">
      <label for="message" class="sr-only">{{ t.contactMessageLabel }}</label>
      <textarea
        id="message"
        v-model="message"
        name="message"
        :placeholder="t.contactMessage"
        rows="5"
        required
        :class="{ 'input-error': messageError }"
        :aria-invalid="messageError ? 'true' : undefined"
        :aria-describedby="messageError ? 'message-error' : undefined"
      />
      <span v-if="messageError" id="message-error" class="error-message" role="alert">{{ messageError }}</span>
    </div>
    <div ref="turnstileEl" class="cf-turnstile" />
    <button type="submit" class="magnetic contact-btn" :disabled="submitting">
      {{ submitLabel }}
    </button>
    <div v-if="formMessage" class="form-message" :class="`form-message--${formMessageType}`">
      {{ formMessage }}
    </div>
  </form>
</template>
