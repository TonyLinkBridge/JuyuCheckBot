import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";
import type { DomainReport } from "../src/domain/types.js";
import {
  referralWelcomeKeyboard,
  referralWelcomeText,
  shareCardKeyboard,
  shareCardText,
} from "../src/messages.js";

const report = {
  domain: "example.com",
  score: 86,
  grade: "A",
  riskLevel: "low",
  verdict: "简短、清晰，并具备品牌延展能力。",
  strengths: ["简短易记", ".COM 品牌资产", "适合全球化品牌"],
  dimensions: {
    brandability: { score: 92 },
    memorability: { score: 90 },
    commercialPotential: { score: 88 },
  },
} as DomainReport;

describe("referral growth messages", () => {
  it("builds a share card with social proof and a private report-token deep link", () => {
    const config = loadConfig({ BOT_TOKEN: "123456789:abcdefghijklmnopqrstuvwxyz", BOT_USERNAME: "JuyuCheckBot" });
    const text = shareCardText(report);
    const keyboard = shareCardKeyboard(config, report, "token_123");
    const shareUrl = keyboard.inline_keyboard[0]?.[0]?.url;

    expect(text).toContain("86 / 100");
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
});
