import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";
import type { DomainReport } from "../src/domain/types.js";
import {
  commerceLink,
  fullReportKeyboard,
  fullReportText,
  referralWelcomeKeyboard,
  referralWelcomeText,
  shareCardKeyboard,
  shareCardText,
  technicalReportText,
} from "../src/messages.js";

const report = {
  reportVersion: "JUYU-EVIDENCE-3.1",
  domain: "example.com",
  registrableDomain: "example.com",
  isSubdomain: false,
  isIdn: false,
  checkedAt: new Date("2026-08-17T00:00:00Z"),
  intelligence: {
    tranco: { status: "available", rank: 42, rankedAt: "2026-08-16", checkedAt: new Date("2026-08-17T00:00:00Z") },
    crux: {
      status: "available",
      origin: "https://example.com",
      lcpP75Ms: 1800,
      inpP75Ms: 150,
      clsP75: 0.05,
      periodStart: "2026-07-20",
      periodEnd: "2026-08-16",
      checkedAt: new Date("2026-08-17T00:00:00Z"),
    },
    ahrefs: { status: "available", domainRating: 93, checkedAt: new Date("2026-08-17T00:00:00Z") },
    wayback: {
      status: "available",
      firstCaptureAt: new Date("1996-01-01T00:00:00Z"),
      latestCaptureAt: new Date("2026-08-01T00:00:00Z"),
      firstCaptureUrl: "https://web.archive.org/web/19960101000000/https://example.com/",
      latestCaptureUrl: "https://web.archive.org/web/20260801000000/https://example.com/",
      checkedAt: new Date("2026-08-17T00:00:00Z"),
    },
  },
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
    source: { name: "实时 DNS 查询", url: null, checkedAt: new Date("2026-08-17T00:00:00Z") },
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
    source: {
      type: "rdap",
      name: "权威 RDAP · rdap.example",
      url: "https://rdap.example/domain/example.com",
      authoritative: true,
      checkedAt: new Date("2026-08-17T00:00:00Z"),
    },
  },
} as DomainReport;

describe("referral growth messages", () => {
  it("builds a share card with social proof and a private report-token deep link", () => {
    const config = loadConfig({ BOT_TOKEN: "123456789:abcdefghijklmnopqrstuvwxyz", BOT_USERNAME: "JuyuCheckBot" });
    const text = shareCardText(report);
    const keyboard = shareCardKeyboard(config, report, "token_123");
    const shareUrl = keyboard.inline_keyboard[0]?.[0]?.url;

    expect(text).toContain("可验证信号");
    expect(text).toContain("基础 7/7 项");
    expect(text).toContain("Tranco 全球排名：#42");
    expect(text).toContain("Domain Rating by Ahrefs：93 / 100");
    expect(text).toContain("不做自创评分");
    expect(text).not.toContain("JUYU Score");
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
        source: {
          type: "unavailable",
          name: "暂未取得注册资料",
          url: null,
          authoritative: false,
          checkedAt: new Date("2026-08-17T00:00:00Z"),
        },
      },
    });

    expect(text).toContain("当前资料不足以确认注册状态");
    expect(text).toContain("不能据此判断这个域名是否可注册");
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

    expect(ownerKeyboard.inline_keyboard[0]?.[0]?.callback_data).toBe("lead:owner:token_123");
    expect(buyerKeyboard.inline_keyboard[0]?.[0]?.callback_data).toBe("lead:buyer:token_123");
    expect(buyerKeyboard.inline_keyboard.flat().some((button) => button.callback_data === "technical:buyer:token_123")).toBe(true);
    expect(buyerKeyboard.inline_keyboard.flat().some((button) => button.callback_data === "refresh:token_123")).toBe(true);
  });

  it("leads with a decision, evidence and JUYU action", () => {
    const text = fullReportText(report, "research");

    expect(text).toContain("一句话结论");
    expect(text).toContain("为什么这样判断");
    expect(text).toContain("JUYU 建议");
    expect(text).toContain("第三方资料：<b>4/4 项</b>");
    expect(text).toContain("Tranco 全球排名 #42");
    expect(text).not.toContain("192.0.2.1");
    expect(text.length).toBeLessThan(4096);
  });

  it("keeps raw DNS values and source times in the secondary technical report", () => {
    const text = technicalReportText(report);

    expect(text).toContain("192.0.2.1");
    expect(text).toContain("ns1.example.com");
    expect(text).toContain("权威注册局资料");
    expect(text).toContain("取得时间");
    expect(text).toContain("Tranco 全球排名：<b>#42</b>");
    expect(text).toContain("Chrome UX Report（Google 真实用户 p75）");
    expect(text.length).toBeLessThan(4096);
  });

  it("builds a Commerce Bot deep link with the action and encoded domain", () => {
    expect(commerceLink("JuyuDomainBot", "buy", "example.com")).toBe(
      "https://t.me/JuyuDomainBot?start=buy_example-com",
    );
  });
});
