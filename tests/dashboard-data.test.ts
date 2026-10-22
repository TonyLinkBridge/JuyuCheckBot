import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDashboardData } from "../dashboard/lib/dashboard-data.js";

const primaryUrl = "https://current.example.test";
const legacyUrl = "https://legacy.example.test";
const primaryLead = {
  id: 6,
  lead_type: "buy",
  telegram_user_id: 7001,
  username: "buyer_test",
  data: { domain: "example.com", contact: "buyer@example.com" },
  status: "new",
  created_at: "2026-10-22T08:24:30.000Z",
};

describe("Dashboard Supabase reads", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-22T09:00:00.000Z"));
    vi.stubEnv("SUPABASE_URL", primaryUrl);
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "current-test-key");
    vi.stubEnv("COMMERCE_SUPABASE_URL", legacyUrl);
    vi.stubEnv("COMMERCE_SUPABASE_SECRET_KEY", "legacy-test-key");
    vi.stubEnv("LEGACY_COMMERCE_ENABLED", undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function mockDatabase(options: { legacyFails?: boolean; primaryFails?: boolean } = {}) {
    return vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      if (url.origin === legacyUrl) {
        if (options.legacyFails) throw new Error("fetch failed");
        return Response.json([{ ...primaryLead, lead_type: "sell", data: { domain: "example.org", source: "juyu_check_bot" } }]);
      }
      if (url.pathname.endsWith("/leads")) {
        return options.primaryFails ? new Response("unavailable", { status: 503 }) : Response.json([primaryLead]);
      }
      return Response.json([]);
    }));
  }

  it("does not contact the old database by default, even with its saved configuration", async () => {
    mockDatabase({ legacyFails: true });
    const data = await getDashboardData("7d");

    expect(vi.mocked(fetch).mock.calls.map(([url]) => new URL(String(url)).origin))
      .toEqual([primaryUrl, primaryUrl, primaryUrl, primaryUrl]);
    expect(data.leads.commerceError).toBeNull();
    expect(data.leads.submittedLeads).toBe(1);
    expect(data.leads.records[0]).toMatchObject({ stableKey: "check:6", domain: "example.com", telegramUserId: 7001 });
    expect(process.env.COMMERCE_SUPABASE_URL).toBe(legacyUrl);
    expect(process.env.COMMERCE_SUPABASE_SECRET_KEY).toBe("legacy-test-key");
  });

  it("keeps legacy reads disabled when explicitly false", async () => {
    vi.stubEnv("LEGACY_COMMERCE_ENABLED", "false");
    mockDatabase();
    const data = await getDashboardData("7d");

    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).startsWith(legacyUrl))).toBe(false);
    expect(data.leads.submittedLeads).toBe(1);
  });

  it("can restore legacy history only by explicit opt-in", async () => {
    vi.stubEnv("LEGACY_COMMERCE_ENABLED", "true");
    mockDatabase();
    const data = await getDashboardData("7d");

    expect(data.leads.submittedLeads).toBe(2);
    expect(data.leads.records.map((lead) => lead.stableKey).sort()).toEqual(["check:6", "legacy:6"]);
    expect(data.leads.commerceError).toBeNull();
  });

  it("still surfaces a primary database failure instead of silently hiding it", async () => {
    mockDatabase({ primaryFails: true });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const data = await getDashboardData("7d");

    expect(data.leads.commerceConfigured).toBe(false);
    expect(data.leads.commerceError).toBeTruthy();
    expect(data.leads.submittedLeads).toBe(0);
  });
});
