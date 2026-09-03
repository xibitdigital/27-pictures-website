<script setup lang="ts">
import { inject, onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import { inviteUser } from "../api";
import { EDITOR_USER_KEY } from "../session";
import { pushToast } from "../toast";
import type { UserRole } from "../types";
import EditorBar from "./EditorBar.vue";
import EditorSelect from "./ui/EditorSelect.vue";
import EditorSelectItem from "./ui/EditorSelectItem.vue";

// Its own Turnstile widget — separate from the contact form's
// (src/site/components/ContactForm.vue) so rotating one never affects the other.
const TURNSTILE_SITE_KEY = "0x4AAAAAAEmUTf_BMK-zvngt";

const router = useRouter();
const userRef = inject(EDITOR_USER_KEY);

onMounted(() => {
  if (userRef?.value && userRef.value.role !== "admin") router.replace("/");
});

const username = ref("");
const email = ref("");
const role = ref<UserRole>("editor");
const saving = ref(false);

let turnstileToken = "";
let formReadyToSubmit = false;

async function sendInvite(): Promise<void> {
  saving.value = true;
  try {
    const result = await inviteUser({
      username: username.value.trim(),
      email: email.value.trim(),
      role: role.value,
      turnstileToken,
    });
    if (result.emailSent) {
      pushToast(`Invite sent to ${result.user.email}`, "success");
    } else {
      pushToast(
        `Account created for ${result.user.email}, but the invite email failed to send — ask an admin to relay access another way.`,
        "error"
      );
    }
    username.value = "";
    email.value = "";
    role.value = "editor";
    turnstileToken = "";
  } catch (err) {
    pushToast(err instanceof Error ? err.message : "Invite failed");
  } finally {
    saving.value = false;
  }
}

function onSubmit(ev: Event): void {
  ev.preventDefault();
  if (turnstileToken) {
    void sendInvite();
    return;
  }
  formReadyToSubmit = true;
  saving.value = true;
  if (window.turnstile) {
    window.turnstile.execute();
  } else {
    void sendInvite();
  }
}

function onTurnstileSuccess(token: string): void {
  turnstileToken = token;
  if (formReadyToSubmit) {
    formReadyToSubmit = false;
    void sendInvite();
  }
}

function onTurnstileExpired(): void {
  turnstileToken = "";
}

const turnstileEl = ref<HTMLElement | null>(null);
let turnstileWidgetId: string | null = null;

function renderTurnstile(): void {
  const el = turnstileEl.value;
  if (!el || !window.turnstile) return;
  turnstileWidgetId = window.turnstile.render(el, {
    sitekey: TURNSTILE_SITE_KEY,
    appearance: "interaction-only",
    callback: onTurnstileSuccess,
    "expired-callback": onTurnstileExpired,
  });
}

onMounted(() => {
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
  <div class="editor-page">
    <EditorBar title="Invite user">
      <template #actions>
        <button class="editor-btn" type="submit" form="invite-user" :disabled="saving">
          {{ saving ? "Sending…" : "Send invite" }}
        </button>
      </template>
    </EditorBar>
    <form id="invite-user" class="editor-form" novalidate @submit="onSubmit">
      <div class="editor-form-main">
        <label>
          Username
          <input v-model="username" name="username" required autocomplete="off" />
        </label>
        <label>
          Email
          <input v-model="email" type="email" name="email" required autocomplete="off" />
        </label>
        <label>
          Role
          <EditorSelect v-model="role" name="role">
            <EditorSelectItem value="editor"
              >Editor — can create series/toons, capped at draft or staging</EditorSelectItem
            >
            <EditorSelectItem value="admin">Admin — full access, can publish</EditorSelectItem>
          </EditorSelect>
        </label>
        <p class="editor-muted">
          A password is generated automatically and emailed to the invited address — it is never shown here.
        </p>
        <div ref="turnstileEl" class="cf-turnstile editor-form-span" />
      </div>
    </form>
  </div>
</template>
