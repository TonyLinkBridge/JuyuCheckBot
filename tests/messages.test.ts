import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";
import type { DomainReport } from "../src/domain/types.js";
import {
  commerceLink,
  fullReportKeyboard,
  referralWelcomeKeyboard,
  referralWelcomeText,
  shareCardKeyboard,
  shareCardText,
} from "../src/messages.js";

const report = {
  domain: "example.com",
  score: 86,
  grade: "A",
  scoreVersion: "JUYU-1.3",
  evidenceGrade: "B",
  marketEvidence: "limited",
  provisional: false,
  confidence: "medium",
  dataCoverage: 90,
  riskLevel: "low",
  verdict: "简短、清晰，并具备品牌延展能力。",
  strengths: ["简短易记", ".COM 品牌资产", "适合全球化品牌"],
  dimensions: {
    brandability: { score: 92 },
    memorability: { score: 90 },
    commercialPotential: { score: 88 },
  },
  rdap: { status: "registered" },
} as DomainReport;

describe("referral growth messages", () => {
  it("builds a share card with social proof and a private report-token deep link", () => {
    const config = loadConfig({ BOT_TOKEN: "123456789:abcdefghijklmnopqrstuvwxyz", BOT_USERNAME: "JuyuCheckBot" });
    const text = shareCardText(report);
    const keyboard = shareCardKeyboard(config, report, "token_123");
    const shareUrl = keyboard.inline_keyboard[0]?.[0]?.url;

    expect(text).toContain("86 / 100");
    expect(text).toContain("JUYU Structure Score");
    expect(text).toContain("证据等级　B");
    expect(text).toContain("✓ 简短易记");
    expect(shareUrl).toContain("t.me%2FJuyuCheckBot%3Fstart%3Dref_token_123");
    expect(shareUrl).not.toContain("telegram_user_id");
  });

  it("welcomes referred visitors without automatically checking the shared domain", () => {
    const text = referralWelcomeText(report);
    const keyboard = referralWelcomeKeyboard();

    expect(text).toContain("朋友分享了一份 JUYU 域名体检");
    expect(text).toContain("现在体检你的域名");
    expect(keyboard.inline_keyboard[0]?.[0]?.callback_data).toBe("start_check");
  });

  it("labels low-evidence results as provisional instead of presenting false precision", () => {
    const text = shareCardText({ ...report, evidenceGrade: "D", provisional: true, dataCoverage: 25 });

    expect(text).toContain("暂定结构分");
    expect(text).toContain("证据等级　D");
  });
});

describe("commerce lead messages", () => {
  const config = loadConfig({
    BOT_TOKEN: "123456789:abcdefghijklmnopqrstuvwxyz",
    BOT_USERNAME: "JuyuCheckBot",
    COMMERCE_BOT_USERNAME: "JuyuDomainBot",
  });

  it("uses tracked callback buttons before handing owners and buyers to Commerce Bot", () => {
    const ownerKeyboard = fullReportKeyboard(config, report, "owner", "token_123");
    const buyerKeyboard = fullReportKeyboard(config, report, "buyer", "token_123");

    expect(ownerKeyboard.inline_keyboard[1]?.[0]?.callback_data).toBe("lead:owner:token_123");
    expect(buyerKeyboard.inline_keyboard[1]?.[0]?.callback_data).toBe("lead:buyer:token_123");
  });

  it("builds a Commerce Bot deep link with the action and encoded domain", () => {
    expect(commerceLink("JuyuDomainBot", "buy", "example.com")).toBe(
      "https://t.me/JuyuDomainBot?start=buy_example-com",
    );
  });
});
