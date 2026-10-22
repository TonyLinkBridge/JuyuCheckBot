import { describe, expect, it } from "vitest";
import { assertLocalPollingSafe, runSafeLocalPolling } from "../src/local-runtime.js";
import { Bot } from "grammy";

describe("local startup safety", () => {
  it("refuses local polling unless deliberately enabled", () => {
    expect(() => assertLocalPollingSafe({}, "")).toThrow(/LOCAL_POLLING/);
  });
  it("refuses to take over an existing webhook even when polling is enabled", () => {
    expect(() => assertLocalPollingSafe({ LOCAL_POLLING: "true" }, "https://production.example/telegram/webhook"))
      .toThrow(/Webhook/);
  });
  it("allows an explicitly enabled test Bot with no webhook", () => {
    expect(() => assertLocalPollingSafe({ LOCAL_POLLING: "true" }, "")).not.toThrow();
  });
  it("never deletes a webhook or changes commands on the explicitly enabled path", async () => {
    const bot = new Bot("123456789:abcdefghijklmnopqrstuvwxyz");
    const methods: string[] = [];
    const stop = new AbortController();
    bot.api.config.use(async (_previous, method) => {
      methods.push(method);
      if (method === "getWebhookInfo") return { ok: true, result: { url: "", pending_update_count: 0 } } as never;
      if (method === "getMe") return { ok: true, result: { id: 123456789, is_bot: true, first_name: "Test", username: "TestBot" } } as never;
      if (method === "getUpdates") { stop.abort(); return { ok: true, result: [] }; }
      throw new Error(`Unexpected Telegram mutation: ${method}`);
    });
    await runSafeLocalPolling(bot, { LOCAL_POLLING: "true" }, stop.signal);
    expect(methods).toEqual(["getWebhookInfo", "getMe", "getUpdates"]);
  });
});
