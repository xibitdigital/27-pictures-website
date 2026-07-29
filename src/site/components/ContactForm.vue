<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";

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

const name = ref("");
const email = ref("");
const message = ref("");
const nameError = ref("");
const emailError = ref("");
const messageError = ref("");
const formMessage = ref("");
const formMessageType = ref<"success" | "error">("success");
const submitting = ref(false);
const submitLabel = ref("Send Message");

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
  submitLabel.value = "Sending...";

  try {
    const body = new FormData();
    body.set("name", name.value.trim());
    body.set("email", email.value.trim());
    body.set("message", message.value.trim());
    if (turnstileToken) body.set("cf-turnstile-response", turnstileToken);

    const response = await fetch(props.action, { method: "POST", body });

    if (response.ok) {
      formMessage.value = "Message sent successfully!";
      formMessageType.value = "success";
      name.value = "";
      email.value = "";
      message.value = "";
      turnstileToken = null;
    } else {
      const errorText = await response.text();
      formMessage.value = errorText || "Failed to send message. Please try again.";
      formMessageType.value = "error";
    }
  } catch {
    formMessage.value = "An error occurred. Please try again.";
    formMessageType.value = "error";
  } finally {
    submitting.value = false;
    submitLabel.value = "Send Message";
  }
}

function onSubmit(e: Event): void {
  e.preventDefault();
  clearErrors();
  let isValid = true;

  if (name.value.trim() === "") {
    nameError.value = "Please enter your name";
    isValid = false;
  }
  if (!emailRegex.test(email.value.trim())) {
    emailError.value = "Please enter a valid email address";
    isValid = false;
  }
  if (message.value.trim() === "") {
    messageError.value = "Please enter a message";
    isValid = false;
  }
  if (!isValid) return;

  if (turnstileToken) {
    submitContactForm();
  } else {
    formReadyToSubmit = true;
    submitting.value = true;
    submitLabel.value = "Verifying...";
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
  const t = window.setInterval(() => {
    if (window.turnstile) {
      renderTurnstile();
      window.clearInterval(t);
    }
  }, 200);
  window.setTimeout(() => window.clearInterval(t), 8000);
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
  <!-- No .reveal on the form — it mounts after IntersectionObserver setup;
       parent #contact-form-app owns the reveal animation. -->
  <form class="contact-form" :action="action" method="POST" aria-label="Contact form" @submit="onSubmit">
    <div class="form-group">
      <label for="name" class="sr-only">Your Name</label>
      <input
        id="name"
        v-model="name"
        type="text"
        name="name"
        placeholder="Your Name"
        required
        autocomplete="name"
        :class="{ 'input-error': nameError }"
      />
      <span v-if="nameError" class="error-message">{{ nameError }}</span>
    </div>
    <div class="form-group">
      <label for="email" class="sr-only">Your Email</label>
      <input
        id="email"
        v-model="email"
        type="email"
        name="email"
        placeholder="Your Email"
        required
        autocomplete="email"
        :class="{ 'input-error': emailError }"
      />
      <span v-if="emailError" class="error-message">{{ emailError }}</span>
    </div>
    <div class="form-group">
      <label for="message" class="sr-only">Your Message</label>
      <textarea
        id="message"
        v-model="message"
        name="message"
        placeholder="Tell us about your project..."
        rows="5"
        required
        :class="{ 'input-error': messageError }"
      />
      <span v-if="messageError" class="error-message">{{ messageError }}</span>
    </div>
    <div ref="turnstileEl" class="cf-turnstile" />
    <button type="submit" class="magnetic contact-btn" :disabled="submitting">
      {{ submitLabel }}
    </button>
    <div
      v-if="formMessage"
      class="form-message"
      :class="`form-message--${formMessageType}`"
    >
      {{ formMessage }}
    </div>
  </form>
</template>
