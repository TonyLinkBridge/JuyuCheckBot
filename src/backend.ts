import type { Config } from "./config.js";
import type { DomainIntent, DomainReport } from "./domain/types.js";

export type GrowthEventName =
  | "bot_started"
  | "domain_submitted"
  | "preview_shown"
  | "intent_selected"
  | "gate_shown"
  | "unlock_failed"
  | "report_unlocked"
  | "report_shared";

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

export interface Backend {
  enabled: boolean;
  track(event: GrowthEvent): Promise<void>;
  saveReport(record: StoredReport): Promise<boolean>;
  getReport(reportToken: string, telegramUserId: number): Promise<StoredReport | null>;
}

class MemoryBackend implements Backend {
  enabled = false;
  async track(): Promise<void> {}
  async saveReport(): Promise<boolean> {
    return true;
  }
  async getReport(): Promise<StoredReport | null> {
    return null;
  }
}

class SupabaseBackend implements Backend {
  enabled = true;

  constructor(
    private readonly url: string,
    private readonly serviceRoleKey: string,
  ) {}

  async track(event: GrowthEvent): Promise<void> {
    await this.request("growth_events", {
      event_name: event.eventName,
      telegram_user_id: event.telegramUserId,
      source: event.source,
      domain: event.domain ?? null,
      report_token: event.reportToken ?? null,
      intent: event.intent ?? null,
      metadata: event.metadata ?? {},
    });
  }

  async saveReport(record: StoredReport): Promise<boolean> {
    return this.request(
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

    try {
      const response = await fetch(`${this.url}/rest/v1/domain_reports?${query}`, {
        headers: {
          apikey: this.serviceRoleKey,
          Authorization: `Bearer ${this.serviceRoleKey}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) {
        console.error(`Supabase report lookup failed: HTTP ${response.status}`);
        return null;
      }

      const rows = (await response.json()) as Array<{
        report_token?: unknown;
        telegram_user_id?: unknown;
        source?: unknown;
        report?: unknown;
        intent?: unknown;
      }>;
      const row = rows[0];
      if (
        !row ||
        row.report_token !== reportToken ||
        Number(row.telegram_user_id) !== telegramUserId ||
        typeof row.source !== "string"
      ) {
        return null;
      }

      const report = reviveDomainReport(row.report);
      if (!report) return null;
      const intent = isDomainIntent(row.intent) ? row.intent : undefined;
      return {
        reportToken,
        telegramUserId,
        source: row.source,
        report,
        intent,
      };
    } catch {
      console.error("Supabase report lookup failed: network error");
      return null;
    }
  }

  private async request(table: string, body: Record<string, unknown>, prefer = "return=minimal"): Promise<boolean> {
    try {
      const response = await fetch(`${this.url}/rest/v1/${table}`, {
        method: "POST",
        headers: {
          apikey: this.serviceRoleKey,
          Authorization: `Bearer ${this.serviceRoleKey}`,
          "Content-Type": "application/json",
          Prefer: prefer,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) console.error(`Supabase backend request failed: HTTP ${response.status}`);
      return response.ok;
    } catch {
      console.error("Supabase backend request failed: network error");
      return false;
    }
  }
}

export function createBackend(config: Config): Backend {
  if (config.SUPABASE_URL && config.SUPABASE_SERVICE_ROLE_KEY) {
    return new SupabaseBackend(config.SUPABASE_URL.replace(/\/$/, ""), config.SUPABASE_SERVICE_ROLE_KEY);
  }
  return new MemoryBackend();
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
