import type { Config } from "./config.js";
import { buildEvidence } from "./domain/evidence.js";
import { emptyIntelligence } from "./domain/intelligence.js";
import type { DomainIntent, DomainReport } from "./domain/types.js";
import { sourceLabel } from "./source-label.js";

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
  | "technical_details_viewed";

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
      if (!updated) {
        await this.write("PATCH", path, baseUpdate);
      }
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
    return { isNew: inserted };
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
  return value === "rdap" || value === "registry-whois" || value === "unavailable";
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
