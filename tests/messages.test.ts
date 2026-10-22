import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";
import type { DomainReport } from "../src/domain/types.js";
import {
  fullReportKeyboard,
  fullReportText,
  resultKeyboard,
  juchaDomainLink,
  juchaHandoffLink,
  juchaAccessKeyboard,
  juchaAccessText,
  previewReportText,
  referralWelcomeKeyboard,
  referralWelcomeText,
  shareCardKeyboard,
  shareCardText,
  inlineShareResult,
  inlineShareToken,
  technicalReportText,
  welcomeKeyboard,
  welcomeText,
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
  it("builds a share card that opens Telegram inline sharing without exposing user IDs", () => {
    const config = loadConfig({ BOT_TOKEN: "123456789:abcdefghijklmnopqrstuvwxyz", BOT_USERNAME: "JuyuCheckBot" });
    const text = shareCardText(report);
    const keyboard = shareCardKeyboard("token_123");
    const shareButton = keyboard.inline_keyboard[0]?.[0];

    expect(text).toContain("已确认资料");
    expect(text).toContain("基础 7/7 项");
    expect(text).not.toContain("Tranco");
    expect(text).not.toContain("CrUX");
    expect(text).not.toContain("Ahrefs");
    expect(text).not.toContain("Internet Archive");
    expect(text).not.toContain("Domain Rating by Ahrefs：93 / 100");
    expect(text).toContain("不做自创评分");
    expect(text).not.toContain("JUYU Score");
    expect(shareButton?.text).toBe("📤 分享带按钮的体检");
    expect(shareButton?.switch_inline_query).toBe("share_token_123");
    expect(JSON.stringify(shareButton)).not.toContain("telegram_user_id");
  });

  it("builds an inline share result with a direct button back to the bot", () => {
    const config = loadConfig({ BOT_TOKEN: "123456789:abcdefghijklmnopqrstuvwxyz", BOT_USERNAME: "JuyuCheckBot" });
    const result = inlineShareResult(config, report, "token_123");

    expect(result.type).toBe("article");
    expect(result.title).toBe("分享 example.com 的 JUYU 体检");
    expect(result.input_message_content).toMatchObject({
      message_text: shareCardText(report),
      parse_mode: "HTML",
    });
    expect(result.reply_markup?.inline_keyboard[0]?.[0]?.text).toBe("🔍 免费检查我的域名");
    expect(result.reply_markup?.inline_keyboard[0]?.[0]?.url).toBe(
      "https://t.me/JuyuCheckBot?start=ref_token_123",
    );
    expect(JSON.stringify(result)).not.toContain("telegram_user_id");
  });

  it("accepts only a private report-token inline share query", () => {
    expect(inlineShareToken("share_token_123")).toBe("token_123");
    expect(inlineShareToken("share_token 123")).toBeNull();
    expect(inlineShareToken("example.com")).toBeNull();
    expect(inlineShareToken("share_")).toBeNull();
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
  });

  it("routes commercial intent to Commerce Bot and complete research to Jucha", () => {
    const ownerKeyboard = fullReportKeyboard(config, report, "owner", "token_123");
    const buyerKeyboard = fullReportKeyboard(config, report, "buyer", "token_123");
    const researchKeyboard = fullReportKeyboard(config, report, "research", "token_123");

    expect(ownerKeyboard.inline_keyboard[0]?.[0]?.url).toContain("www.jucha.com/zonghe/example.com");
    expect(buyerKeyboard.inline_keyboard[0]?.[0]?.url).toContain("www.jucha.com/zonghe/example.com");
    expect(ownerKeyboard.inline_keyboard.flat().some((button) => button.callback_data === "lead:owner:token_123")).toBe(true);
    expect(buyerKeyboard.inline_keyboard.flat().some((button) => button.callback_data === "lead:buyer:token_123")).toBe(true);
    expect(buyerKeyboard.inline_keyboard.flat().some((button) => button.url?.startsWith("https://www.jucha.com/zonghe/example.com"))).toBe(true);
    expect(researchKeyboard.inline_keyboard[0]?.[0]?.url).toContain("www.jucha.com/zonghe/example.com");
    expect(buyerKeyboard.inline_keyboard.flat().some((button) => button.callback_data === "refresh:token_123")).toBe(true);
  });

  it("gives a Chinese-first registration preview before the subscription gate", () => {
    const text = previewReportText(report);

    expect(text).toContain("快速结论");
    expect(text).toContain("资料来源");
    expect(text).toContain("取得时间");
    expect(text).not.toContain("JUYU DOMAIN CHECK");
    expect(text).not.toContain("Tranco");
    expect(text).not.toContain("Ahrefs");
    expect(text).not.toContain("CrUX");
    expect(text).toContain("域名年龄");
    expect(text).not.toContain("选择你的目的后");
    expect(text).toContain("购买前仍需继续核对历史、商标和市场资料");
  });

  it("explains each preview reminder instead of showing only a count", () => {
    const text = previewReportText({ ...report, alerts: ["距离到期不足 30 天"] });
    expect(text).toContain("距离到期不足 30 天");
    expect(text).toContain("联系注册商确认续费");
    expect(text).toContain("DNSSEC 未启用");
    expect(text).toContain("不代表网站一定不安全");
  });

  it("separates missing information from confirmed technical warnings", () => {
    const text = previewReportText({ ...report, rdap: { ...report.rdap, status: "unknown", dnssec: null, expiresAt: null }, dns: { ...report.dns, checked: false, resolves: false }, alerts: ["注册状态暂时无法从可用资料源确认"] });
    expect(text).toContain("资料缺失");
    expect(text).toContain("不能判断是否可注册");
    expect(text).toContain("查询未完成");
    expect(text).not.toContain("未发现明确警报");
  });

  it("keeps the existing next actions and makes sharing discoverable on the result", () => {
    const keyboard = resultKeyboard(config, report, "token_123").inline_keyboard;
    const buttons = keyboard.flat();

    expect(buttons.map((button) => button.text)).toEqual([
      "🔓 解锁聚查完整资料",
      "🤝 我要购买这个域名",
      "💰 我要出售这个域名",
      "📤 分享这份体检",
    ]);
    expect(buttons[0]?.callback_data).toBe("intent:research:token_123");
    expect(buttons[1]?.callback_data).toBe("lead:buyer:token_123");
    expect(buttons[2]?.callback_data).toBe("lead:owner:token_123");
    expect(buttons.some((button) => button.callback_data?.startsWith("refresh:"))).toBe(false);
    expect(buttons[3]?.callback_data).toBe("share:research:token_123");
  });

  it.each(["available", "unknown"] as const)("also allows sharing a %s registration result", (status) => {
    const buttons = resultKeyboard(config, { ...report, rdap: { ...report.rdap, status } }, "token_123").inline_keyboard.flat();
    expect(buttons.at(-1)).toMatchObject({ text: "📤 分享这份体检", callback_data: "share:research:token_123" });
    expect(buttons.some((button) => button.callback_data === "lead:buyer:token_123")).toBe(true);
  });

  it("leads with a decision, evidence and JUYU action", () => {
    const text = fullReportText(report, "research");

    expect(text).toContain("一句话结论");
    expect(text).toContain("本次已确认");
    expect(text).toContain("聚查可继续查询");
    expect(text).toContain("ICP 备案");
    expect(text).toContain("中国商标");
    expect(text).toContain("国内平台风险");
    expect(text).toContain("JUYU 建议");
    expect(text).toContain("历史 WHOIS");
    expect(text).not.toContain("完整资料已找到");
    expect(text).not.toContain("Tranco");
    expect(text).not.toContain("CrUX");
    expect(text).not.toContain("Ahrefs");
    expect(text).not.toContain("Internet Archive");
    expect(text).not.toContain("192.0.2.1");
    expect(text.length).toBeLessThan(4096);
  });

  it("keeps raw DNS values and source times in the secondary technical report", () => {
    const text = technicalReportText(report);

    expect(text).toContain("192.0.2.1");
    expect(text).toContain("ns1.example.com");
    expect(text).toContain("权威注册局资料");
    expect(text).toContain("取得时间");
    expect(text).not.toContain("Tranco");
    expect(text).not.toContain("Chrome UX Report");
    expect(text).not.toContain("Ahrefs");
    expect(text).not.toContain("Internet Archive");
    expect(text.length).toBeLessThan(4096);
  });

  it("keeps checking and commercial actions inside one main Bot", () => {
    const keyboard = welcomeKeyboard(config).inline_keyboard;
    const buttons = keyboard.flat();

    expect(welcomeText).toContain("输入一个域名，快速查看");
    expect(welcomeText).toContain("深度资料可前往聚查继续查看");
    expect(welcomeText).not.toContain("完整历史、风险、备案与网站数据会引导到聚查");
    expect(welcomeText).not.toContain("进入 JUYU 聚域助手");
    expect(keyboard[0]?.[0]?.callback_data).toBe("start_check");
    expect(keyboard[1]?.[0]?.callback_data).toBe("commerce_menu");
    expect(keyboard[2]?.[0]?.callback_data).toBe("more_menu");
    expect(buttons).toHaveLength(3);
  });

  it("builds a tracked Jucha handoff without exposing a Telegram user ID", () => {
    const trackedConfig = loadConfig({
      BOT_TOKEN: "123456789:abcdefghijklmnopqrstuvwxyz",
      WEBHOOK_URL: "https://juyu-check-bot.vercel.app",
      WEBHOOK_SECRET: "valid_webhook_secret",
    });
    const handoff = juchaHandoffLink(trackedConfig, "example.com", "research", "token_123");
    const destination = juchaDomainLink("https://www.jucha.com/juhe/", "example.com", "research");

    expect(handoff).toBe("https://juyu-check-bot.vercel.app/go/jucha?report=token_123&intent=research");
    expect(handoff).not.toContain("telegram_user_id");
    expect(destination).toContain("https://www.jucha.com/zonghe/example.com");
    expect(destination).not.toContain("domain=example.com");
    expect(destination).toContain("utm_campaign=juyu_domain_check");
  });

  it("continues the current domain directly in Jucha without a required copy step", () => {
    const keyboard = juchaAccessKeyboard(config, report, "token_123").inline_keyboard;

    expect(keyboard[0]?.[0]).toMatchObject({
      text: "🔎 去聚查继续查询",
    });
    expect(keyboard[0]?.[0]?.url).toContain("www.jucha.com/zonghe/example.com");
    expect(keyboard.flat().some((button) => "copy_text" in button)).toBe(false);
    expect(keyboard[1]?.[0]).toMatchObject({ callback_data: "check_another" });
  });

  it("explains automatic domain carry-over without promising free Jucha results", () => {
    const text = juchaAccessText(report);

    expect(text).toContain("自动带入");
    expect(text).toContain("example.com");
    expect(text).toContain("登录或安全验证");
    expect(text).toContain("收费以聚查页面为准");
    expect(text).not.toMatch(/复制|粘贴|不会自动|已解锁完整资料/);
  });

  it("keeps source tracking on the primary Jucha continuation button", () => {
    const trackedConfig = loadConfig({
      BOT_TOKEN: "123456789:abcdefghijklmnopqrstuvwxyz",
      WEBHOOK_URL: "https://juyu-check-bot.vercel.app",
      WEBHOOK_SECRET: "valid_webhook_secret",
    });
    const keyboard = juchaAccessKeyboard(trackedConfig, report, "token_123").inline_keyboard;

    expect(keyboard[0]?.[0]?.url).toBe(
      "https://juyu-check-bot.vercel.app/go/jucha?report=token_123&intent=research",
    );
    const destination = new URL(juchaDomainLink(trackedConfig.JUCHA_URL, "taopaishop.com"));
    expect(destination.pathname).toBe("/zonghe/taopaishop.com");
    expect(destination.searchParams.get("utm_source")).toBe("telegram");
    expect(destination.searchParams.get("utm_campaign")).toBe("juyu_domain_check");
  });
});
