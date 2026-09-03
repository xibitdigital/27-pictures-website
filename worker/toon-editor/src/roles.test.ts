import { describe, expect, it } from "vitest";
import { canManageSeries, canManageToon, isAdmin, publishError } from "./roles";
import type { EditorUser } from "./types";

function user(role: "admin" | "editor", id = "u1"): EditorUser {
  return { id, email: `${id}@example.com`, username: id, role };
}

describe("isAdmin", () => {
  it("is true only for an admin session", () => {
    expect(isAdmin(user("admin"))).toBe(true);
    expect(isAdmin(user("editor"))).toBe(false);
    expect(isAdmin(null)).toBe(false);
  });
});

describe("canManageSeries", () => {
  it("admin can manage any series", () => {
    expect(canManageSeries(user("admin"), { owner_id: "someone-else" })).toBe(true);
    expect(canManageSeries(user("admin"), { owner_id: null })).toBe(true);
  });

  it("editor can only manage their own series", () => {
    expect(canManageSeries(user("editor", "u1"), { owner_id: "u1" })).toBe(true);
    expect(canManageSeries(user("editor", "u1"), { owner_id: "u2" })).toBe(false);
    expect(canManageSeries(user("editor", "u1"), { owner_id: null })).toBe(false);
  });
});

describe("canManageToon", () => {
  it("grouped toon permission follows the series owner, not the toon's own owner_id", () => {
    const editor = user("editor", "u1");
    const groupedToon = { owner_id: "u2", series_key: "nero" };
    expect(canManageToon(editor, groupedToon, "u1")).toBe(true);
    expect(canManageToon(editor, groupedToon, "u2")).toBe(false);
  });

  it("ungrouped toon permission follows its own owner_id", () => {
    const editor = user("editor", "u1");
    expect(canManageToon(editor, { owner_id: "u1", series_key: null }, null)).toBe(true);
    expect(canManageToon(editor, { owner_id: "u2", series_key: null }, null)).toBe(false);
  });

  it("admin bypasses ownership entirely", () => {
    const admin = user("admin", "u9");
    expect(canManageToon(admin, { owner_id: "u2", series_key: "nero" }, "u2")).toBe(true);
  });
});

describe("publishError", () => {
  it("blocks an editor from publishing", () => {
    expect(publishError(user("editor"), "published")).toBe("editors cannot publish");
    expect(publishError(user("editor"), "draft")).toBeNull();
    expect(publishError(user("editor"), "staging")).toBeNull();
  });

  it("never blocks an admin", () => {
    expect(publishError(user("admin"), "published")).toBeNull();
  });
});
