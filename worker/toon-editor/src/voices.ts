/** Locked character → ElevenLabs voice_id. Same file the studio select uses. */
import lock from "../../../scripts/voices.json";

export const VOICE_IDS = lock as Record<string, string>;

export function knownVoiceNames(): string[] {
  return Object.keys(VOICE_IDS).sort();
}
