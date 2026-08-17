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
  reportVersion: "JUYU-EVIDENCE-2.0",
  domain: "example.com",
  registrableDomain: "example.com",
  isSubdomain: false,
  isIdn: false,
  checkedAt: new Date("2026-08-17T00:00:00Z"),
  dataCoverage: 100,
  ageYears: 26,
  daysToExpiry: 1200,
  evidenceItems: [
    { key: "registration", label: "注册状态", available: true },
    { key: "registrar", label: "注册商", available: true },
    { key: "created", label: "注册日期", available: true },
    { key: "expiry", label: "到期日期", available: true },
    { key: "nameservers", label: "Nameserver", available: true },
    { key: "dns", label: "DNS", available: true },
    { key: "dnssec", label: "DNSSEC", available: true },
  ],
  structure: {
    nameLength: 7,
    suffix: "com",
    hyphenCount: 0,
    digitCount: 0,
    characterType: "ascii-letters",
  },
  summary: "已确认注册资料与 DNS；本次基础检查未发现明显警报。",
  alerts: [],
  observations: ["主体长度：7 个字符", "连字符：无", "数字：无", "字符类型：英文字母", "后缀：.com"],
  dns: {
    checked: true,
    resolves: true,
    ipv4: ["192.0.2.1"],
    ipv6: [],
    nameServers: ["ns1.example.com"],
    mx: [],
  },
  rdap: {
    status: "registered",
    registrar: "Example Registrar",
    createdAt: new Date("2000-01-01T00:00:00Z"),
    expiresAt: new Date("2030-01-01T00:00:00Z"),
    updatedAt: null,
    nameServers: ["ns1.example.com"],
    statuses: ["active"],
    dnssec: false,
    source: { type: "rdap", name: "RDAP 注册资料", url: "https://rdap.org/domain/example.com" },
  },
} as DomainReport;

describe("referral growth messages", () => {
  it("builds a share card with social proof and a private report-token deep link", () => {
    const config = loadConfig({ BOT_TOKEN: "123456789:abcdefghijklmnopqrstuvwxyz", BOT_USERNAME: "JuyuCheckBot" });
    const text = shareCardText(report);
    const keyboard = shareCardKeyboard(config, report, "token_123");
    const shareUrl = keyboard.inline_keyboard[0]?.[0]?.url;

    expect(text).toContain("资料取得");
    expect(text).toContain("7/7 项");
    expect(text).toContain("RDAP 注册资料");
    expect(text).not.toContain("/ 100");
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

  it("states when registration data cannot be confirmed instead of claiming availability", () => {
    const text = shareCardText({
      ...report,
      summary: "DNS 正常，但当前资料源无法确认注册记录；不能据此判断可注册。",
      alerts: ["注册状态暂时无法从可用资料源确认"],
      rdap: {
        ...report.rdap,
        status: "unknown",
        source: { type: "unavailable", name: "暂未取得注册资料", url: null },
      },
    });

    expect(text).toContain("暂时无法确认");
    expect(text).toContain("不能据此判断可注册");
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
