<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { login, register, setToken, type AuthPayload, type EditorUser } from "../api";
import { pushToast } from "../toast";
import { editorViewportFits } from "../viewport";
import EditorButton from "./ui/EditorButton.vue";

const props = defineProps<{
  hasUsers: boolean;
}>();

const emit = defineEmits<{
  loggedIn: [user: EditorUser];
}>();

const email = ref("");
const password = ref("");
const submitting = ref(false);
const viewportFits = ref(editorViewportFits());

function measureViewport(): void {
  viewportFits.value = editorViewportFits();
}

onMounted(() => {
  measureViewport();
  window.addEventListener("resize", measureViewport);
});
onBeforeUnmount(() => {
  window.removeEventListener("resize", measureViewport);
});

async function onSubmit(ev: Event): Promise<void> {
  ev.preventDefault();
  if (!viewportFits.value) return;
  submitting.value = true;
  try {
    const payload: AuthPayload = props.hasUsers
      ? await login(email.value.trim(), password.value)
      : await register(email.value.trim(), password.value);
    setToken(payload.token);
    emit("loggedIn", payload.user);
  } catch (err) {
    pushToast(err instanceof Error ? err.message : "Sign in failed");
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <form class="editor-gate" novalidate @submit="onSubmit">
    <header class="editor-gate-brand">
      <a href="/" class="editor-gate-logo">
        <img src="/logo.1a83b92ec2.png" alt="27 Pictures" width="180" height="270" />
      </a>
      <p class="editor-gate-product">FlipFrame Studio</p>
      <p class="editor-gate-tagline">Make toons people turn, not watch.</p>
      <p class="editor-gate-deck">
        Plates, voiced captions, and a reader that works like a book — one studio to draw, letter, and publish.
      </p>
    </header>
    <h1>{{ hasUsers ? "Log in" : "Create editor account" }}</h1>
    <p v-if="!viewportFits" class="editor-error editor-gate-size" data-editor-size role="alert">
      FlipFrame Studio needs an iPad or a desktop. This screen is too small.
    </p>
    <p v-if="!hasUsers" class="editor-muted">First account on this Worker. Later sign-ins use the same email.</p>
    <label>
      Email
      <input v-model="email" type="email" name="email" autocomplete="username" required />
    </label>
    <label>
      Password
      <input
        v-model="password"
        type="password"
        name="password"
        :autocomplete="hasUsers ? 'current-password' : 'new-password'"
        minlength="8"
        required
      />
    </label>
    <EditorButton type="submit" :disabled="submitting || !viewportFits">
      {{ submitting ? "Please wait…" : hasUsers ? "Log in" : "Create account" }}
    </EditorButton>
    <p v-if="hasUsers" class="editor-muted editor-gate-invite">
      Studio access is invite-only.
      <a href="/#contact" class="editor-field-link">Ask for one through the contact form</a>.
    </p>
  </form>
</template>
