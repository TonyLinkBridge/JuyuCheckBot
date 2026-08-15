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
});
