import { describe, expect, it } from "vitest";
import { AttributionStore, sourceFromStartPayload } from "../src/attribution.js";

describe("start attribution", () => {
  it.each([
    [undefined, "direct"],
    ["channel", "channel"],
    ["juyucom", "juyucom"],
    ["share_example-com", "share"],
    ["ref_reporttoken", "referral"],
    ["buy_example-com", "juyu_domain_bot"],
    ["sell_asset--name-com", "juyu_domain_bot"],
    ["register_newbrand-cn", "juyu_domain_bot"],
    ["src_kol-Tony!", "kol-tony_"],
  ])("maps %s to %s", (payload, expected) => {
    expect(sourceFromStartPayload(payload)).toBe(expected);
  });

  it("remembers and sanitizes a user's source", () => {
    const store = new AttributionStore();
    expect(store.set(42, "Campaign / August")).toBe("campaign___august");
    expect(store.peek(42)).toBe("campaign___august");
    expect(store.get(42)).toBe("campaign___august");
    expect(store.peek(99)).toBeNull();
    expect(store.get(99)).toBe("direct");
  });
});
