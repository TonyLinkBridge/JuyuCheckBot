import { describe, expect, it } from "vitest";
import { AttributionStore, sourceFromStartPayload } from "../src/attribution.js";

describe("start attribution", () => {
  it.each([
    [undefined, "direct"],
    ["channel", "channel"],
    ["juyucom", "juyucom"],
    ["share_example-com", "share"],
    ["src_kol-Tony!", "kol-tony_"],
  ])("maps %s to %s", (payload, expected) => {
    expect(sourceFromStartPayload(payload)).toBe(expected);
  });

  it("remembers and sanitizes a user's source", () => {
    const store = new AttributionStore();
    expect(store.set(42, "Campaign / August")).toBe("campaign___august");
    expect(store.get(42)).toBe("campaign___august");
    expect(store.get(99)).toBe("direct");
  });
});
