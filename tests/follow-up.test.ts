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
  it("clears a transient profile failure when the user successfully retries a check", () => {
    const failed = event({ event_name: "user_profile_failed", telegram_user_id: 1, created_at: "2026-08-26T12:00:00Z" });
    expect(buildFollowUpInbox([failed], now).items[0]).toMatchObject({ blocker: "用户资料保存失败，需要处理", priority: "high" });
    const result = buildFollowUpInbox([
      failed,
      event({ event_name: "user_created", telegram_user_id: 1, created_at: "2026-08-26T12:01:00Z" }),
      event({ event_name: "domain_submitted", telegram_user_id: 1, domain: "example.com", created_at: "2026-08-26T12:02:00Z" }),
      event({ event_name: "preview_shown", telegram_user_id: 1, domain: "example.com", created_at: "2026-08-26T12:03:00Z" }),
    ], now);
    expect(result.items[0]).toMatchObject({ blocker: "初检已完成", priority: "low" });
  });
  it("does not let a previous report's unlock hide a new unfinished check", () => {
    const result = buildFollowUpInbox([
      event({ event_name: "report_unlocked", telegram_user_id: 1, domain: "old.com", created_at: "2026-08-26T12:00:00Z" }),
      event({ event_name: "domain_submitted", telegram_user_id: 1, domain: "new.com", created_at: "2026-08-26T13:00:00Z" }),
    ], now);
    expect(result.items[0]).toMatchObject({ blocker: "尚未完成体检", priority: "medium" });
  });
  it("recognizes the new single-result flow as a completed check", () => {
    const result = buildFollowUpInbox([
      event({ event_name: "domain_submitted", telegram_user_id: 1, domain: "example.com", created_at: "2026-08-26T13:00:00Z" }),
      event({ event_name: "preview_shown", telegram_user_id: 1, domain: "example.com", report_token: "r1", metadata: { evidenceAvailable: 7, evidenceTotal: 7 }, created_at: "2026-08-26T13:00:01Z" }),
    ], now);
    expect(result.items[0]).toMatchObject({ blocker: "初检已完成", priority: "low" });
  });

  it("keeps notification failures urgent until the same Lead is successfully notified", () => {
    const submitted = event({ event_name: "lead_submitted", telegram_user_id: 1, metadata: { leadId: 28 }, created_at: "2026-08-26T13:00:00Z" });
    const failed = event({ event_name: "lead_notification_failed", telegram_user_id: 1, metadata: { leadId: 28 }, created_at: "2026-08-26T13:01:00Z" });
    const otherSent = event({ event_name: "lead_notification_sent", telegram_user_id: 1, metadata: { leadId: 29 }, created_at: "2026-08-26T13:02:00Z" });
    expect(buildFollowUpInbox([submitted, failed, otherSent], now).items[0]).toMatchObject({ blocker: "管理员通知失败，等待重试", priority: "high" });
    const sent = { ...otherSent, metadata: { leadId: 28 } };
    expect(buildFollowUpInbox([submitted, failed, sent], now).items[0]?.priority).toBe("low");
  });

  it("shows a blocked commerce submission rather than treating it as normal research", () => {
    const result = buildFollowUpInbox([
      event({ event_name: "lead_start_failed", telegram_user_id: 1, intent: "buyer", domain: "example.com", created_at: "2026-08-26T13:00:00Z" }),
    ], now);
    expect(result.items[0]).toMatchObject({ blocker: "商业提交失败，需要处理", priority: "high" });
  });
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

  it("marks a started but unfinished seller flow as a follow-up opportunity", () => {
    const result = buildFollowUpInbox([
      event({ event_name: "intent_selected", telegram_user_id: 7000000005, domain: "asset.cn", report_token: "report-5", intent: "owner", created_at: "2026-08-26T13:00:00.000Z" }),
      event({ event_name: "lead_started", telegram_user_id: 7000000005, domain: "asset.cn", report_token: "report-5", intent: "owner", metadata: { action: "sell", step: "price" }, created_at: "2026-08-26T13:01:00.000Z" }),
    ], now);

    expect(result.items[0]).toMatchObject({
      blocker: "出售资料尚未填完",
      blockerCode: "commercial_follow_up",
      priority: "high",
    });
  });

  it("resolves commercial follow-up after the Lead is submitted", () => {
    const result = buildFollowUpInbox([
      event({ event_name: "intent_selected", telegram_user_id: 7000000006, domain: "buyer.cn", report_token: "report-6", intent: "buyer", created_at: "2026-08-26T13:00:00.000Z" }),
      event({ event_name: "lead_started", telegram_user_id: 7000000006, domain: "buyer.cn", report_token: "report-6", intent: "buyer", metadata: { action: "buy", step: "budget" }, created_at: "2026-08-26T13:01:00.000Z" }),
      event({ event_name: "lead_submitted", telegram_user_id: 7000000006, domain: "buyer.cn", report_token: "report-6", intent: "buyer", metadata: { action: "buy", leadId: 28 }, created_at: "2026-08-26T13:05:00.000Z" }),
    ], now);

    expect(result.items[0]).toMatchObject({ blocker: "购买需求已提交", blockerCode: "resolved", priority: "low" });
    expect(result.summary.commercialIntent).toBe(0);
  });
});
