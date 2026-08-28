import { describe, expect, it } from "vitest";
import { requireJwtSecret, signJwt, verifyJwt } from "./jwt";

const SECRET = "a".repeat(32);
const OTHER = "b".repeat(32);

describe("editor JWT", () => {
  it("round-trips a signed payload", async () => {
    const exp = Math.floor(Date.now() / 1000) + 60;
    const token = await signJwt({ sub: "u1", email: "a@b.c", exp }, SECRET);
    expect(token.split(".")).toHaveLength(3);
    await expect(verifyJwt(token, SECRET)).resolves.toMatchObject({ sub: "u1", email: "a@b.c" });
  });

  it("rejects a token signed with another secret", async () => {
    const exp = Math.floor(Date.now() / 1000) + 60;
    const token = await signJwt({ sub: "u1", exp }, SECRET);
    await expect(verifyJwt(token, OTHER)).resolves.toBeNull();
  });

  it("rejects an expired token", async () => {
    const token = await signJwt({ sub: "u1", exp: Math.floor(Date.now() / 1000) - 10 }, SECRET);
    await expect(verifyJwt(token, SECRET)).resolves.toBeNull();
  });

  it("rejects alg=none and truncated tokens", async () => {
    const exp = Math.floor(Date.now() / 1000) + 60;
    const token = await signJwt({ sub: "u1", exp }, SECRET);
    const [h, p] = token.split(".");
    const noneHeader = btoa(JSON.stringify({ alg: "none", typ: "JWT" }))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    await expect(verifyJwt(`${noneHeader}.${p}.`, SECRET)).resolves.toBeNull();
    await expect(verifyJwt(`${h}.${p}`, SECRET)).resolves.toBeNull();
    await expect(verifyJwt("", SECRET)).resolves.toBeNull();
  });

  it("refuses a short secret", () => {
    expect(() => requireJwtSecret({ JWT_SECRET: "dev-local" })).toThrow(/JWT_SECRET/);
    expect(requireJwtSecret({ JWT_SECRET: SECRET })).toBe(SECRET);
  });
});
