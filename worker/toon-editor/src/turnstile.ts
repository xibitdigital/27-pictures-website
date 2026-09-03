/** Cloudflare Turnstile server-side verification — same flow as the contact-form Worker. */

export async function verifyTurnstile(
  env: { TURNSTILE_SECRET_KEY?: string },
  token: string,
  remoteIp: string | null
): Promise<boolean> {
  if (!env.TURNSTILE_SECRET_KEY || !token) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: env.TURNSTILE_SECRET_KEY,
        response: token,
        remoteip: remoteIp || undefined,
      }),
    });
    const data = (await res.json()) as { success?: boolean };
    return Boolean(data.success);
  } catch {
    return false;
  }
}
