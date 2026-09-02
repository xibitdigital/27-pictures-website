import { fetchSubscription } from "./elevenlabs";
import type { CreditsSnapshot, Env } from "./types";

export type CreditKind = "audio" | "image";

export function utcDate(at = new Date()): string {
  return at.toISOString().slice(0, 10);
}

export function monthStartUtc(at = new Date()): string {
  return `${at.toISOString().slice(0, 7)}-01`;
}

export function snapshotRowId(userId: string, kind: CreditKind, usedAt: string, source: string): string {
  return `snap:${userId}:${kind}:${usedAt}:${source}`;
}

export async function insertCreditEvent(
  env: Env,
  input: { userId: string; kind: CreditKind; tokens: number; source: string; at?: Date }
): Promise<void> {
  const tokens = Math.max(0, Math.round(input.tokens));
  const usedAt = utcDate(input.at);
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO credit_usage (id, user_id, kind, tokens, used_at, source, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, input.userId, input.kind, tokens, usedAt, input.source, new Date().toISOString())
    .run();
}

export async function upsertCreditSnapshot(
  env: Env,
  input: { userId: string; kind: CreditKind; tokens: number; source: string; at?: Date }
): Promise<void> {
  const tokens = Math.max(0, Math.round(input.tokens));
  const usedAt = utcDate(input.at);
  const id = snapshotRowId(input.userId, input.kind, usedAt, input.source);
  const ts = new Date().toISOString();
  await env.DB.prepare(`DELETE FROM credit_usage WHERE user_id = ? AND kind = ? AND used_at = ? AND source = ?`)
    .bind(input.userId, input.kind, usedAt, input.source)
    .run();
  await env.DB.prepare(
    `INSERT INTO credit_usage (id, user_id, kind, tokens, used_at, source, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, input.userId, input.kind, tokens, usedAt, input.source, ts)
    .run();
}

export async function sumCredits(env: Env, userId: string, kind: CreditKind, fromDay: string): Promise<number> {
  const row = await env.DB.prepare(
    `SELECT COALESCE(SUM(tokens), 0) AS total
     FROM credit_usage
     WHERE user_id = ? AND kind = ? AND used_at >= ? AND source != 'elevenlabs-subscription'`
  )
    .bind(userId, kind, fromDay)
    .first<{ total: number }>();
  return row ? Number(row.total) || 0 : 0;
}

export function emptyCredits(): CreditsSnapshot {
  return {
    audio: { used: 0, limit: null, unit: "chars" },
    image: { used: 0, limit: null, unit: "credits" },
    periodEnd: null,
  };
}

export async function loadUserCredits(env: Env, userId: string): Promise<CreditsSnapshot> {
  const fromDay = monthStartUtc();
  const imageUsed = await sumCredits(env, userId, "image", fromDay);
  const credits = emptyCredits();
  credits.image.used = imageUsed;

  const apiKey = env.ELEVENLABS_API_KEY?.trim();
  if (apiKey) {
    const sub = await fetchSubscription(apiKey);
    if (sub.ok) {
      await upsertCreditSnapshot(env, {
        userId,
        kind: "audio",
        tokens: sub.value.characterCount,
        source: "elevenlabs-subscription",
      });
      credits.audio.used = sub.value.characterCount;
      credits.audio.limit = sub.value.characterLimit;
      credits.periodEnd = sub.value.resetUnix ? new Date(sub.value.resetUnix * 1000).toISOString() : null;
      return credits;
    }
  }

  credits.audio.used = await sumCredits(env, userId, "audio", fromDay);
  return credits;
}
