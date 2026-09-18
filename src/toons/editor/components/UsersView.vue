<script setup lang="ts">
import { inject, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { inviteUser, listUsers, removeUser, resendPassword, updateUserRole } from "../api";
import { EDITOR_USER_KEY } from "../session";
import { pushToast } from "../toast";
import type { EditorUser, UserRole } from "../types";
import ConfirmDialog from "./ConfirmDialog.vue";
import EditorBar from "./EditorBar.vue";
import EditorButton from "./ui/EditorButton.vue";
import EditorSelect from "./ui/EditorSelect.vue";
import EditorSelectItem from "./ui/EditorSelectItem.vue";

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

const changingRoleId = ref<string | null>(null);

async function onRoleChange(user: EditorUser, role: UserRole): Promise<void> {
  if (role === user.role || changingRoleId.value) return;
  changingRoleId.value = user.id;
  const previous = user.role;
  user.role = role; // optimistic — reverted below on failure
  try {
    await updateUserRole(user.id, role);
    pushToast(`${user.username} is now ${role === "admin" ? "an admin" : "an editor"}`, "success");
  } catch (err) {
    user.role = previous;
    pushToast(err instanceof Error ? err.message : "Could not change role");
  } finally {
    changingRoleId.value = null;
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

async function sendInvite(): Promise<void> {
  saving.value = true;
  try {
    const result = await inviteUser({
      username: username.value.trim(),
      email: email.value.trim(),
      role: role.value,
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
  } catch (err) {
    pushToast(err instanceof Error ? err.message : "Invite failed");
  } finally {
    saving.value = false;
  }
}

function onSubmit(ev: Event): void {
  ev.preventDefault();
  void sendInvite();
}
</script>

<template>
  <div class="editor-page">
    <EditorBar title="Manage users">
      <template #primary>
        <EditorButton type="submit" form="invite-user" :disabled="saving">
          {{ saving ? "Sending…" : "Send invite" }}
        </EditorButton>
      </template>
    </EditorBar>
    <div class="editor-page-body">
      <div class="editor-form">
        <section class="editor-form-main">
          <h2 class="editor-list-heading">Users</h2>
          <p v-if="loadingUsers" class="editor-muted">Loading…</p>
          <p v-else-if="!users.length" class="editor-muted">No accounts yet.</p>
          <ul v-else class="editor-user-roster">
            <li v-for="user in users" :key="user.id" class="editor-user-row">
              <span class="editor-user-row-info">
                <strong>{{ user.username }}</strong>
                <span class="editor-muted">{{ user.email }}</span>
              </span>
              <EditorSelect
                class="editor-user-role"
                :model-value="user.role"
                :disabled="user.id === userRef?.id || changingRoleId === user.id"
                :name="`role-${user.id}`"
                :aria-label="`${user.username}'s role`"
                @update:model-value="(v) => onRoleChange(user, v as UserRole)"
              >
                <EditorSelectItem value="editor">Editor</EditorSelectItem>
                <EditorSelectItem value="admin">Admin</EditorSelectItem>
              </EditorSelect>
              <span class="editor-user-row-actions">
                <EditorButton variant="ghost" :disabled="resendingId === user.id" @click="onResendPassword(user)">
                  {{ resendingId === user.id ? "Sending…" : "Resend password" }}
                </EditorButton>
                <EditorButton
                  v-if="user.id !== userRef?.id"
                  variant="danger"
                  :disabled="removingId === user.id"
                  @click="requestRemoveUser(user)"
                >
                  {{ removingId === user.id ? "Removing…" : "Remove" }}
                </EditorButton>
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
