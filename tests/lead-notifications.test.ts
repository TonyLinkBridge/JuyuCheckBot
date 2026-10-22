import { afterEach, describe, expect, it, vi } from "vitest";
import { Api } from "grammy";
import { createBackend } from "../src/backend.js";
import { loadConfig } from "../src/config.js";
import { dispatchLeadNotifications } from "../src/commerce/notifications.js";
import { notificationWorkerAuthorized, notificationWorkerToken } from "../src/commerce/notification-auth.js";

afterEach(() => vi.useRealTimers());

describe("durable Lead notifications", () => {
  it("retries a failed delivery and never re-sends a successful job", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const config = loadConfig({ BOT_TOKEN: "123456789:abcdefghijklmnopqrstuvwxyz", ADMIN_CHAT_ID: "9002" });
    const backend = createBackend(config);
    const api = new Api(config.BOT_TOKEN);
    let attempts = 0;
    api.config.use(async () => {
      attempts++;
      if (attempts === 1) throw new Error("Temporary Telegram failure");
      return { ok: true, result: {} } as never;
    });
    const data = { submission_id: "test_notification_1234", source: "test", domain: "example.com", contact: "@test_user" };
    await backend.saveCommerceSession(9001, { flow: "buy", step: "contact", data });
    await backend.createLead(9001, "test_user", { leadType: "buy", data });
    expect(await dispatchLeadNotifications(backend, api, config)).toEqual({ claimed: 1, sent: 0 });
    expect(await dispatchLeadNotifications(backend, api, config)).toEqual({ claimed: 0, sent: 0 });
    vi.setSystemTime(Date.now() + 61_000);
    expect(await dispatchLeadNotifications(backend, api, config)).toEqual({ claimed: 1, sent: 1 });
    expect(await dispatchLeadNotifications(backend, api, config)).toEqual({ claimed: 0, sent: 0 });
    expect(attempts).toBe(2);
  });

  it("rejects stale worker completion after the lease is reclaimed", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const backend = createBackend(loadConfig({ BOT_TOKEN: "123456789:abcdefghijklmnopqrstuvwxyz" }));
    const data = { submission_id: "test_notification_5678", source: "test", message: "Test" };
    await backend.saveCommerceSession(9001, { flow: "contact", step: "message", data });
    await backend.createLead(9001, undefined, { leadType: "contact", data });
    const [old] = await backend.claimLeadNotifications(3);
    expect(await backend.claimLeadNotifications(3)).toHaveLength(0);
    vi.setSystemTime(Date.now() + 301_000);
    const [current] = await backend.claimLeadNotifications(3);
    expect(await backend.finishLeadNotification(old!, true)).toBe(false);
    expect(await backend.finishLeadNotification(current!, true)).toBe(true);
  });
});

describe("notification worker authentication", () => {
  it("requires a scoped token derived from the configured webhook secret", () => {
    const secret = "test-webhook-secret";
    const token = notificationWorkerToken(secret);
    expect(token).not.toBe(secret);
    expect(notificationWorkerAuthorized(`Bearer ${token}`, secret)).toBe(true);
    expect(notificationWorkerAuthorized(`Bearer ${token}`, "different-secret")).toBe(false);
    expect(notificationWorkerAuthorized(`Bearer ${secret}`, secret)).toBe(false);
    expect(notificationWorkerAuthorized(undefined, secret)).toBe(false);
    expect(notificationWorkerAuthorized("Bearer bad", undefined)).toBe(false);
    expect(notificationWorkerAuthorized("Bearer bad", secret)).toBe(false);
  });
});
