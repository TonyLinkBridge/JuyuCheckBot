export const leadStatuses = {
  new: "待联系",
  contacted: "已联系",
  following: "跟进中",
  completed: "已完成",
  invalid: "无效",
} as const;
export type LeadStatus = keyof typeof leadStatuses;
export type LeadFollowUp = {
  followUpStatus: LeadStatus;
  notes: string;
  isTest: boolean;
  revision: number;
  followUpUpdatedAt: string | null;
};
export type RawLeadFollowUp = {
  lead_id: number;
  status: LeadStatus;
  notes: string;
  is_test: boolean;
  revision: number;
  updated_at: string;
};
export const emptyLeadFollowUp: LeadFollowUp = {
  followUpStatus: "new", notes: "", isTest: false, revision: 0, followUpUpdatedAt: null,
};
export type LeadUpdate = { leadId: number; revision: number; status: LeadStatus; notes: string; isTest: boolean };
export type LeadActionState = { status: "idle" | "saved" | "error"; message?: string };

export function parseLeadUpdate(form: FormData): LeadUpdate | null {
  if (["leadId", "revision", "status", "notes", "isTest"].some((key) => form.getAll(key).length > 1)) return null;
  const leadId = Number(form.get("leadId"));
  const revision = Number(form.get("revision"));
  const status = String(form.get("status") ?? "");
  const notes = String(form.get("notes") ?? "").trim();
  const testValue = form.get("isTest");
  if (!Number.isSafeInteger(leadId) || leadId <= 0 || !Number.isSafeInteger(revision) || revision < 0
      || !form.has("revision") || !Object.hasOwn(leadStatuses, status) || notes.length > 2000
      || (testValue !== null && testValue !== "on")) return null;
  return { leadId, revision, status: status as LeadStatus, notes, isTest: testValue === "on" };
}
