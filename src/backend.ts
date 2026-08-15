import type { Config } from "./config.js";
import type { DomainIntent, DomainReport } from "./domain/types.js";

export type GrowthEventName =
  | "bot_started"
  | "user_created"
  | "domain_submitted"
  | "rate_limited"
  | "preview_shown"
  | "intent_selected"
  | "gate_shown"
  | "unlock_failed"
  | "verification_unavailable"
  | "report_unlocked"
  | "share_generated"
  | "referral_opened"
  | "history_viewed";

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

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; scope: "minute" | "day"; retryAfterSeconds: number };

export interface Backend {
  enabled: boolean;
  track(event: GrowthEvent): Promise<void>;
  identifyUser(telegramUserId: number, source: string): Promise<UserIdentity>;
  checkRateLimit(telegramUserId: number): Promise<RateLimitResult>;
  saveReport(record: StoredReport): Promise<boolean>;
  getReport(reportToken: string, telegramUserId: number): Promise<StoredReport | null>;
  getReferralReport(reportToken: string): Promise<StoredReport | null>;
  getRecentReport(domain: string, scoreVersion: string, maxAgeMs: number): Promise<DomainReport | null>;
  listReports(telegramUserId: number, limit: number): Promise<StoredReport[]>;
  deleteUserData(telegramUserId: number): Promise<boolean>;
  cleanupExpiredData(retentionDays: number): Promise<void>;
}

class MemoryBackend implements Backend {
  enabled = false;
  private readonly users = new Set<number>();

  async track(): Promise<void> {}

  async identifyUser(telegramUserId: number): Promise<UserIdentity> {
    const isNew = !this.users.has(telegramUserId);
    this.users.add(telegramUserId);
    return { isNew };
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

  async getRecentReport(): Promise<DomainReport | null> {
    return null;
  }

  async listReports(): Promise<StoredReport[]> {
    return [];
  }

  async deleteUserData(telegramUserId: number): Promise<boolean> {
    this.users.delete(telegramUserId);
    return true;
  }

  async cleanupExpiredData(): Promise<void> {}
}

class SupabaseBackend implements Backend {
  enabled = true;
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

  async identifyUser(telegramUserId: number, source: string): Promise<UserIdentity> {
    const query = new URLSearchParams({
      telegram_user_id: `eq.${telegramUserId}`,
      select: "telegram_user_id",
      limit: "1",
    });
    const rows = await this.readRows(`user_profiles?${query}`);
    const now = new Date().toISOString();

    if (rows?.length) {
      await this.write("PATCH", `user_profiles?telegram_user_id=eq.${telegramUserId}`, {
        last_source: source,
        last_seen_at: now,
      });
      return { isNew: false };
    }

    const inserted = await this.write(
      "POST",
      "user_profiles?on_conflict=telegram_user_id",
      {
        telegram_user_id: telegramUserId,
        first_source: source,
        last_source: source,
        first_seen_at: now,
        last_seen_at: now,
      },
      "resolution=ignore-duplicates,return=minimal",
    );
    return { isNew: inserted };
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
        score: record.report.score,
        grade: record.report.grade,
        score_version: record.report.scoreVersion,
        confidence: record.report.confidence,
        data_coverage: record.report.dataCoverage,
        dimension_scores: record.report.dimensions,
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

  async getRecentReport(domain: string, scoreVersion: string, maxAgeMs: number): Promise<DomainReport | null> {
    const query = new URLSearchParams({
      domain: `eq.${domain}`,
      score_version: `eq.${scoreVersion}`,
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
      limit: String(Math.max(1, Math.min(10, limit))),
    });
    const rows = await this.readRows(`domain_reports?${query}`);
    return (rows ?? []).map(parseStoredReport).filter((row): row is StoredReport => row !== null);
  }

  async deleteUserData(telegramUserId: number): Promise<boolean> {
    const filter = `telegram_user_id=eq.${telegramUserId}`;
    const [reportsDeleted, eventsDeleted, profileDeleted] = await Promise.all([
      this.write("DELETE", `domain_reports?${filter}`),
      this.write("DELETE", `growth_events?${filter}`),
      this.write("DELETE", `user_profiles?${filter}`),
    ]);
    return reportsDeleted && eventsDeleted && profileDeleted;
  }

  async cleanupExpiredData(retentionDays: number): Promise<void> {
    const cutoff = new Date(Date.now() - Math.max(30, retentionDays) * 24 * 60 * 60 * 1000).toISOString();
    await Promise.all([
      this.write("DELETE", `domain_reports?created_at=lt.${encodeURIComponent(cutoff)}`),
      this.write("DELETE", `growth_events?created_at=lt.${encodeURIComponent(cutoff)}`),
      this.write("DELETE", `user_profiles?last_seen_at=lt.${encodeURIComponent(cutoff)}`),
    ]);
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

  private headers(): Record<string, string> {
    return {
      apikey: this.serviceRoleKey,
      Authorization: `Bearer ${this.serviceRoleKey}`,
      Accept: "application/json",
    };
  }
}

export function createBackend(config: Config): Backend {
  if (config.SUPABASE_URL && config.SUPABASE_SERVICE_ROLE_KEY) {
    return new SupabaseBackend(config.SUPABASE_URL.replace(/\/$/, ""), config.SUPABASE_SERVICE_ROLE_KEY);
  }
  return new MemoryBackend();
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

  const rdap = value.rdap;
  return {
    ...(value as unknown as DomainReport),
    checkedAt,
    rdap: {
      ...(rdap as unknown as DomainReport["rdap"]),
      createdAt: reviveNullableDate(rdap.createdAt),
      expiresAt: reviveNullableDate(rdap.expiresAt),
      updatedAt: reviveNullableDate(rdap.updatedAt),
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
