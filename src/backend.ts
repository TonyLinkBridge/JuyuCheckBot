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
  saveReport(record: StoredReport): Promise<void>;
}

class MemoryBackend implements Backend {
  enabled = false;
  async track(): Promise<void> {}
  async saveReport(): Promise<void> {}
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

  async saveReport(record: StoredReport): Promise<void> {
    await this.request(
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

  private async request(table: string, body: Record<string, unknown>, prefer = "return=minimal"): Promise<void> {
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
    } catch {
      console.error("Supabase backend request failed: network error");
    }
  }
}

export function createBackend(config: Config): Backend {
  if (config.SUPABASE_URL && config.SUPABASE_SERVICE_ROLE_KEY) {
    return new SupabaseBackend(config.SUPABASE_URL.replace(/\/$/, ""), config.SUPABASE_SERVICE_ROLE_KEY);
  }
  return new MemoryBackend();
}
