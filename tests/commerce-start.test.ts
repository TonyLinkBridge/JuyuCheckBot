import { describe, expect, it } from "vitest";
import { parseCommerceStartPayload } from "../src/commerce/start.js";

describe("commerce Telegram start payloads", () => {
  it.each([
    ["buy_example-com", { action: "buy", domain: "example.com" }],
    ["sell_asset--name-com", { action: "sell", domain: "asset-name.com" }],
    ["register_newbrand-cn", { action: "register", domain: "newbrand.cn" }],
  ])("decodes %s without asking for the domain again", (payload, expected) => {
    expect(parseCommerceStartPayload(payload)).toEqual(expected);
  });

  it("rejects malformed and unrelated payloads", () => {
    expect(parseCommerceStartPayload("ref_report_123")).toBeNull();
    expect(parseCommerceStartPayload("sell_-bad-com")).toBeNull();
    expect(parseCommerceStartPayload("register_")).toBeNull();
  });
});
