import type { Config } from "./config.js";
import type { CommerceLead, CommerceSession } from "./commerce/types.js";
import { buildEvidence } from "./domain/evidence.js";
import { emptyIntelligence } from "./domain/intelligence.js";
import type { DomainIntent, DomainReport } from "./domain/types.js";
import { sourceLabel } from "./source-label.js";
import type { DatabaseReadiness } from "./health.js";

export type GrowthEventName =
  | "bot_started"
  | "user_created"
  | "domain_submitted"
  | "check_failed"
  | "rate_limited"
  | "preview_shown"
  | "intent_selected"
  | "gate_shown"
  | "unlock_failed"
  | "verification_unavailable"
  | "report_unlocked"
  | "share_generated"
  | "referral_opened"
  | "commerce_handoff"
  | "jucha_handoff"
  | "history_viewed"
  | "refresh_requested"
  | "technical_details_viewed"
  | "lead_started"
  | "lead_step_completed"
  | "lead_cancelled"
  | "lead_submitted"
  | "lead_start_failed"
  | "lead_submit_failed"
  | "user_profile_failed"
  | "lead_notification_pending"
  | "lead_notification_sent"
  | "lead_notification_failed";
// Notification jobs are durable in Supabase; the memory implementation is for local operation.
export type LeadNotificationJob = {
  leadId: number;
  attempts: number;
  telegramUserId: number;
  username: string | undefined;
  lead: CommerceLead;
};

export type GrowthEvent = {
  eventName: GrowthEventName;
  telegramUserId: number;
  source: string;
  domain?: string;
  reportToken?: string;
  intent?: DomainIntent;
  metadata?: Record<string, unknown>;
};

export type StoredReport = {
  reportToken: string;
  telegramUserId: number;
  source: string;
  report: DomainReport;
  intent?: DomainIntent;
};

export type UserIdentity = {
  isNew: boolean;
};

export type LeadCreationResult = { id: number; created: boolean };

export type TelegramPublicProfile = {
  username?: string;
  firstName?: string;
  lastName?: string;
};

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; scope: "minute" | "day"; retryAfterSeconds: number };

export interface Backend {
  enabled: boolean;
  isCompletedUpdate(telegramUserId: number, updateId: number): Promise<boolean>;
  getReadiness(): Promise<DatabaseReadiness | null>;
  track(event: GrowthEvent): Promise<void>;
  identifyUser(telegramUserId: number, source: string, profile?: TelegramPublicProfile): Promise<UserIdentity>;
  getUserSource(telegramUserId: number): Promise<string | null>;
  checkRateLimit(telegramUserId: number): Promise<RateLimitResult>;
  saveReport(record: StoredReport): Promise<boolean>;
  getReport(reportToken: string, telegramUserId: number): Promise<StoredReport | null>;
  getReferralReport(reportToken: string): Promise<StoredReport | null>;
  hasReferralOpen(telegramUserId: number, reportToken: string): Promise<boolean>;
  getRecentReport(domain: string, reportVersion: string, maxAgeMs: number): Promise<DomainReport | null>;
  listReports(telegramUserId: number, limit: number): Promise<StoredReport[]>;
  saveCommerceSession(telegramUserId: number, session: CommerceSession): Promise<boolean>;
  getCommerceSession(telegramUserId: number): Promise<CommerceSession | null>;
  clearCommerceSession(telegramUserId: number): Promise<boolean>;
  createLead(telegramUserId: number, username: string | undefined, lead: CommerceLead): Promise<LeadCreationResult | null>;
  claimLeadNotifications(limit: number, leadId?: number, now?: Date): Promise<LeadNotificationJob[]>;
  finishLeadNotification(job: LeadNotificationJob, sent: boolean): Promise<boolean>;
  deleteUserData(telegramUserId: number): Promise<boolean>;
  cleanupExpiredData(retentionDays: number): Promise<void>;
}

