import "server-only";
import type { LeadUpdate } from "./lead-follow-up";

export async function saveLeadFollowUp(update: LeadUpdate): Promise<"saved" | "conflict" | "not_found" | "unavailable"> {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return "unavailable";
  try {
    const response = await fetch(`${url}/rest/v1/rpc/save_lead_followup`, {
      method: "POST", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_lead_id: update.leadId, p_expected_revision: update.revision, p_status: update.status, p_notes: update.notes, p_is_test: update.isTest }),
      cache: "no-store", signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return "unavailable";
    const rows = await response.json();
    const outcome = rows?.[0]?.outcome;
    return outcome === "saved" || outcome === "conflict" || outcome === "not_found" ? outcome : "unavailable";
  } catch { return "unavailable"; }
}
