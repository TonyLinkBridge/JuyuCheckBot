import { afterEach, describe, expect, it, vi } from "vitest";
import type { Update } from "grammy/types";
import { createBot } from "../src/bot.js";
import { createBackend } from "../src/backend.js";
import { loadConfig } from "../src/config.js";
import { buildEvidence } from "../src/domain/evidence.js";
import { emptyIntelligence } from "../src/domain/intelligence.js";

afterEach(() => vi.useRealTimers());

function harness(options: { failReceipt?: boolean; failAdmin?: boolean } = {}) {
  const config = loadConfig({ BOT_TOKEN: "123456789:abcdefghijklmnopqrstuvwxyz", ADMIN_CHAT_ID: "9002" });
  const backend = createBackend(config);
  const identified = vi.spyOn(backend, "identifyUser");
  const leads = vi.spyOn(backend, "createLead");
  const tracked = vi.spyOn(backend, "track");
  const bot = createBot(config, backend);
  bot.botInfo = { id: 123456789, is_bot: true, first_name: "Audit", username: "AuditBot",
    can_join_groups: true, can_read_all_group_messages: false, supports_inline_queries: true };
  const sent: Array<{ chatId: unknown; text: string; keyboard?: unknown }> = [];
  const apiCalls: Array<{ method: string; payload: unknown }> = [];
  let updateId = 1;
  let messageId = 1;
  bot.api.config.use(async (_previous, method, payload) => {
    apiCalls.push({ method, payload });
    if (method === "sendMessage") {
      const message = payload as { chat_id: number | string; text: string; reply_markup?: unknown };
      sent.push({ chatId: message.chat_id, text: message.text, keyboard: message.reply_markup });
      if (options.failReceipt && message.text.includes("需求已收到")) throw new Error("receipt unavailable");
      if (options.failAdmin && String(message.chat_id) === "9002") throw new Error("admin unavailable");
      return { ok: true, result: { message_id: messageId++, date: 1, chat: { id: message.chat_id, type: "private" }, text: message.text } } as never;
    }
    return { ok: true, result: true } as never;
  });
  const from = { id: 9001, is_bot: false, first_name: "Test", username: "test_user" };
  async function text(value: string) {
    const command = value.startsWith("/");
    await bot.handleUpdate({ update_id: updateId++, message: { message_id: messageId++, date: 1,
      chat: { id: 9001, type: "private" }, from, text: value,
      ...(command ? { entities: [{ type: "bot_command", offset: 0, length: value.split(" ")[0]!.length }] } : {}) } } as Update);
  }
  async function click(data: string) {
    await bot.handleUpdate({ update_id: updateId++, callback_query: { id: `cb${updateId}`, from,
      chat_instance: "test", data, message: { message_id: 1, date: 1,
        chat: { id: 9001, type: "private" }, text: "test" } } } as Update);
  }
  return { backend, bot, identified, leads, tracked, sent, text, click, apiCalls };
}

function sharedReport() {
  const now = new Date("2026-10-22T00:00:00Z");
  const rdap = { status: "registered" as const, registrar: "Test registrar", createdAt: new Date("2000-01-01"), expiresAt: new Date("2030-01-01"), updatedAt: null,
    nameServers: ["ns1.example.com"], statuses: ["active"], dnssec: true,
    source: { type: "rdap" as const, name: "Test Registry RDAP", url: "https://registry.test/domain/example.com", authoritative: true, checkedAt: now } };
  const dns = { checked: true, resolves: true, ipv4: ["192.0.2.1"], ipv6: [], nameServers: ["ns1.example.com"], mx: [], source: { name: "DNS", url: null, checkedAt: now } };
  return { reportToken: "share_token", telegramUserId: 9001, source: "channel", intent: "owner" as const,
    report: { domain: "example.com", registrableDomain: "example.com", isSubdomain: false, isIdn: false, checkedAt: now, rdap, dns, intelligence: emptyIntelligence(now),
      ...buildEvidence({ domain: "example.com", registrableDomain: "example.com", isIdn: false, rdap, dns, now }) } };
}