class MemoryBackend implements Backend {
  enabled = false;
  async isCompletedUpdate(telegramUserId: number, updateId: number): Promise<boolean> {
    return this.completedUpdates.has(`${telegramUserId}:${updateId}`);
  }
  async getReadiness(): Promise<null> { return null; }
  private readonly users = new Set<number>();
  private readonly commerceSessions = new Map<number, CommerceSession>();
  private nextLeadId = 1;
  private readonly submissionLeads = new Map<string, number>();
  private readonly completedUpdates = new Map<string, number>();
  private readonly notifications = new Map<number, { job: LeadNotificationJob; state: "pending" | "processing" | "sent"; due: number }>();

  async track(): Promise<void> {}

  async identifyUser(telegramUserId: number): Promise<UserIdentity> {
    const isNew = !this.users.has(telegramUserId);
    this.users.add(telegramUserId);
    return { isNew };
  }

  async getUserSource(): Promise<string | null> {
    return null;
  }

  async checkRateLimit(): Promise<RateLimitResult> {
    return { allowed: true };
  }

  async saveReport(): Promise<boolean> {
    return true;
  }

  async getReport(): Promise<StoredReport | null> {
    return null;
  }

  async getReferralReport(): Promise<StoredReport | null> {
    return null;
  }

  async hasReferralOpen(): Promise<boolean> {
    return false;
  }

  async getRecentReport(): Promise<DomainReport | null> {
    return null;
  }

  async listReports(): Promise<StoredReport[]> {
    return [];
  }

  async saveCommerceSession(telegramUserId: number, session: CommerceSession): Promise<boolean> {
    this.commerceSessions.set(telegramUserId, structuredClone({ ...session, updatedAt: new Date().toISOString() }));
    return true;
  }

  async getCommerceSession(telegramUserId: number): Promise<CommerceSession | null> {
    const session = this.commerceSessions.get(telegramUserId);
    return session ? structuredClone(session) : null;
  }

  async clearCommerceSession(telegramUserId: number): Promise<boolean> {
    this.commerceSessions.delete(telegramUserId);
    return true;
  }

  async createLead(telegramUserId: number, username: string | undefined, lead: CommerceLead): Promise<LeadCreationResult | null> {
    if (!lead.data.submission_id) return null;
    const updateKey = lead.data.completion_update_id === undefined ? null : `${telegramUserId}:${lead.data.completion_update_id}`;
    const completed = updateKey ? this.completedUpdates.get(updateKey) : undefined;
    if (completed !== undefined) return { id: completed, created: false };
    const key = `${telegramUserId}:${lead.data.submission_id}`;
    const existing = this.submissionLeads.get(key);
    if (existing !== undefined) {
      if (updateKey) this.completedUpdates.set(updateKey, existing);
      return { id: existing, created: false };
    }
    if (this.commerceSessions.get(telegramUserId)?.data.submission_id !== lead.data.submission_id) return null;
    const leadId = this.nextLeadId++;
    this.submissionLeads.set(key, leadId);
    if (updateKey) this.completedUpdates.set(updateKey, leadId);
    if (this.commerceSessions.get(telegramUserId)?.data.submission_id === lead.data.submission_id) {
      this.commerceSessions.delete(telegramUserId);
    }
    this.notifications.set(leadId, { job: { leadId, telegramUserId, username, lead: structuredClone(lead), attempts: 0 }, state: "pending", due: Date.now() });
    return { id: leadId, created: true };
  }

  async claimLeadNotifications(limit: number, leadId?: number, now = new Date()): Promise<LeadNotificationJob[]> {
    const jobs: LeadNotificationJob[] = [];
    for (const item of this.notifications.values()) {
      if (item.state === "sent" || item.due > now.getTime() || (leadId !== undefined && item.job.leadId !== leadId)) continue;
      item.state = "processing";
      item.due = now.getTime() + 5 * 60_000;
      item.job.attempts += 1;
      jobs.push(structuredClone(item.job));
      if (jobs.length >= Math.max(1, Math.min(3, limit))) break;
    }
    return jobs;
  }

