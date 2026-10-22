import { afterEach, describe, expect, it, vi } from "vitest";
import type { Update } from "grammy/types";
import { createBot } from "../src/bot.js";
import { createBackend } from "../src/backend.js";
import { loadConfig } from "../src/config.js";

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
  let updateId = 1;
  let messageId = 1;
  bot.api.config.use(async (_previous, method, payload) => {
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
  return { backend, bot, identified, leads, tracked, sent, text, click };
}

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
