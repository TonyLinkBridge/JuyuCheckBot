import { describe, expect, it } from "vitest";
import { buildFollowUpInbox, type FollowUpEvent } from "../dashboard/lib/follow-up.js";

const now = new Date("2026-08-26T14:00:00.000Z");

function event(overrides: Partial<FollowUpEvent> & Pick<FollowUpEvent, "event_name" | "telegram_user_id" | "created_at">): FollowUpEvent {
  return {
    source: "direct",
    domain: null,
    report_token: null,
    intent: null,
    metadata: {},
    ...overrides,
  };
}

describe("buildFollowUpInbox", () => {
  it("groups a user's events into one actionable timeline with visible Telegram ID", () => {
    const result = buildFollowUpInbox([
      event({ event_name: "bot_started", telegram_user_id: 7083425177, created_at: "2026-08-26T13:35:30.000Z" }),
      event({ event_name: "domain_submitted", telegram_user_id: 7083425177, domain: "rnhaley.eu.cc", created_at: "2026-08-26T13:36:29.000Z" }),
      event({ event_name: "intent_selected", telegram_user_id: 7083425177, domain: "rnhaley.eu.cc", report_token: "report-1", intent: "buyer", created_at: "2026-08-26T13:37:36.000Z" }),
      event({ event_name: "gate_shown", telegram_user_id: 7083425177, domain: "rnhaley.eu.cc", report_token: "report-1", intent: "buyer", created_at: "2026-08-26T13:37:37.000Z" }),
      event({ event_name: "unlock_failed", telegram_user_id: 7083425177, domain: "rnhaley.eu.cc", report_token: "report-1", intent: "buyer", created_at: "2026-08-26T13:37:47.000Z" }),
    ], now);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      telegramUserId: 7083425177,
      domain: "rnhaley.eu.cc",
      intent: "buyer",
      blocker: "解锁失败",
      priority: "high",
      source: "direct",
    });
    expect(result.items[0]?.timeline.map((item) => item.event)).toEqual([
      "bot_started",
      "domain_submitted",
      "intent_selected",
      "gate_shown",
      "unlock_failed",
    ]);
  });

  it("marks an unavailable verification as the blocker and preserves its metadata", () => {
    const result = buildFollowUpInbox([
      event({ event_name: "domain_submitted", telegram_user_id: 8986760622, domain: "sys.jamt.or.jp", created_at: "2026-08-26T12:55:54.000Z" }),
      event({
        event_name: "preview_shown",
        telegram_user_id: 8986760622,
        domain: "sys.jamt.or.jp",
        report_token: "report-2",
        created_at: "2026-08-26T12:56:05.000Z",
        metadata: { durationMs: 10239, evidenceAvailable: 2, evidenceTotal: 7 },
      }),
      event({ event_name: "verification_unavailable", telegram_user_id: 8986760622, domain: "sys.jamt.or.jp", report_token: "report-2", intent: "research", created_at: "2026-08-26T12:56:14.000Z" }),
    ], now);

    expect(result.items[0]).toMatchObject({
      telegramUserId: 8986760622,
      blocker: "验证不可用",
      priority: "high",
      evidenceAvailable: 2,
      evidenceTotal: 7,
      durationMs: 10239,
    });
  });

  it("does not keep an old unlock failure as the blocker after the same report unlocks", () => {
    const result = buildFollowUpInbox([
      event({ event_name: "unlock_failed", telegram_user_id: 7000000001, domain: "example.com", report_token: "report-3", created_at: "2026-08-26T10:00:00.000Z" }),
      event({ event_name: "report_unlocked", telegram_user_id: 7000000001, domain: "example.com", report_token: "report-3", created_at: "2026-08-26T10:01:00.000Z" }),
    ], now);

    expect(result.items[0]).toMatchObject({ blocker: "已完成解锁", priority: "low" });
    expect(result.summary.unlockFailed).toBe(0);
  });

  it("sorts unresolved commercial intent ahead of ordinary research activity", () => {
    const result = buildFollowUpInbox([
      event({ event_name: "domain_submitted", telegram_user_id: 7000000002, domain: "research.dev", intent: "research", created_at: "2026-08-26T13:58:00.000Z" }),
      event({ event_name: "intent_selected", telegram_user_id: 7000000003, domain: "buyer.com", intent: "buyer", created_at: "2026-08-26T13:00:00.000Z" }),
    ], now);

    expect(result.items.map((item) => item.telegramUserId)).toEqual([7000000003, 7000000002]);
    expect(result.summary.commercialIntent).toBe(1);
  });

  it("joins the saved Telegram profile to the matching follow-up user", () => {
    const result = buildFollowUpInbox([
      event({ event_name: "bot_started", telegram_user_id: 7000000004, created_at: "2026-08-26T13:00:00.000Z" }),
    ], now, [{
      telegram_user_id: 7000000004,
      telegram_username: "juyu_user",
      telegram_first_name: "JUYU",
      telegram_last_name: "User",
    }]);

    expect(result.items[0]).toMatchObject({
      username: "juyu_user",
      displayName: "JUYU User",
    });
  });
});
