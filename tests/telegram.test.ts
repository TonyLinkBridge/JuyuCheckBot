import { describe, expect, it } from "vitest";
import { TELEGRAM_ALLOWED_UPDATES } from "../src/telegram.js";
import { Bot } from "grammy";
import { syncBotMenu } from "../src/telegram-menu.js";

describe("Telegram update configuration", () => {
  it("subscribes the webhook to inline sharing queries", () => {
    expect(TELEGRAM_ALLOWED_UPDATES).toContain("inline_query");
    expect(TELEGRAM_ALLOWED_UPDATES).toContain("message");
    expect(TELEGRAM_ALLOWED_UPDATES).toContain("callback_query");
  });
  it("publishes commerce and escape commands without touching the production webhook", async () => {
    const bot = new Bot("123456789:abcdefghijklmnopqrstuvwxyz");
    const changes: Array<{ method: string; payload: any }> = [];
    bot.api.config.use(async (_previous, method, payload) => { changes.push({ method, payload }); return { ok: true, result: true } as never; });
    await syncBotMenu(bot.api);
    expect(changes.map((item) => item.method)).toEqual(["setMyCommands", "setMyCommands"]);
    for (const item of changes) {
      expect(item.payload.commands.map((command: { command: string }) => command.command)).toEqual(expect.arrayContaining(["menu", "buy", "sell", "contact", "cancel"]));
    }
    expect(changes[1]?.payload.scope).toEqual({ type: "all_private_chats" });
  });
});
