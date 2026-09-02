<script setup lang="ts">
import { ref } from "vue";
import { login, register, setToken, type AuthPayload, type EditorUser } from "../api";
import { pushToast } from "../toast";

const props = defineProps<{
  hasUsers: boolean;
}>();

const emit = defineEmits<{
  loggedIn: [user: EditorUser];
}>();

const email = ref("");
const password = ref("");
const submitting = ref(false);

async function onSubmit(ev: Event): Promise<void> {
  ev.preventDefault();
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
    <h1>{{ hasUsers ? "Log in" : "Create editor account" }}</h1>
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
    <button class="editor-btn" type="submit" :disabled="submitting">
      {{ submitting ? "Please wait…" : hasUsers ? "Log in" : "Create account" }}
    </button>
  </form>
</template>
