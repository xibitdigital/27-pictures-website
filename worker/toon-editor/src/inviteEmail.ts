/**
 * Invite email — Resend, same provider as the separate contact-form Worker,
 * but its own secret/vars on this Worker (different deployment, can't share
 * bindings across Workers).
 */

import type { Env } from "./types";

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function sendResendEmail(
  env: Env,
  { to, subject, html }: { to: string; subject: string; html: string }
): Promise<boolean> {
  if (!env.RESEND_API_KEY || !env.FROM_EMAIL) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${env.FROM_NAME || "27 Pictures Editor"} <${env.FROM_EMAIL}>`,
        to: [to],
        subject,
        html,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function sendInviteEmail(
  env: Env,
  { to, username, password, loginUrl }: { to: string; username: string; password: string; loginUrl: string }
): Promise<boolean> {
  return sendResendEmail(env, {
    to,
    subject: "Your 27 Pictures editor account",
    html: `
      <h2>You've been invited to the 27 Pictures toon editor</h2>
      <p><strong>Username:</strong> ${escapeHtml(username)}</p>
      <p><strong>Temporary password:</strong> ${escapeHtml(password)}</p>
      <p>Log in at <a href="${loginUrl}">${loginUrl}</a>. There is no self-service
      password change yet — ask an admin if you need it changed.</p>
    `,
  });
}

/** An admin regenerated this account's password from the Manage users screen — not requested by the account holder. */
export async function sendPasswordResetEmail(
  env: Env,
  { to, username, password, loginUrl }: { to: string; username: string; password: string; loginUrl: string }
): Promise<boolean> {
  return sendResendEmail(env, {
    to,
    subject: "Your 27 Pictures editor password was reset",
    html: `
      <h2>Your password was reset</h2>
      <p>An admin reset the password for your 27 Pictures editor account.</p>
      <p><strong>Username:</strong> ${escapeHtml(username)}</p>
      <p><strong>New password:</strong> ${escapeHtml(password)}</p>
      <p>Log in at <a href="${loginUrl}">${loginUrl}</a>. If you didn't expect this,
      contact an admin.</p>
    `,
  });
}