  async finishLeadNotification(job: LeadNotificationJob, sent: boolean): Promise<boolean> {
    const item = this.notifications.get(job.leadId);
    if (!item || item.state !== "processing" || item.job.attempts !== job.attempts) return false;
    item.state = sent ? "sent" : "pending";
    item.due = Date.now() + Math.min(60 * 60_000, 60_000 * 2 ** Math.min(job.attempts - 1, 6));
    return true;
  }

  async deleteUserData(telegramUserId: number): Promise<boolean> {
    this.users.delete(telegramUserId);
    this.commerceSessions.delete(telegramUserId);
    for (const key of this.submissionLeads.keys()) if (key.startsWith(`${telegramUserId}:`)) this.submissionLeads.delete(key);
    for (const key of this.completedUpdates.keys()) if (key.startsWith(`${telegramUserId}:`)) this.completedUpdates.delete(key);
    for (const [id, item] of this.notifications) if (item.job.telegramUserId === telegramUserId) this.notifications.delete(id);
    return true;
  }

  async cleanupExpiredData(): Promise<void> {}
}

class SupabaseBackend implements Backend {
  enabled = true;
  async isCompletedUpdate(telegramUserId: number, updateId: number): Promise<boolean> {
    const rows = await this.readRows(`lead_completion_updates?telegram_user_id=eq.${telegramUserId}&update_id=eq.${updateId}&select=lead_id&limit=1`);
    if (!rows) throw new Error("Unable to verify completed update");
    return rows.length > 0;
  }
  async getReadiness(): Promise<DatabaseReadiness | null> {
    const rows = await this.readRows("rpc/bot_readiness");
    const row = rows?.[0];
    return row && typeof row.database_ok === "boolean" && typeof row.commerce_ok === "boolean"
      && typeof row.stale_notifications === "number" ? row as DatabaseReadiness : null;
  }
  private readonly perMinuteLimit = 5;
  private readonly perDayLimit = 30;

  constructor(
    private readonly url: string,
    private readonly serviceRoleKey: string,
  ) {}

  async track(event: GrowthEvent): Promise<void> {
    await this.write("POST", "growth_events", {
      event_name: event.eventName,
      telegram_user_id: event.telegramUserId,
      source: event.source,
      domain: event.domain ?? null,
      report_token: event.reportToken ?? null,
      intent: event.intent ?? null,
      metadata: event.metadata ?? {},
    });
  }

  async identifyUser(telegramUserId: number, source: string, publicProfile?: TelegramPublicProfile): Promise<UserIdentity> {
    const query = new URLSearchParams({
      telegram_user_id: `eq.${telegramUserId}`,
      select: "telegram_user_id",
      limit: "1",
    });
    const rows = await this.readRows(`user_profiles?${query}`);
    const now = new Date().toISOString();

    if (rows?.length) {
      const path = `user_profiles?telegram_user_id=eq.${telegramUserId}`;
      const baseUpdate = {
        last_source: source,
        last_seen_at: now,
      };
      const updated = await this.write("PATCH", path, {
        ...baseUpdate,
        last_source_label: sourceLabel(source),
        ...telegramProfileColumns(publicProfile),
      });
      if (!updated && !await this.write("PATCH", path, baseUpdate)) throw new Error("User profile update failed");
      return { isNew: false };
    }

    const path = "user_profiles?on_conflict=telegram_user_id";
    const baseProfile = {
      telegram_user_id: telegramUserId,
      first_source: source,
      last_source: source,
      first_seen_at: now,
      last_seen_at: now,
    };
    let inserted = await this.write(
      "POST",
      path,
      {
        ...baseProfile,
        last_source_label: sourceLabel(source),
        ...telegramProfileColumns(publicProfile),
      },
      "resolution=ignore-duplicates,return=minimal",
    );
    if (!inserted) {
      inserted = await this.write("POST", path, baseProfile, "resolution=ignore-duplicates,return=minimal");
    }
    if (!inserted) throw new Error("User profile creation failed");
    return { isNew: true };
  }

  async getUserSource(telegramUserId: number): Promise<string | null> {
    const query = new URLSearchParams({
      telegram_user_id: `eq.${telegramUserId}`,
      select: "last_source",
      limit: "1",
    });
    const rows = await this.readRows(`user_profiles?${query}`);
    const source = rows?.[0]?.last_source;
    return typeof source === "string" && source ? source : null;
  }

