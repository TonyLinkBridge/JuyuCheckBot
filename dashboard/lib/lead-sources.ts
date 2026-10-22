import { emptyLeadFollowUp, type LeadFollowUp, type RawLeadFollowUp } from "./lead-follow-up";

export type RawCommerceLeadRow = {
  id: number;
  lead_type: "buy" | "sell" | "contact";
  telegram_user_id: number;
  username?: string;
  data: Record<string, unknown> | null;
  status: string;
  created_at: string;
};

export type CommerceLeadRow = RawCommerceLeadRow & LeadFollowUp & {
  database_source: "check" | "legacy";
  stable_key: string;
};

export function normalizeCommerceLeads(
  primary: RawCommerceLeadRow[],
  legacy: RawCommerceLeadRow[],
  followUps: RawLeadFollowUp[] = [],
): CommerceLeadRow[] {
  const byLead = new Map(followUps.map((item) => [item.lead_id, item]));
  return [
    ...primary.map((lead) => {
      const followUp = byLead.get(lead.id);
      return { ...lead, ...emptyLeadFollowUp,
        ...(followUp ? { followUpStatus: followUp.status, notes: followUp.notes, isTest: followUp.is_test, revision: followUp.revision, followUpUpdatedAt: followUp.updated_at } : {}),
        database_source: "check" as const, stable_key: `check:${lead.id}` };
    }),
    ...legacy.map((lead) => ({ ...lead, ...emptyLeadFollowUp, database_source: "legacy" as const, stable_key: `legacy:${lead.id}` })),
  ];
}