describe("discoverable report sharing", () => {
  it("opens a share card from history and produces a public inline card with a tracked Bot button", async () => {
    const h = harness();
    const stored = sharedReport();
    vi.spyOn(h.backend, "getReport").mockImplementation(async (token, user) => token === "share_token" && user === 9001 ? stored : null);
    vi.spyOn(h.backend, "getReferralReport").mockImplementation(async (token) => token === "share_token" ? stored : null);
    await h.click("history:share_token");
    const keyboard = h.sent.at(-1)?.keyboard as { inline_keyboard: Array<Array<{ callback_data?: string }>> };
    expect(keyboard.inline_keyboard.flat()).toContainEqual(expect.objectContaining({ callback_data: "share:research:share_token" }));
    await h.click("share:research:share_token");
    expect(h.sent.at(-1)?.text).toContain("选择聊天");
    expect(h.sent.at(-1)?.text).toContain("点击出现的体检卡片");
    expect(h.sent.at(-1)?.keyboard).toMatchObject({ inline_keyboard: [[expect.objectContaining({ switch_inline_query: "share_share_token" })], expect.anything()] });
    expect(h.tracked).toHaveBeenCalledWith(expect.objectContaining({ eventName: "share_generated", domain: "example.com", reportToken: "share_token", source: "channel" }));
    await h.bot.handleUpdate({ update_id: 500, inline_query: { id: "inline1", from: { id: 9001, is_bot: false, first_name: "Test" }, query: "share_share_token", offset: "" } } as Update);
    const payload = h.apiCalls.find((call) => call.method === "answerInlineQuery")?.payload as { results: Array<{ input_message_content: { message_text: string }; reply_markup: unknown }> };
    expect(payload.results).toHaveLength(1);
    expect(payload.results[0]?.reply_markup).toMatchObject({ inline_keyboard: [[{ text: "🔍 免费检查我的域名", url: "https://t.me/JuyuCheckBot?start=ref_share_token" }]] });
    expect(payload.results[0]?.input_message_content.message_text).toContain("example.com");
    expect(JSON.stringify(payload.results)).not.toMatch(/9001|test_user|owner|contact|channel/);
    expect(h.leads).not.toHaveBeenCalled();
  });

  it("does not create a share card or sharing event for expired or non-owned reports", async () => {
    const h = harness();
    const getReport = vi.spyOn(h.backend, "getReport").mockResolvedValue(null);
    await h.click("share:research:another_users_token");
    expect(getReport).toHaveBeenCalledWith("another_users_token", 9001);
    expect(h.sent).toHaveLength(0);
    expect(h.tracked.mock.calls.some(([event]) => event.eventName === "share_generated")).toBe(false);
    expect(h.apiCalls).toContainEqual({ method: "answerCallbackQuery", payload: expect.objectContaining({ text: "报告不存在或已过期。", show_alert: true }) });
  });

  it("does not count the report owner as a referral but attributes a different visitor", async () => {
    const h = harness();
    vi.spyOn(h.backend, "getReferralReport").mockResolvedValue(sharedReport());
    await h.text("/start ref_share_token");
    expect(h.sent.at(-1)?.text).toContain("这是你生成的分享页面");
    expect(h.tracked.mock.calls.some(([event]) => event.eventName === "referral_opened")).toBe(false);
    await h.bot.handleUpdate({ update_id: 501, message: { message_id: 501, date: 1, chat: { id: 9003, type: "private" },
      from: { id: 9003, is_bot: false, first_name: "Friend" }, text: "/start ref_share_token", entities: [{ type: "bot_command", offset: 0, length: 6 }] } } as Update);
    expect(h.sent.at(-1)).toMatchObject({ chatId: 9003, text: expect.stringContaining("朋友分享了一份") });
    expect(h.tracked).toHaveBeenCalledWith(expect.objectContaining({ eventName: "referral_opened", telegramUserId: 9003, source: "referral", reportToken: "share_token", metadata: { isNew: true } }));
    expect(h.tracked.mock.calls.some(([event]) => event.eventName === "domain_submitted")).toBe(false);
  });

  it("returns no public card when the inline report has expired", async () => {
    const h = harness();
    await h.bot.handleUpdate({ update_id: 502, inline_query: { id: "expired", from: { id: 9001, is_bot: false, first_name: "Test" }, query: "share_expired_token", offset: "" } } as Update);
    expect(h.apiCalls).toContainEqual({ method: "answerInlineQuery", payload: expect.objectContaining({ results: [], is_personal: true, cache_time: 0 }) });
  });
});