  async checkRateLimit(telegramUserId: number): Promise<RateLimitResult> {
    const now = Date.now();
    const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    const query = new URLSearchParams({
      telegram_user_id: `eq.${telegramUserId}`,
      event_name: "eq.domain_submitted",
      created_at: `gte.${dayAgo}`,
      select: "created_at",
      order: "created_at.desc",
      limit: String(this.perDayLimit),
    });
    const rows = await this.readRows(`growth_events?${query}`);
    if (!rows) return { allowed: true };

    const timestamps = rows
      .map((row) => (typeof row.created_at === "string" ? new Date(row.created_at).getTime() : Number.NaN))
      .filter((value) => Number.isFinite(value));
    if (timestamps.length >= this.perDayLimit) {
      const oldest = Math.min(...timestamps);
      return {
        allowed: false,
        scope: "day",
        retryAfterSeconds: Math.max(60, Math.ceil((oldest + 24 * 60 * 60 * 1000 - now) / 1000)),
      };
    }

    const minuteAgo = now - 60 * 1000;
    const recent = timestamps.filter((value) => value >= minuteAgo);
    if (recent.length >= this.perMinuteLimit) {
      const oldest = Math.min(...recent);
      return {
        allowed: false,
        scope: "minute",
        retryAfterSeconds: Math.max(1, Math.ceil((oldest + 60 * 1000 - now) / 1000)),
      };
    }
    return { allowed: true };
  }

  async saveReport(record: StoredReport): Promise<boolean> {
    return this.write(
      "POST",
      "domain_reports?on_conflict=report_token",
      {
        report_token: record.reportToken,
        telegram_user_id: record.telegramUserId,
        source: record.source,
        domain: record.report.domain,
        intent: record.intent ?? null,
        // Sent only for wire compatibility with Supabase projects created from the old schema.
        // The evidence-schema migration nulls these values with a database trigger.
        score: 0,
        grade: "D",
        score_version: record.report.reportVersion,
        confidence: record.report.dataCoverage === 100 ? "medium" : "low",
        data_coverage: record.report.dataCoverage,
        dimension_scores: {},
        report: record.report,
      },
      "resolution=merge-duplicates,return=minimal",
    );
  }

  async getReport(reportToken: string, telegramUserId: number): Promise<StoredReport | null> {
    const query = new URLSearchParams({
      report_token: `eq.${reportToken}`,
      telegram_user_id: `eq.${telegramUserId}`,
      select: "report_token,telegram_user_id,source,report,intent",
      limit: "1",
    });
    return this.getStoredReport(`domain_reports?${query}`);
  }

  async getReferralReport(reportToken: string): Promise<StoredReport | null> {
    const query = new URLSearchParams({
      report_token: `eq.${reportToken}`,
      select: "report_token,telegram_user_id,source,report,intent",
      limit: "1",
    });
    return this.getStoredReport(`domain_reports?${query}`);
  }

  async hasReferralOpen(telegramUserId: number, reportToken: string): Promise<boolean> {
    const query = new URLSearchParams({
      telegram_user_id: `eq.${telegramUserId}`,
      event_name: "eq.referral_opened",
      report_token: `eq.${reportToken}`,
      select: "event_name",
      limit: "1",
    });
    const rows = await this.readRows(`growth_events?${query}`);
    return Boolean(rows?.length);
  }

  async getRecentReport(domain: string, reportVersion: string, maxAgeMs: number): Promise<DomainReport | null> {
    const query = new URLSearchParams({
      domain: `eq.${domain}`,
      "report->>reportVersion": `eq.${reportVersion}`,
      created_at: `gte.${new Date(Date.now() - maxAgeMs).toISOString()}`,
      select: "report",
      order: "created_at.desc",
      limit: "1",
    });
    const rows = await this.readRows(`domain_reports?${query}`);
    const report = rows?.[0] ? reviveDomainReport(rows[0].report) : null;
    if (!report || Date.now() - report.checkedAt.getTime() > maxAgeMs) return null;
    return report;
  }

