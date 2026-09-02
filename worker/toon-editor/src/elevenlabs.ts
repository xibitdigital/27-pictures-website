import { knownVoiceNames, VOICE_IDS } from "./voices";

export const DEFAULT_TTS_MODEL = "eleven_v3";
export const DEFAULT_STABILITY = 0.3;
export const DEFAULT_SIMILARITY = 0.8;

const ALLOWED_MODELS = new Set(["eleven_v3", "eleven_multilingual_v2"]);
const TTS_URL = "https://api.elevenlabs.io/v1/text-to-speech";
const SFX_URL = "https://api.elevenlabs.io/v1/sound-generation";
const SUBSCRIPTION_URL = "https://api.elevenlabs.io/v1/user/subscription";

export type ElevenSubscription = {
  characterCount: number;
  characterLimit: number | null;
  resetUnix: number | null;
};
const SFX_PROMPT_INFLUENCE = 0.4;

export type GenerateAudioInput =
  | {
      kind: "tts";
      text: string;
      voice: string;
      voiceId: string;
      model: string;
      stability: number;
    }
  | { kind: "sfx"; text: string };

export function parseGenerateAudioBody(
  body: Record<string, unknown>
): { ok: true; value: GenerateAudioInput } | { ok: false; error: string } {
  const text = String(body.text ?? "").trim();
  if (!text) return { ok: false, error: "text is required" };
  const voice = String(body.voice ?? "").trim();
  if (!voice) return { ok: true, value: { kind: "sfx", text } };
  const voiceId = VOICE_IDS[voice];
  if (!voiceId) {
    return { ok: false, error: `unknown voice '${voice}' — known: ${knownVoiceNames().join(", ")}` };
  }
  const model = String(body.model ?? DEFAULT_TTS_MODEL).trim() || DEFAULT_TTS_MODEL;
  if (!ALLOWED_MODELS.has(model)) return { ok: false, error: `unsupported model '${model}'` };
  const stabilityRaw = body.stability != null ? Number(body.stability) : DEFAULT_STABILITY;
  const stability = Number.isFinite(stabilityRaw) ? Math.min(1, Math.max(0, stabilityRaw)) : DEFAULT_STABILITY;
  return { ok: true, value: { kind: "tts", text, voice, voiceId, model, stability } };
}

function elevenErrorMessage(raw: string, status: number): string {
  try {
    const parsed = JSON.parse(raw) as { detail?: unknown };
    const detail = parsed.detail;
    if (typeof detail === "string" && detail.trim()) return detail;
    if (detail && typeof detail === "object" && "message" in detail) {
      const message = (detail as { message: unknown }).message;
      if (typeof message === "string" && message.trim()) return message;
    }
  } catch {
    /* fallback */
  }
  return `ElevenLabs request failed (${status})`;
}

export async function synthesizeSpeech(
  apiKey: string,
  input: Extract<GenerateAudioInput, { kind: "tts" }>
): Promise<{ ok: true; bytes: ArrayBuffer } | { ok: false; error: string; status: number }> {
  const res = await fetch(`${TTS_URL}/${input.voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: input.text,
      model_id: input.model,
      voice_settings: { stability: input.stability, similarity_boost: DEFAULT_SIMILARITY },
    }),
  });
  if (!res.ok) {
    const raw = await res.text();
    return { ok: false, error: elevenErrorMessage(raw, res.status), status: 502 };
  }
  const bytes = await res.arrayBuffer();
  if (!bytes.byteLength) return { ok: false, error: "ElevenLabs returned empty audio", status: 502 };
  return { ok: true, bytes };
}

export async function synthesizeSfx(
  apiKey: string,
  input: Extract<GenerateAudioInput, { kind: "sfx" }>
): Promise<{ ok: true; bytes: ArrayBuffer } | { ok: false; error: string; status: number }> {
  const res = await fetch(SFX_URL, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: input.text,
      prompt_influence: SFX_PROMPT_INFLUENCE,
    }),
  });
  if (!res.ok) {
    const raw = await res.text();
    return { ok: false, error: elevenErrorMessage(raw, res.status), status: 502 };
  }
  const bytes = await res.arrayBuffer();
  if (!bytes.byteLength) return { ok: false, error: "ElevenLabs returned empty audio", status: 502 };
  return { ok: true, bytes };
}

export async function generateClip(
  apiKey: string,
  input: GenerateAudioInput
): Promise<{ ok: true; bytes: ArrayBuffer } | { ok: false; error: string; status: number }> {
  return input.kind === "sfx" ? synthesizeSfx(apiKey, input) : synthesizeSpeech(apiKey, input);
}

export async function fetchSubscription(
  apiKey: string
): Promise<{ ok: true; value: ElevenSubscription } | { ok: false; error: string }> {
  const res = await fetch(SUBSCRIPTION_URL, {
    method: "GET",
    headers: { "xi-api-key": apiKey, Accept: "application/json" },
  });
  if (!res.ok) {
    const raw = await res.text();
    return { ok: false, error: elevenErrorMessage(raw, res.status) };
  }
  const body = (await res.json()) as {
    character_count?: unknown;
    character_limit?: unknown;
    next_character_count_reset_unix?: unknown;
  };
  const characterCount = Number(body.character_count);
  const characterLimit = Number(body.character_limit);
  const resetUnix = Number(body.next_character_count_reset_unix);
  return {
    ok: true,
    value: {
      characterCount: Number.isFinite(characterCount) ? characterCount : 0,
      characterLimit: Number.isFinite(characterLimit) && characterLimit > 0 ? characterLimit : null,
      resetUnix: Number.isFinite(resetUnix) && resetUnix > 0 ? resetUnix : null,
    },
  };
}
