import { describe, expect, it } from "vitest";
import { emptyCredits, monthStartUtc, snapshotRowId, utcDate } from "./creditUsage";

describe("creditUsage helpers", () => {
  it("formats UTC day and month start", () => {
    const at = new Date("2026-09-15T23:00:00.000Z");
    expect(utcDate(at)).toBe("2026-09-15");
    expect(monthStartUtc(at)).toBe("2026-09-01");
  });

  it("builds a stable snapshot id", () => {
    expect(snapshotRowId("u1", "audio", "2026-09-02", "elevenlabs-subscription")).toBe(
      "snap:u1:audio:2026-09-02:elevenlabs-subscription"
    );
  });

  it("starts both buckets at zero", () => {
    expect(emptyCredits()).toEqual({
      audio: { used: 0, limit: null, unit: "chars" },
      image: { used: 0, limit: null, unit: "credits" },
      periodEnd: null,
    });
  });
});
