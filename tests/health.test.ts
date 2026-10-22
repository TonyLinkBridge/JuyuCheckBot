import { describe, expect, it } from "vitest";
import { checkSystemHealth } from "../src/health.js";
import { loadConfig } from "../src/config.js";

const config = loadConfig({ BOT_TOKEN: "123456789:abcdefghijklmnopqrstuvwxyz", ADMIN_CHAT_ID: "9002",
  WEBHOOK_URL: "https://bot.example", WEBHOOK_SECRET: "safe_webhook_secret_1234" });
const readiness = { database_ok: true, commerce_ok: true, stale_notifications: 0 };
const api = {
  getMe: async () => ({ id: 1 }),
  getWebhookInfo: async () => ({ url: "https://bot.example/telegram/webhook", pending_update_count: 0 }),
  getChat: async () => ({ id: 9002 }),
};

describe("real readiness checks", () => {
  it("reports healthy only when database commerce webhook and notification checks pass", async () => {
    const result = await checkSystemHealth(config, { getReadiness: async () => readiness }, api);
    expect(result.ok).toBe(true);
    expect(result.checks).toEqual({ database: "healthy", commerce: "healthy", telegram: "healthy", webhook: "healthy", notifications: "healthy" });
    expect(JSON.stringify(result)).not.toContain("safe_webhook_secret");
  });
  it("reports a missing database as unavailable instead of green", async () => {
    const result = await checkSystemHealth(config, { getReadiness: async () => null }, api);
    expect(result.ok).toBe(false);
    expect(result.checks.database).toBe("unavailable");
    expect(result.checks.commerce).not.toBe("healthy");
  });
  it("detects a mismatched production webhook", async () => {
    const result = await checkSystemHealth(config, { getReadiness: async () => readiness }, {
      ...api, getWebhookInfo: async () => ({ url: "https://wrong.example/webhook", pending_update_count: 0 }),
    });
    expect(result.ok).toBe(false);
    expect(result.checks.webhook).toBe("degraded");
  });
  it("reports stalled notification jobs instead of silently claiming success", async () => {
    const result = await checkSystemHealth(config, { getReadiness: async () => ({ ...readiness, stale_notifications: 1 }) }, api);
    expect(result.ok).toBe(false);
    expect(result.checks.notifications).toBe("degraded");
  });
  it("does not green-light an unconfigured administrator or inaccessible Telegram API", async () => {
    const result = await checkSystemHealth({ ...config, ADMIN_CHAT_ID: undefined }, { getReadiness: async () => readiness }, {
      ...api, getMe: async () => { throw new Error("offline"); },
    });
    expect(result.ok).toBe(false);
    expect(result.checks.telegram).toBe("unavailable");
    expect(result.checks.notifications).not.toBe("healthy");
  });
});
