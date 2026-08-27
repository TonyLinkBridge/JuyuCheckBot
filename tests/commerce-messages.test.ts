import { describe, expect, it } from "vitest";
import { startCommerceFlow } from "../src/commerce/flow.js";
import {
  commerceAdminText,
  commerceCompleteText,
  commercePromptKeyboard,
  commercePromptText,
  commerceResumeKeyboard,
  commerceResumeText,
} from "../src/commerce/messages.js";

describe("commerce flow messages", () => {
  it("shows Chinese-market buyer budgets and a cancel action", () => {
    const started = startCommerceFlow("buy", { domain: "example.com", source: "direct" });
    if (started.kind !== "prompt") throw new Error("expected prompt");
    const text = commercePromptText(started);
    const buttons = commercePromptKeyboard(started.prompt).inline_keyboard.flat();

    expect(text).toContain("委托购买 example.com");
    expect(text).toContain("预算范围");
    expect(buttons.map((button) => button.text)).toEqual([
      "低于 ¥5,000",
      "¥5,000–20,000",
      "¥20,000–100,000",
      "¥100,000–500,000",
      "¥500,000 以上",
      "暂时不确定",
      "取消",
    ]);
    expect(buttons[2]?.callback_data).toBe("commerce:choice:budget:20k_100k");
  });

  it("lets sellers choose a quote instead of typing a price", () => {
    const started = startCommerceFlow("sell", { domain: "5so.cc", source: "direct" });
    if (started.kind !== "prompt") throw new Error("expected prompt");
    const buttons = commercePromptKeyboard(started.prompt).inline_keyboard.flat();

    expect(commercePromptText(started)).toContain("CNY 30,000");
    expect(commercePromptText(started)).toContain("USD 5,000");
    expect(buttons.map((button) => button.text)).toEqual(["待报价 / 面议", "暂时不确定", "取消"]);
    expect(buttons[0]?.callback_data).toBe("commerce:choice:price:quote");
  });

  it("uses Asia-friendly contact examples in a clear order", () => {
    const started = startCommerceFlow("register", { domain: "newbrand.cn", source: "direct" });
    if (started.kind !== "prompt") throw new Error("expected prompt");
    const text = commercePromptText(started);

    expect(text).toContain("Telegram、微信、WhatsApp 或 Email");
    expect(text.indexOf("Telegram")).toBeLessThan(text.indexOf("微信"));
    expect(text.indexOf("微信")).toBeLessThan(text.indexOf("WhatsApp"));
    expect(text.indexOf("WhatsApp")).toBeLessThan(text.indexOf("Email"));
  });

  it("offers resume and cancel for an unfinished flow", () => {
    const started = startCommerceFlow("sell", { domain: "asset.cn", source: "direct" });
    if (started.kind !== "prompt") throw new Error("expected prompt");
    const text = commerceResumeText(started.session);
    const buttons = commerceResumeKeyboard().inline_keyboard.flat();

    expect(text).toContain("出售 asset.cn");
    expect(buttons.map((button) => button.callback_data)).toEqual(["commerce:resume", "commerce:cancel"]);
  });

  it("confirms a Lead without claiming that a deal is guaranteed", () => {
    const text = commerceCompleteText(28, {
      leadType: "sell",
      data: { source: "direct", domain: "asset.cn", contact: "@seller" },
    });

    expect(text).toContain("#28");
    expect(text).toContain("asset.cn");
    expect(text).toContain("JUYU 团队会根据你提交的资料进一步联系");
    expect(text).not.toContain("保证成交");
  });

  it("renders a safe admin notification with Telegram ID and Lead details", () => {
    const text = commerceAdminText(28, { id: 8831664659, username: "tony<mumu" }, {
      leadType: "sell",
      data: {
        domain: "asset.cn",
        source: "channel",
        report_token: "report_123",
        price: "CNY 20,000",
        contact: "微信 seller&team",
      },
    });

    expect(text).toContain("JUYU 新 Lead #28");
    expect(text).toContain("用户 ID：<code>8831664659</code>");
    expect(text).toContain("@tony&lt;mumu");
    expect(text).toContain("期望售价：CNY 20,000");
    expect(text).toContain("联系方式：微信 seller&amp;team");
    expect(text).toContain("报告编号：report_123");
  });
});