describe("core user and commerce journeys", () => {
  it("opens the main menu with /menu and cancels a pending sale with /cancel", async () => {
    const h = harness();
    await h.text("/sell example.org");
    await h.text("/menu");
    expect(h.sent.at(-1)?.keyboard).toMatchObject({ inline_keyboard: expect.arrayContaining([
      expect.arrayContaining([expect.objectContaining({ callback_data: "start_check" })]),
    ]) });
    await h.text("/cancel");
    expect(await h.backend.getCommerceSession(9001)).toBeNull();
    expect(h.leads).not.toHaveBeenCalled();
  });
  it("ignores a completed update before it can change a newer form's price", async () => {
    const h = harness();
    await h.text("/register example.com");
    const update = { update_id: 900, message: { message_id: 900, date: 1,
      chat: { id: 9001, type: "private" }, from: { id: 9001, is_bot: false, first_name: "Test", username: "test_user" },
      text: "@test_user" } } as Update;
    await h.bot.handleUpdate(update);
    await h.text("/sell another.com");
    const other = createBot(loadConfig({ BOT_TOKEN: "123456789:abcdefghijklmnopqrstuvwxyz" }), h.backend);
    other.botInfo = h.bot.botInfo;
    const replies: unknown[] = [];
    other.api.config.use(async (_p, method, payload) => { replies.push(payload); return { ok: true, result: true } as never; });
    await other.handleUpdate(update);
    expect(await h.backend.getCommerceSession(9001)).toMatchObject({ step: "price", data: { domain: "another.com" } });
    expect(replies).toHaveLength(0);
  });
  it("does not let an old completion update submit a newer form on another instance", async () => {
    const h = harness();
    await h.text("/buy example.com");
    await h.click("commerce:choice:budget:unsure");
    const update = { update_id: 900, message: { message_id: 900, date: 1,
      chat: { id: 9001, type: "private" }, from: { id: 9001, is_bot: false, first_name: "Test", username: "test_user" },
      text: "@test_user" } } as Update;
    await h.bot.handleUpdate(update);
    await h.text("/buy another.com");
    await h.click("commerce:choice:budget:unsure");
    const other = createBot(loadConfig({ BOT_TOKEN: "123456789:abcdefghijklmnopqrstuvwxyz", ADMIN_CHAT_ID: "9002" }), h.backend);
    other.botInfo = h.bot.botInfo;
    other.api.config.use(async (_p, method) => ({ ok: true, result: method === "sendMessage"
      ? { message_id: 1, date: 1, chat: { id: 9001, type: "private" }, text: "test" } : true }) as never);
    await other.handleUpdate(update);
    const results = await Promise.all(h.leads.mock.results.map((result) => result.value));
    expect(new Set(results.map((result) => result?.id)).size).toBe(1);
    expect((await h.backend.getCommerceSession(9001))?.data.domain).toBe("another.com");
  });
  it("creates one Lead when two service instances receive the same submission", async () => {
    const h = harness();
    await h.text("/buy example.com");
    await h.click("commerce:choice:budget:unsure");
    const config = loadConfig({ BOT_TOKEN: "123456789:abcdefghijklmnopqrstuvwxyz", ADMIN_CHAT_ID: "9002" });
    const other = createBot(config, h.backend);
    other.botInfo = h.bot.botInfo;
    other.api.config.use(async (_previous, method, payload) => {
      if (method === "sendMessage") {
        const message = payload as { chat_id: number | string; text: string };
        h.sent.push({ chatId: message.chat_id, text: message.text });
      }
      return { ok: true, result: method === "sendMessage"
        ? { message_id: 1, date: 1, chat: { id: 9001, type: "private" }, text: "test" } : true } as never;
    });
    const update = { update_id: 900, message: { message_id: 900, date: 1,
      chat: { id: 9001, type: "private" }, from: { id: 9001, is_bot: false, first_name: "Test", username: "test_user" },
      text: "@test_user" } } as Update;
    await Promise.all([h.bot.handleUpdate(update), other.handleUpdate(update)]);
    const results = await Promise.all(h.leads.mock.results.map((result) => result.value));
    expect(new Set(results.map((result) => typeof result === "number" ? result : result?.id)).size).toBe(1);
    expect(h.sent.filter((message) => String(message.chatId) === "9002")).toHaveLength(1);
  });
  it("stops before saving a form if the profile cannot be persisted", async () => {
    const h = harness();
    h.identified.mockRejectedValueOnce(new Error("Database unavailable"));
    await h.text("/buy example.com");
    expect(await h.backend.getCommerceSession(9001)).toBeNull();
    expect(h.sent.at(-1)?.text).toContain("无法保存你的用户资料");
    expect(h.tracked).toHaveBeenCalledWith(expect.objectContaining({ eventName: "user_profile_failed" }));
  });

  it("lets a customer finish using their existing Telegram account", async () => {
    const h = harness();
    await h.text("/buy example.com");
    await h.click("commerce:choice:budget:unsure");
    await h.click("commerce:use_telegram");
    expect(h.leads).toHaveBeenCalledWith(9001, "test_user", expect.objectContaining({
      data: expect.objectContaining({ contact: "Telegram @test_user", domain: "example.com" }),
    }));
    expect(await h.backend.getCommerceSession(9001)).toBeNull();
  });
  it("creates and refreshes a profile without requiring /start", async () => {
    const h = harness();
    await h.text("/buy example.com");
    expect(h.identified).toHaveBeenCalledWith(9001, "direct", expect.objectContaining({ username: "test_user" }));
    await h.click("commerce:choice:budget:unsure");
    expect(h.identified).toHaveBeenCalledTimes(2);
    expect(h.tracked).toHaveBeenCalledWith(expect.objectContaining({ eventName: "user_created" }));
  });

  it("offers a query switch instead of submitting a domain as contact details", async () => {
    const h = harness();
    await h.text("/buy example.com");
    await h.click("commerce:choice:budget:unsure");
    await h.text("another-domain.com");
    expect(h.leads).not.toHaveBeenCalled();
    expect(h.sent.at(-1)?.text).toContain("切换");
    expect(h.sent.at(-1)?.keyboard).toMatchObject({ inline_keyboard: expect.arrayContaining([
      expect.arrayContaining([expect.objectContaining({ callback_data: "commerce:switch_check" })]),
    ]) });
  });

  it("notifies the admin even when the user's success receipt cannot be delivered", async () => {
    const h = harness({ failReceipt: true });
    await h.text("/buy example.com");
    await h.click("commerce:choice:budget:unsure");
    await h.text("@test_user");
    expect(h.leads).toHaveBeenCalledTimes(1);
    expect(h.sent.some((message) => String(message.chatId) === "9002")).toBe(true);
  });

  it("keeps an admin failure pending for a later retry", async () => {
    const h = harness({ failAdmin: true });
    await h.text("/sell example.com");
    await h.text("CNY 2000");
    await h.text("@test_user");
    expect(h.tracked).toHaveBeenCalledWith(expect.objectContaining({ eventName: "lead_notification_failed" }));
    const pending = await h.backend.claimLeadNotifications(3, undefined, new Date(Date.now() + 61_000));
    expect(pending).toHaveLength(1);
  });

  it("expires yesterday's form instead of consuming new messages as contact details", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const h = harness();
    await h.text("/buy example.com");
    await h.click("commerce:choice:budget:unsure");
    vi.setSystemTime(Date.now() + 25 * 60 * 60 * 1000);
    await h.text("/start");
    expect(h.sent.at(-1)?.text).toContain("输入一个域名");
    expect(await h.backend.getCommerceSession(9001)).toBeNull();
    expect(h.tracked).toHaveBeenCalledWith(expect.objectContaining({ eventName: "lead_cancelled", metadata: expect.objectContaining({ reason: "expired" }) }));
  });
});
