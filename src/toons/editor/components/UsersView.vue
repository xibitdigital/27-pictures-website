<script setup lang="ts">
import { inject, onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import { inviteUser, listUsers, removeUser, resendPassword } from "../api";
import { EDITOR_USER_KEY } from "../session";
import { pushToast } from "../toast";
import type { EditorUser, UserRole } from "../types";
import ConfirmDialog from "./ConfirmDialog.vue";
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

const users = ref<EditorUser[]>([]);
const loadingUsers = ref(true);
const resendingId = ref<string | null>(null);

onMounted(async () => {
  try {
    users.value = await listUsers();
  } catch (err) {
    pushToast(err instanceof Error ? err.message : "Failed to load users");
  } finally {
    loadingUsers.value = false;
  }
});

async function onResendPassword(user: EditorUser): Promise<void> {
  if (resendingId.value) return;
  resendingId.value = user.id;
  try {
    const result = await resendPassword(user.id);
    pushToast(
      result.emailSent
        ? `New password emailed to ${user.email}`
        : `Password reset, but the email failed to send — ask an admin to relay it another way.`,
      result.emailSent ? "success" : "error"
    );
  } catch (err) {
    pushToast(err instanceof Error ? err.message : "Could not resend password");
  } finally {
    resendingId.value = null;
  }
}

const removingId = ref<string | null>(null);
const confirmRemoveUser = ref<EditorUser | null>(null);

function requestRemoveUser(user: EditorUser): void {
  confirmRemoveUser.value = user;
}

async function onConfirmRemoveUser(): Promise<void> {
  const user = confirmRemoveUser.value;
  confirmRemoveUser.value = null;
  if (!user) return;
  removingId.value = user.id;
  try {
    await removeUser(user.id);
    users.value = users.value.filter((u) => u.id !== user.id);
    pushToast(`Removed ${user.username}`, "success");
  } catch (err) {
    pushToast(err instanceof Error ? err.message : "Could not remove user");
  } finally {
    removingId.value = null;
  }
}

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
    users.value = [...users.value, result.user].sort((a, b) => a.username.localeCompare(b.username));
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
    <EditorBar title="Manage users">
      <template #primary>
        <button class="editor-btn" type="submit" form="invite-user" :disabled="saving">
          {{ saving ? "Sending…" : "Send invite" }}
        </button>
      </template>
    </EditorBar>
    <div class="editor-page-body">
      <div class="editor-form">
        <section>
          <h2 class="editor-list-heading">Users</h2>
          <p v-if="loadingUsers" class="editor-muted">Loading…</p>
          <p v-else-if="!users.length" class="editor-muted">No accounts yet.</p>
          <ul v-else class="editor-user-roster">
            <li v-for="user in users" :key="user.id" class="editor-user-row">
              <span class="editor-user-row-info">
                <strong>{{ user.username }}</strong>
                <span class="editor-muted">{{ user.email }} · {{ user.role }}</span>
              </span>
              <span class="editor-user-row-actions">
                <button
                  class="editor-btn editor-btn--ghost"
                  type="button"
                  :disabled="resendingId === user.id"
                  @click="onResendPassword(user)"
                >
                  {{ resendingId === user.id ? "Sending…" : "Resend password" }}
                </button>
                <button
                  v-if="user.id !== userRef?.id"
                  class="editor-btn editor-btn--ghost"
                  type="button"
                  :disabled="removingId === user.id"
                  @click="requestRemoveUser(user)"
                >
                  {{ removingId === user.id ? "Removing…" : "Remove" }}
                </button>
              </span>
            </li>
          </ul>
        </section>
        <aside class="editor-form-preview">
          <h2 class="editor-list-heading">Invite a new user</h2>
          <form id="invite-user" novalidate @submit="onSubmit">
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
            <div ref="turnstileEl" class="cf-turnstile" />
          </form>
        </aside>
      </div>
    </div>
    <ConfirmDialog
      :open="!!confirmRemoveUser"
      title="Remove user"
      :message="`Remove ${confirmRemoveUser?.username}? They immediately lose access — this can't be undone.`"
      confirm-label="Remove"
      focus-confirm
      @confirm="onConfirmRemoveUser"
      @cancel="confirmRemoveUser = null"
    />
  </div>
</template>
