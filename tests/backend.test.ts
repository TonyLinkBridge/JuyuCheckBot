import { afterEach, describe, expect, it, vi } from "vitest";
import { createBackend } from "../src/backend.js";
import { loadConfig } from "../src/config.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Supabase report persistence", () => {
  it("loads a report for the matching token and user and revives its dates", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            report_token: "report_token",
            telegram_user_id: 123,
            source: "channel",
            intent: "buyer",
            report: {
              domain: "example.com",
              checkedAt: "2026-08-15T00:00:00.000Z",
              rdap: {
                createdAt: "1995-08-14T04:00:00.000Z",
                expiresAt: null,
                updatedAt: null,
                source: {
                  type: "whois",
                  name: "辅助 WHOIS · whois.example.test",
                  authoritative: false,
                },
              },
            },
          },
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const backend = createBackend(
      loadConfig({
        BOT_TOKEN: "123456789:abcdefghijklmnopqrstuvwxyz",
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      }),
    );
    const stored = await backend.getReport("report_token", 123);

    expect(stored?.source).toBe("channel");
    expect(stored?.intent).toBe("buyer");
    expect(stored?.report.checkedAt).toBeInstanceOf(Date);
    expect(stored?.report.rdap.createdAt).toBeInstanceOf(Date);
    expect(stored?.report.rdap.source).toMatchObject({
      type: "whois",
      name: "辅助 WHOIS · whois.example.test",
      authoritative: false,
    });
    expect(fetchMock.mock.calls[0]?.[0]).toContain("telegram_user_id=eq.123");
  });

  it("returns null when Supabase has no matching row", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("[]", { status: 200 })));
    const backend = createBackend(
      loadConfig({
        BOT_TOKEN: "123456789:abcdefghijklmnopqrstuvwxyz",
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      }),
    );

    await expect(backend.getReport("missing", 123)).resolves.toBeNull();
  });

  it("detects whether a user already has a referral-open event", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([{ event_name: "referral_opened" }]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const backend = createBackend(
      loadConfig({
        BOT_TOKEN: "123456789:abcdefghijklmnopqrstuvwxyz",
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      }),
    );

    await expect(backend.hasReferralOpen(123, "report_token")).resolves.toBe(true);
    expect(fetchMock.mock.calls[0]?.[0]).toContain("event_name=eq.referral_opened");
    expect(fetchMock.mock.calls[0]?.[0]).toContain("report_token=eq.report_token");
  });

  it("restores the persisted attribution source for a returning user", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify([{ last_source: "referral" }]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    const backend = createBackend(
      loadConfig({
        BOT_TOKEN: "123456789:abcdefghijklmnopqrstuvwxyz",
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      }),
    );

    await expect(backend.getUserSource(123)).resolves.toBe("referral");
  });

  it("stores a readable last-source label for a returning user", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ telegram_user_id: 123 }]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const backend = createBackend(
      loadConfig({
        BOT_TOKEN: "123456789:abcdefghijklmnopqrstuvwxyz",
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      }),
    );

    await backend.identifyUser(123, "direct");

    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toMatchObject({
      last_source: "direct",
      last_source_label: "直接打开 Telegram Bot",
    });
  });

  it("stores the Telegram public profile used by the follow-up dashboard", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ telegram_user_id: 123 }]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const backend = createBackend(
      loadConfig({
        BOT_TOKEN: "123456789:abcdefghijklmnopqrstuvwxyz",
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      }),
    );

    await backend.identifyUser(123, "direct", {
      username: "tonymumu",
      firstName: "Tony",
      lastName: "Link",
    });

    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toMatchObject({
      telegram_username: "tonymumu",
      telegram_first_name: "Tony",
      telegram_last_name: "Link",
    });
  });

  it("keeps user tracking working before the source-label migration is applied", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ telegram_user_id: 123 }]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(new Response("missing column", { status: 400 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const backend = createBackend(
      loadConfig({
        BOT_TOKEN: "123456789:abcdefghijklmnopqrstuvwxyz",
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      }),
    );

    await expect(backend.identifyUser(123, "direct")).resolves.toEqual({ isNew: false });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body))).toMatchObject({ last_source: "direct" });
    expect(JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body))).not.toHaveProperty("last_source_label");
  });

  it("deduplicates recent reports by domain", async () => {
    const report = (domain: string, checkedAt: string) => ({
      domain,
      checkedAt,
      rdap: { createdAt: null, expiresAt: null, updatedAt: null },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify([
            { report_token: "new-a", telegram_user_id: 123, source: "direct", report: report("a.com", "2026-08-16T03:00:00Z") },
            { report_token: "old-a", telegram_user_id: 123, source: "direct", report: report("a.com", "2026-08-16T02:00:00Z") },
            { report_token: "new-b", telegram_user_id: 123, source: "direct", report: report("b.com", "2026-08-16T01:00:00Z") },
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    const backend = createBackend(
      loadConfig({
        BOT_TOKEN: "123456789:abcdefghijklmnopqrstuvwxyz",
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      }),
    );

    const reports = await backend.listReports(123, 5);

    expect(reports.map((item) => item.reportToken)).toEqual(["new-a", "new-b"]);
  });
});