  async listReports(telegramUserId: number, limit: number): Promise<StoredReport[]> {
    const query = new URLSearchParams({
      telegram_user_id: `eq.${telegramUserId}`,
      select: "report_token,telegram_user_id,source,report,intent",
      order: "created_at.desc",
      limit: String(Math.max(5, Math.min(50, limit * 5))),
    });
    const rows = await this.readRows(`domain_reports?${query}`);
    const unique = new Map<string, StoredReport>();
    for (const stored of (rows ?? []).map(parseStoredReport).filter((row): row is StoredReport => row !== null)) {
      if (!unique.has(stored.report.domain)) unique.set(stored.report.domain, stored);
      if (unique.size >= Math.max(1, Math.min(10, limit))) break;
    }
    return [...unique.values()];
  }

  async saveCommerceSession(telegramUserId: number, session: CommerceSession): Promise<boolean> {
    return this.write(
      "POST",
      "bot_sessions?on_conflict=telegram_user_id",
      {
        telegram_user_id: telegramUserId,
        flow: session.flow,
        step: session.step,
        data: session.data,
        updated_at: new Date().toISOString(),
      },
      "resolution=merge-duplicates,return=minimal",
    );
  }

  async getCommerceSession(telegramUserId: number): Promise<CommerceSession | null> {
    const query = new URLSearchParams({
      telegram_user_id: `eq.${telegramUserId}`,
      select: "telegram_user_id,flow,step,data,updated_at",
      limit: "1",
    });
    const rows = await this.readRows(`bot_sessions?${query}`);
    return rows?.[0] ? parseCommerceSession(rows[0]) : null;
  }

  async clearCommerceSession(telegramUserId: number): Promise<boolean> {
    return this.write("DELETE", `bot_sessions?telegram_user_id=eq.${telegramUserId}`);
  }

  async createLead(
    telegramUserId: number,
    username: string | undefined,
    lead: CommerceLead,
  ): Promise<LeadCreationResult | null> {
    if (!lead.data.submission_id) return null;
    const rows = await this.writeRows("rpc/create_lead_once", {
      p_lead_type: lead.leadType,
      p_telegram_user_id: telegramUserId,
      p_username: cleanTelegramText(username)?.replace(/^@/, "") ?? "",
      p_data: lead.data,
    });
    const id = rows?.[0]?.id;
    return typeof id === "number" && Number.isSafeInteger(id) && typeof rows?.[0]?.created === "boolean"
      ? { id, created: rows[0].created } : null;
  }

  async claimLeadNotifications(limit: number, leadId?: number): Promise<LeadNotificationJob[]> {
    const rows = await this.writeRows("rpc/claim_lead_notifications", {
      p_limit: Math.max(1, Math.min(3, limit)), p_lead_id: leadId ?? null,
    });
    if (!rows) throw new Error("Notification queue unavailable");
    return rows.flatMap((row) => {
      if (typeof row.lead_id !== "number" || typeof row.telegram_user_id !== "number" || typeof row.attempts !== "number"
        || !["buy", "sell", "contact"].includes(String(row.lead_type)) || !row.data || typeof row.data !== "object") return [];
      return [{ leadId: row.lead_id, telegramUserId: row.telegram_user_id, attempts: row.attempts,
        username: typeof row.username === "string" ? row.username : undefined,
        lead: { leadType: row.lead_type, data: row.data } as CommerceLead }];
    });
  }

  async finishLeadNotification(job: LeadNotificationJob, sent: boolean): Promise<boolean> {
    const nextAttempt = new Date(Date.now() + Math.min(60 * 60_000, 60_000 * 2 ** Math.min(job.attempts - 1, 6))).toISOString();
    const rows = await this.writeRows(`lead_notifications?lead_id=eq.${job.leadId}&state=eq.processing&attempts=eq.${job.attempts}`, {
      state: sent ? "sent" : "pending", locked_until: null, next_attempt_at: nextAttempt,
      sent_at: sent ? new Date().toISOString() : null, updated_at: new Date().toISOString(),
    }, "PATCH");
    return rows?.length === 1;
  }

