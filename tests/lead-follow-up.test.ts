import { afterEach, describe, expect, it, vi } from "vitest";
import { parseLeadUpdate } from "../dashboard/lib/lead-follow-up.js";
import { saveLeadFollowUp } from "../dashboard/lib/lead-follow-up-store.js";

function form() {
  const value = new FormData();
  value.set("leadId", "14"); value.set("revision", "0"); value.set("status", "contacted"); value.set("notes", "已联系，等待回复");
  return value;
}
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("Lead follow-up updates", () => {
  it("rejects ambiguous duplicate fields and invalid identifiers or statuses", () => {
    const duplicate = form(); duplicate.append("leadId", "15");
    expect(parseLeadUpdate(duplicate)).toBeNull();
    for (const [key, value] of [["leadId", "-1"], ["revision", "-1"], ["status", "__proto__"], ["notes", "a".repeat(2001)]]) {
      const invalid = form(); invalid.set(key, value);
      expect(parseLeadUpdate(invalid)).toBeNull();
    }
  });
  it("normalizes a valid manual classification without changing the original business data", () => {
    const value = form(); value.set("isTest", "on");
    expect(parseLeadUpdate(value)).toEqual({ leadId: 14, revision: 0, status: "contacted", notes: "已联系，等待回复", isTest: true });
  });
  it("uses an atomic revision-checked operation for the primary database only", async () => {
    vi.stubEnv("SUPABASE_URL", "https://primary.test"); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-key");
    const requests: Array<{ url: string; body: unknown }> = [];
    vi.stubGlobal("fetch", vi.fn(async (url, init) => {
      requests.push({ url: String(url), body: JSON.parse(init.body) });
      return Response.json([{ outcome: "saved" }]);
    }));
    expect(await saveLeadFollowUp(parseLeadUpdate(form())!)).toBe("saved");
    expect(requests).toEqual([{ url: "https://primary.test/rest/v1/rpc/save_lead_followup", body: {
      p_lead_id: 14, p_expected_revision: 0, p_status: "contacted", p_notes: "已联系，等待回复", p_is_test: false,
    } }]);
  });
  it.each(["conflict", "not_found"] as const)("does not report success after %s", async (outcome) => {
    vi.stubEnv("SUPABASE_URL", "https://primary.test"); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(async () => Response.json([{ outcome }])));
    expect(await saveLeadFollowUp(parseLeadUpdate(form())!)).toBe(outcome);
  });
  it("fails closed on a network or malformed response", async () => {
    vi.stubEnv("SUPABASE_URL", "https://primary.test"); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(async () => Response.json([{ unexpected: true }])));
    expect(await saveLeadFollowUp(parseLeadUpdate(form())!)).toBe("unavailable");
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network unavailable"); }));
    expect(await saveLeadFollowUp(parseLeadUpdate(form())!)).toBe("unavailable");
  });
});
