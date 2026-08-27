export type RawCommerceLeadRow = {
  id: number;
  lead_type: "buy" | "sell" | "contact";
  telegram_user_id: number;
  username?: string;
  data: Record<string, unknown> | null;
  status: string;
  created_at: string;
};

export type CommerceLeadRow = RawCommerceLeadRow & {
  database_source: "check" | "legacy";
  stable_key: string;
};

export function normalizeCommerceLeads(
  primary: RawCommerceLeadRow[],
  legacy: RawCommerceLeadRow[],
): CommerceLeadRow[] {
  return [
    ...primary.map((lead) => ({ ...lead, database_source: "check" as const, stable_key: `check:${lead.id}` })),
    ...legacy.map((lead) => ({ ...lead, database_source: "legacy" as const, stable_key: `legacy:${lead.id}` })),
  ];
}
