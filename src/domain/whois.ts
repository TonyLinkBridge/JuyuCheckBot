import { whoisDomain } from "whoiser";
import type { RdapResult } from "./types.js";

type WhoisServerResult = Record<string, unknown> & { __raw?: string };

const explicitNotFoundPatterns = [
  /^no match for\b/im,
  /^not found\.?$/im,
  /^no data found\.?$/im,
  /^no entries found\.?$/im,
  /^domain not found\.?$/im,
  /^status:\s*(?:free|available)\s*$/im,
];

export async function checkWhoisRegistration(domain: string, timeoutMs: number): Promise<RdapResult> {
  const response = await whoisDomain(domain, {
    raw: true,
    follow: 2,
    timeout: timeoutMs,
  });
  const checkedAt = new Date();
  const candidates: Array<{ report: RdapResult; score: number }> = [];
  let availableSource: RdapResult["source"] | null = null;

  for (const [server, result] of Object.entries(response as Record<string, WhoisServerResult>)) {
    const raw = result?.__raw?.trim() || structuredWhoisText(result);
    if (!raw) continue;

    const source: RdapResult["source"] = {
      type: "whois",
      name: `辅助 WHOIS · ${server}`,
      url: null,
      authoritative: false,
      checkedAt,
    };
    const fields = parseWhoisFields(raw);
    const reportedDomain = firstField(fields, "domain name", "domain");

    if (!reportedDomain) {
      if (!availableSource && explicitNotFoundPatterns.some((pattern) => pattern.test(raw))) availableSource = source;
      continue;
    }
    if (normalizeDomainField(reportedDomain) !== domain.toLowerCase()) continue;

    const report = registeredWhoisResult(fields, source);
    candidates.push({ report, score: whoisEvidenceScore(report) });
  }

  candidates.sort((a, b) => b.score - a.score);
  if (candidates[0]) return candidates[0].report;
  if (availableSource) return emptyWhoisResult("available", availableSource);
  throw new Error(Object.keys(response).length ? "WHOIS 回应无法确认注册状态" : "WHOIS 没有返回查询服务器");
}

function registeredWhoisResult(fields: Map<string, string[]>, source: RdapResult["source"]): RdapResult {
  return {
    status: "registered",
    registrar: firstField(fields, "registrar", "sponsoring registrar", "authorized agency"),
    createdAt: parseWhoisDate(firstField(fields, "creation date", "created date", "registered date", "created")),
    expiresAt: parseWhoisDate(firstField(
      fields,
      "registry expiry date",
      "registrar registration expiration date",
      "expiration date",
      "expiry date",
      "expires",
      "expiry",
    )),
    updatedAt: parseWhoisDate(firstField(fields, "updated date", "last updated date", "changed", "updated")),
    nameServers: unique(valuesFor(fields, "name server", "nserver", "nameservers")
      .map((value) => value.split(/\s+/)[0] ?? "")
      .filter(Boolean)
      .map((value) => value.toLowerCase().replace(/\.$/, ""))),
    statuses: unique(valuesFor(fields, "domain status", "status", "registration status")
      .map((value) => value.split(/\s+https?:\/\//, 1)[0]?.trim() ?? "")
      .filter(Boolean)),
    dnssec: parseDnssec(firstField(fields, "dnssec")),
    source,
  };
}

function whoisEvidenceScore(report: RdapResult): number {
  return (report.registrar ? 4 : 0)
    + (report.createdAt ? 3 : 0)
    + (report.expiresAt ? 4 : 0)
    + (report.updatedAt ? 1 : 0)
    + Math.min(report.nameServers.length, 3)
    + (report.statuses.length ? 1 : 0)
    + (report.dnssec !== null ? 1 : 0);
}

function emptyWhoisResult(status: "available" | "unknown", source: RdapResult["source"]): RdapResult {
  return {
    status,
    registrar: null,
    createdAt: null,
    expiresAt: null,
    updatedAt: null,
    nameServers: [],
    statuses: [],
    dnssec: null,
    source,
  };
}

function structuredWhoisText(value: WhoisServerResult | undefined): string {
  if (!value) return "";
  const lines: string[] = [];
  for (const [key, item] of Object.entries(value)) {
    if (key.startsWith("__") || item === null || item === undefined || item === "") continue;
    if (Array.isArray(item)) {
      for (const entry of item) lines.push(`${key}: ${String(entry)}`);
    } else if (typeof item !== "object") {
      lines.push(`${key}: ${String(item)}`);
    }
  }
  return lines.join("\n");
}

function parseWhoisFields(value: string): Map<string, string[]> {
  const fields = new Map<string, string[]>();
  for (const line of value.split(/\r?\n/)) {
    const match = /^([^:]+):\s*(.*)$/.exec(line.trim());
    if (!match?.[1] || !match[2]) continue;
    const key = match[1].trim().toLowerCase();
    const rows = fields.get(key) ?? [];
    rows.push(match[2].trim());
    fields.set(key, rows);
  }
  return fields;
}

function firstField(fields: Map<string, string[]>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = fields.get(key)?.[0];
    if (value) return value;
  }
  return null;
}

function valuesFor(fields: Map<string, string[]>, ...keys: string[]): string[] {
  return keys.flatMap((key) => fields.get(key) ?? []);
}

function normalizeDomainField(value: string): string {
  return value.trim().toLowerCase().replace(/\.$/, "");
}

function parseWhoisDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value.replace(/^</, "").replace(/>$/, "").trim());
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseDnssec(value: string | null): boolean | null {
  if (!value) return null;
  if (/^(?:signed|signeddelegation|yes|true)$/i.test(value)) return true;
  if (/^(?:unsigned|no|false)$/i.test(value)) return false;
  return null;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
