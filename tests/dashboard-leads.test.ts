import { describe, expect, it } from "vitest";
import { normalizeCommerceLeads, type RawCommerceLeadRow } from "../dashboard/lib/lead-sources.js";

describe("Dashboard Lead sources", () => {
  it("keeps new and legacy Leads distinct even when their numeric IDs match", () => {
    const primary: RawCommerceLeadRow[] = [{
      id: 2,
      lead_type: "sell",
      telegram_user_id: 7001,
      data: { domain: "new.cn", source: "direct" },
      status: "new",
      created_at: "2026-08-27T01:00:00.000Z",
    }];
    const legacy: RawCommerceLeadRow[] = [{
      id: 2,
      lead_type: "buy",
      telegram_user_id: 7002,
      data: { domain: "old.com", source: "juyu_check_bot" },
      status: "new",
      created_at: "2026-08-26T01:00:00.000Z",
    }];

    const result = normalizeCommerceLeads(primary, legacy);

    expect(result.map((lead) => lead.stable_key)).toEqual(["check:2", "legacy:2"]);
    expect(result.map((lead) => lead.database_source)).toEqual(["check", "legacy"]);
  });
});
