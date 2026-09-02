import { afterEach, describe, expect, it, vi } from "vitest";
import { parseGenerateAudioBody, synthesizeSfx, synthesizeSpeech } from "./elevenlabs";

describe("parseGenerateAudioBody", () => {
  it("requires text", () => {
    expect(parseGenerateAudioBody({})).toEqual({ ok: false, error: "text is required" });
  });

  it("treats an empty voice as SFX", () => {
    expect(parseGenerateAudioBody({ text: "CLANK" })).toEqual({
      ok: true,
      value: { kind: "sfx", text: "CLANK" },
    });
  });

  it("rejects an unknown voice key", () => {
    const unknown = parseGenerateAudioBody({ text: "Hi", voice: "not-a-cast-member" });
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.error).toMatch(/unknown voice 'not-a-cast-member'/);
  });

  it("resolves erin from voices.json and defaults to eleven_v3", () => {
    const parsed = parseGenerateAudioBody({ text: "[whispers] Hi", voice: "erin" });
    expect(parsed).toEqual({
      ok: true,
      value: {
        kind: "tts",
        text: "[whispers] Hi",
        voice: "erin",
        voiceId: "esy0r39YPLQjOczyOib8",
        model: "eleven_v3",
        stability: 0.3,
      },
    });
  });

  it("rejects an unknown model", () => {
    const parsed = parseGenerateAudioBody({ text: "Hi", voice: "erin", model: "turbo" });
    expect(parsed).toEqual({ ok: false, error: "unsupported model 'turbo'" });
  });
});

describe("synthesizeSpeech", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("POSTs TTS and returns mp3 bytes", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]).buffer;
    const fetchMock = vi.fn().mockResolvedValue(new Response(bytes, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const out = await synthesizeSpeech("key-1", {
      kind: "tts",
      text: "[whispers] Hi",
      voice: "erin",
      voiceId: "esy0r39YPLQjOczyOib8",
      model: "eleven_v3",
      stability: 0.3,
    });
    expect(out).toEqual({ ok: true, bytes });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.elevenlabs.io/v1/text-to-speech/esy0r39YPLQjOczyOib8");
    const headers = new Headers(init.headers);
    expect(headers.get("xi-api-key")).toBe("key-1");
    expect(JSON.parse(String(init.body))).toEqual({
      text: "[whispers] Hi",
      model_id: "eleven_v3",
      voice_settings: { stability: 0.3, similarity_boost: 0.8 },
    });
  });

  it("maps an ElevenLabs error to a 502", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ detail: { message: "quota exceeded" } }), { status: 401 }))
    );
    const out = await synthesizeSpeech("bad", {
      kind: "tts",
      text: "Hi",
      voice: "erin",
      voiceId: "esy0r39YPLQjOczyOib8",
      model: "eleven_v3",
      stability: 0.3,
    });
    expect(out).toEqual({ ok: false, error: "quota exceeded", status: 502 });
  });
});

describe("synthesizeSfx", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("POSTs sound-generation and returns mp3 bytes", async () => {
    const bytes = new Uint8Array([9, 8, 7]).buffer;
    const fetchMock = vi.fn().mockResolvedValue(new Response(bytes, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const out = await synthesizeSfx("key-1", { kind: "sfx", text: "CLANK" });
    expect(out).toEqual({ ok: true, bytes });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.elevenlabs.io/v1/sound-generation");
    expect(JSON.parse(String(init.body))).toEqual({ text: "CLANK", prompt_influence: 0.4 });
  });
});