  async deleteUserData(telegramUserId: number): Promise<boolean> {
    const filter = `telegram_user_id=eq.${telegramUserId}`;
    const [sessionsDeleted, leadsDeleted, reportsDeleted, eventsDeleted] = await Promise.all([
      this.write("DELETE", `bot_sessions?${filter}`),
      this.write("DELETE", `leads?${filter}`),
      this.write("DELETE", `domain_reports?${filter}`),
      this.write("DELETE", `growth_events?${filter}`),
    ]);
    if (!sessionsDeleted || !leadsDeleted || !reportsDeleted || !eventsDeleted) return false;
    return this.write("DELETE", `user_profiles?${filter}`);
  }

  async cleanupExpiredData(retentionDays: number): Promise<void> {
    await this.write("POST", "rpc/cleanup_bot_data", { p_retention_days: Math.max(30, retentionDays) });
  }

  private async getStoredReport(path: string): Promise<StoredReport | null> {
    const rows = await this.readRows(path);
    return rows?.[0] ? parseStoredReport(rows[0]) : null;
  }

  private async readRows(path: string): Promise<Array<Record<string, unknown>> | null> {
    try {
      const response = await fetch(`${this.url}/rest/v1/${path}`, {
        headers: this.headers(),
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) {
        console.error(`Supabase read failed: HTTP ${response.status}`);
        return null;
      }
      const value = (await response.json()) as unknown;
      return Array.isArray(value) ? (value as Array<Record<string, unknown>>) : null;
    } catch {
      console.error("Supabase read failed: network error");
      return null;
    }
  }

  private async write(
    method: "POST" | "PATCH" | "DELETE",
    path: string,
    body?: Record<string, unknown>,
    prefer = "return=minimal",
  ): Promise<boolean> {
    try {
      const response = await fetch(`${this.url}/rest/v1/${path}`, {
        method,
        headers: { ...this.headers(), "Content-Type": "application/json", Prefer: prefer },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) console.error(`Supabase write failed: HTTP ${response.status}`);
      return response.ok;
    } catch {
      console.error("Supabase write failed: network error");
      return false;
    }
  }

  private async writeRows(path: string, body: Record<string, unknown>, method = "POST"): Promise<Array<Record<string, unknown>> | null> {
    try {
      const response = await fetch(`${this.url}/rest/v1/${path}`, {
        method,
        headers: {
          ...this.headers(),
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) {
        console.error(`Supabase write failed: HTTP ${response.status}`);
        return null;
      }
      const value = (await response.json()) as unknown;
      return Array.isArray(value) ? (value as Array<Record<string, unknown>>) : null;
    } catch {
      console.error("Supabase write failed: network error");
      return null;
    }
  }

  private headers(): Record<string, string> {
    return {
      apikey: this.serviceRoleKey,
      Authorization: `Bearer ${this.serviceRoleKey}`,
      Accept: "application/json",
    };
  }
}

function parseCommerceSession(row: Record<string, unknown>): CommerceSession | null {
  const flow = row.flow;
  const step = row.step;
  const data = row.data;
  const validFlows = new Set(["buy", "sell", "register", "contact"]);
  const validSteps = new Set(["domain", "budget", "purpose", "price", "negotiable", "listed", "contact", "message"]);
  if (typeof flow !== "string" || !validFlows.has(flow)) return null;
  if (typeof step !== "string" || !validSteps.has(step)) return null;
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const source = (data as Record<string, unknown>).source;
  if (typeof source !== "string" || !source) return null;
  if (!(data as Record<string, unknown>).submission_id && typeof row.telegram_user_id === "number" && typeof row.updated_at === "string") {
    const timestamp = Date.parse(row.updated_at);
    if (!Number.isFinite(timestamp)) return null;
    (data as Record<string, unknown>).submission_id = `legacy_${row.telegram_user_id}_${timestamp}`;
  }
  return { flow, step, data, ...(typeof row.updated_at === "string" ? { updatedAt: row.updated_at } : {}) } as CommerceSession;
}

export function createBackend(config: Config): Backend {
  if (config.SUPABASE_URL && config.SUPABASE_SERVICE_ROLE_KEY) {
    return new SupabaseBackend(config.SUPABASE_URL.replace(/\/$/, ""), config.SUPABASE_SERVICE_ROLE_KEY);
  }
  return new MemoryBackend();
}

function telegramProfileColumns(profile: TelegramPublicProfile | undefined): Record<string, string | null> {
  if (!profile) return {};
  return {
    telegram_username: cleanTelegramText(profile.username)?.replace(/^@/, "") ?? null,
    telegram_first_name: cleanTelegramText(profile.firstName) ?? null,
    telegram_last_name: cleanTelegramText(profile.lastName) ?? null,
  };
}

function cleanTelegramText(value: string | undefined): string | null {
  const cleaned = value?.trim();
  return cleaned ? cleaned.slice(0, 128) : null;
}

function parseStoredReport(row: Record<string, unknown>): StoredReport | null {
  if (
    typeof row.report_token !== "string" ||
    !Number.isFinite(Number(row.telegram_user_id)) ||
    typeof row.source !== "string"
  ) {
    return null;
  }
  const report = reviveDomainReport(row.report);
  if (!report) return null;
  return {
    reportToken: row.report_token,
    telegramUserId: Number(row.telegram_user_id),
    source: row.source,
    report,
    intent: isDomainIntent(row.intent) ? row.intent : undefined,
  };
}

function reviveDomainReport(value: unknown): DomainReport | null {
  if (!isRecord(value) || typeof value.domain !== "string" || !isRecord(value.rdap)) return null;
  const checkedAt = reviveDate(value.checkedAt);
  if (!checkedAt) return null;

  const rdapValue = value.rdap;
  const rdap: DomainReport["rdap"] = {
    status: rdapValue.status === "registered" || rdapValue.status === "available" ? rdapValue.status : "unknown",
    registrar: typeof rdapValue.registrar === "string" ? rdapValue.registrar : null,
    createdAt: reviveNullableDate(rdapValue.createdAt),
    expiresAt: reviveNullableDate(rdapValue.expiresAt),
    updatedAt: reviveNullableDate(rdapValue.updatedAt),
    nameServers: stringArray(rdapValue.nameServers),
    statuses: stringArray(rdapValue.statuses),
    dnssec: typeof rdapValue.dnssec === "boolean" ? rdapValue.dnssec : null,
    source: isRecord(rdapValue.source) && isRegistrationSourceType(rdapValue.source.type)
      ? {
          type: rdapValue.source.type,
          name: typeof rdapValue.source.name === "string" ? rdapValue.source.name : "注册资料",
          url: typeof rdapValue.source.url === "string" ? rdapValue.source.url : null,
          authoritative: rdapValue.source.authoritative === true,
          checkedAt: reviveDate(rdapValue.source.checkedAt) ?? checkedAt,
        }
      : {
          type: rdapValue.status === "registered" || rdapValue.status === "available" ? "rdap" : "unavailable",
          name: rdapValue.status === "registered" || rdapValue.status === "available" ? "RDAP 注册资料" : "暂未取得注册资料",
          url: null,
          authoritative: false,
          checkedAt,
        },
  };
  const dnsValue = isRecord(value.dns) ? value.dns : {};
  const dns: DomainReport["dns"] = {
    checked: dnsValue.checked === true,
    resolves: dnsValue.resolves === true,
    ipv4: stringArray(dnsValue.ipv4),
    ipv6: stringArray(dnsValue.ipv6),
    nameServers: stringArray(dnsValue.nameServers),
    mx: Array.isArray(dnsValue.mx)
      ? dnsValue.mx.filter(isRecord).map((item) => ({
          exchange: typeof item.exchange === "string" ? item.exchange : "",
          priority: Number.isFinite(Number(item.priority)) ? Number(item.priority) : 0,
        })).filter((item) => item.exchange)
      : [],
    source: isRecord(dnsValue.source)
      ? {
          name: typeof dnsValue.source.name === "string" ? dnsValue.source.name : "实时 DNS 查询",
          url: typeof dnsValue.source.url === "string" ? dnsValue.source.url : null,
          checkedAt: reviveDate(dnsValue.source.checkedAt) ?? checkedAt,
        }
      : { name: "实时 DNS 查询", url: null, checkedAt },
  };
  const registrableDomain = typeof value.registrableDomain === "string" ? value.registrableDomain : value.domain;
  const isIdn = value.isIdn === true;
  const intelligence = reviveIntelligence(value.intelligence, registrableDomain, checkedAt);
  const evidence = buildEvidence({ domain: value.domain, registrableDomain, isIdn, rdap, dns, now: checkedAt });
  return {
    domain: value.domain,
    registrableDomain,
    isSubdomain: value.isSubdomain === true,
    isIdn,
    checkedAt,
    rdap,
    dns,
    intelligence,
    ...evidence,
    reportVersion: typeof value.reportVersion === "string" ? value.reportVersion : `${evidence.reportVersion} · legacy data`,
  };
}

function reviveIntelligence(
  value: unknown,
  domain: string,
  checkedAt: Date,
): DomainReport["intelligence"] {
  const fallback = emptyIntelligence(domain, checkedAt);
  if (!isRecord(value)) return fallback;
  const tranco = isRecord(value.tranco) ? value.tranco : {};
  const crux = isRecord(value.crux) ? value.crux : {};
  const ahrefs = isRecord(value.ahrefs) ? value.ahrefs : {};
  const wayback = isRecord(value.wayback) ? value.wayback : {};
  return {
    tranco: {
      status: externalStatus(tranco.status),
      rank: finiteNumberOrNull(tranco.rank),
      rankedAt: typeof tranco.rankedAt === "string" ? tranco.rankedAt : null,
      checkedAt: reviveDate(tranco.checkedAt) ?? checkedAt,
    },
    crux: {
      status: externalStatus(crux.status),
      origin: typeof crux.origin === "string" ? crux.origin : `https://${domain}`,
      lcpP75Ms: finiteNumberOrNull(crux.lcpP75Ms),
      inpP75Ms: finiteNumberOrNull(crux.inpP75Ms),
      clsP75: finiteNumberOrNull(crux.clsP75),
      periodStart: typeof crux.periodStart === "string" ? crux.periodStart : null,
      periodEnd: typeof crux.periodEnd === "string" ? crux.periodEnd : null,
      checkedAt: reviveDate(crux.checkedAt) ?? checkedAt,
    },
    ahrefs: {
      status: externalStatus(ahrefs.status),
      domainRating: finiteNumberOrNull(ahrefs.domainRating),
      checkedAt: reviveDate(ahrefs.checkedAt) ?? checkedAt,
    },
    wayback: {
      status: externalStatus(wayback.status),
      firstCaptureAt: reviveNullableDate(wayback.firstCaptureAt),
      latestCaptureAt: reviveNullableDate(wayback.latestCaptureAt),
      firstCaptureUrl: typeof wayback.firstCaptureUrl === "string" ? wayback.firstCaptureUrl : null,
      latestCaptureUrl: typeof wayback.latestCaptureUrl === "string" ? wayback.latestCaptureUrl : null,
      checkedAt: reviveDate(wayback.checkedAt) ?? checkedAt,
    },
  };
}

function reviveNullableDate(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  return reviveDate(value);
}

function reviveDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isDomainIntent(value: unknown): value is DomainIntent {
  return value === "owner" || value === "buyer" || value === "research";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function isRegistrationSourceType(value: unknown): value is DomainReport["rdap"]["source"]["type"] {
  return value === "rdap" || value === "registry-whois" || value === "whois" || value === "unavailable";
}

function externalStatus(value: unknown): DomainReport["intelligence"]["tranco"]["status"] {
  return value === "available" || value === "not_found" || value === "not_configured" || value === "unavailable"
    ? value
    : "unavailable";
}

function finiteNumberOrNull(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number.NaN;
  return Number.isFinite(number) ? number : null;
}
