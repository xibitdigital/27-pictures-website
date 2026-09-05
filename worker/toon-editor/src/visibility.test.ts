import { describe, expect, it } from "vitest";
import { callerHostname, isStagingHostname, parseStatus, publicStatuses, publicStatusesForRequest } from "./visibility";

function req({ origin, referer, url }: { origin?: string; referer?: string; url?: string } = {}) {
  return {
    url: url || "https://toon-editor.example/catalog",
    headers: {
      get: (k: string) => {
        const key = k.toLowerCase();
        if (key === "origin") return origin || null;
        if (key === "referer") return referer || null;
        return null;
      },
    },
  };
}

describe("parseStatus", () => {
  it("accepts draft, staging and published", () => {
    expect(parseStatus("draft", "published")).toBe("draft");
    expect(parseStatus("staging", "draft")).toBe("staging");
    expect(parseStatus("public", "draft")).toBe("published");
    expect(parseStatus("published", "draft")).toBe("published");
    expect(parseStatus("nope", "draft")).toBe("draft");
  });
});

describe("staging host visibility", () => {
  it("treats staging and local hosts as staging", () => {
    expect(isStagingHostname("staging.twentyseven.pictures")).toBe(true);
    expect(isStagingHostname("localhost")).toBe(true);
    expect(isStagingHostname("127.0.0.1")).toBe(true);
    expect(isStagingHostname("twentyseven.pictures")).toBe(false);
  });

  it("shows staging + public on staging, public only on production", () => {
    expect(publicStatuses(true)).toEqual(["published", "staging"]);
    expect(publicStatuses(false)).toEqual(["published"]);
  });

  it("does not put Staging on the production catalog", () => {
    expect(publicStatusesForRequest(req({ origin: "https://twentyseven.pictures" }))).toEqual(["published"]);
  });

  it("reads the page host from Origin, then ?site=, then Referer", () => {
    expect(callerHostname(req({ origin: "https://staging.twentyseven.pictures" }))).toBe(
      "staging.twentyseven.pictures"
    );
    expect(callerHostname(req({ url: "https://api.example/catalog?site=http://localhost:5173" }))).toBe("localhost");
    expect(callerHostname(req({ referer: "https://staging.twentyseven.pictures/toons/" }))).toBe(
      "staging.twentyseven.pictures"
    );
    expect(
      callerHostname(
        req({ origin: "https://twentyseven.pictures", url: "https://api.example/catalog?site=http://localhost:5173" })
      )
    ).toBe("twentyseven.pictures");
  });

  it("keeps staging toons off the production site even if site= is spoofed", () => {
    expect(
      publicStatusesForRequest(
        req({
          origin: "https://twentyseven.pictures",
          url: "https://api.example/catalog?site=https://staging.twentyseven.pictures",
        })
      )
    ).toEqual(["published"]);
    expect(publicStatusesForRequest(req({ origin: "https://staging.twentyseven.pictures" }))).toEqual([
      "published",
      "staging",
    ]);
    expect(publicStatusesForRequest(req({ origin: "https://twentyseven.pictures" }))).toEqual(["published"]);
    expect(publicStatusesForRequest(req({}))).toEqual(["published"]);
  });
});
