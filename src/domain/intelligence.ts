import type {
  AhrefsResult,
  CruxResult,
  DomainIntelligence,
  TrancoResult,
  WaybackResult,
} from "./types.js";

export type IntelligenceOptions = {
  timeoutMs: number;
  googleCruxApiKey?: string;
  ahrefsApiKey?: string;
};

export async function checkDomainIntelligence(
  domain: string,
  options: IntelligenceOptions,
): Promise<DomainIntelligence> {
  const [tranco, crux, ahrefs, wayback] = await Promise.all([
    checkTranco(domain, options.timeoutMs),
    checkCrux(domain, options.googleCruxApiKey, options.timeoutMs),
    checkAhrefs(domain, options.ahrefsApiKey, options.timeoutMs),
    checkWayback(domain, options.timeoutMs),
  ]);
  return { tranco, crux, ahrefs, wayback };
}

export async function checkTranco(domain: string, timeoutMs: number): Promise<TrancoResult> {
  const checkedAt = new Date();
  try {
    const response = await fetch(`https://tranco-list.eu/api/ranks/domain/${encodeURIComponent(domain)}`, {
      headers: { Accept: "application/json", "User-Agent": "JUYU-Domain-Check/1.0" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return { status: "unavailable", rank: null, rankedAt: null, checkedAt };
    const payload = (await response.json()) as unknown;
    const ranks = isRecord(payload) && Array.isArray(payload.ranks) ? payload.ranks : [];
    const valid = ranks
      .filter(isRecord)
      .map((item) => ({
        rank: finiteNumber(item.rank),
        date: typeof item.date === "string" ? item.date : null,
      }))
      .filter((item): item is { rank: number; date: string } => item.rank !== null && item.date !== null)
      .sort((a, b) => a.date.localeCompare(b.date));
    const latest = valid.at(-1);
    return latest
      ? { status: "available", rank: latest.rank, rankedAt: latest.date, checkedAt }
      : { status: "not_found", rank: null, rankedAt: null, checkedAt };
  } catch {
    return { status: "unavailable", rank: null, rankedAt: null, checkedAt };
  }
}

export async function checkCrux(
  domain: string,
  apiKey: string | undefined,
  timeoutMs: number,
): Promise<CruxResult> {
  const checkedAt = new Date();
  const origin = `https://${domain}`;
  const empty = {
    origin,
    lcpP75Ms: null,
    inpP75Ms: null,
    clsP75: null,
    periodStart: null,
    periodEnd: null,
    checkedAt,
  };
  if (!apiKey) return { status: "not_configured", ...empty };

  try {
    const url = new URL("https://chromeuxreport.googleapis.com/v1/records:queryRecord");
    url.searchParams.set("key", apiKey);
    const response = await fetch(url, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ origin }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (response.status === 404) return { status: "not_found", ...empty };
    if (!response.ok) return { status: "unavailable", ...empty };
    const payload = (await response.json()) as unknown;
    const record = isRecord(payload) && isRecord(payload.record) ? payload.record : null;
    const metrics = record && isRecord(record.metrics) ? record.metrics : null;
    const period = record && isRecord(record.collectionPeriod) ? record.collectionPeriod : null;
    if (!metrics) return { status: "not_found", ...empty };
    return {
      status: "available",
      origin,
      lcpP75Ms: percentile(metrics, "largest_contentful_paint"),
      inpP75Ms: percentile(metrics, "interaction_to_next_paint"),
      clsP75: percentile(metrics, "cumulative_layout_shift"),
      periodStart: cruxDate(period?.firstDate),
      periodEnd: cruxDate(period?.lastDate),
      checkedAt,
    };
  } catch {
    return { status: "unavailable", ...empty };
  }
}

export async function checkAhrefs(
  domain: string,
  apiKey: string | undefined,
  timeoutMs: number,
): Promise<AhrefsResult> {
  const checkedAt = new Date();
  if (!apiKey) return { status: "not_configured", domainRating: null, checkedAt };
  try {
    const url = new URL("https://api.ahrefs.com/v3/public/domain-rating-free");
    url.searchParams.set("target", domain);
    url.searchParams.set("output", "json");
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
        "User-Agent": "JUYU-Domain-Check/1.0",
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return { status: "unavailable", domainRating: null, checkedAt };
    const payload = (await response.json()) as unknown;
    const wrapper = isRecord(payload) && isRecord(payload.domain_rating) ? payload.domain_rating : null;
    const domainRating = wrapper ? finiteNumber(wrapper.domain_rating) : null;
    return domainRating === null
      ? { status: "not_found", domainRating: null, checkedAt }
      : { status: "available", domainRating, checkedAt };
  } catch {
    return { status: "unavailable", domainRating: null, checkedAt };
  }
}

export async function checkWayback(domain: string, timeoutMs: number): Promise<WaybackResult> {
  const checkedAt = new Date();
  const empty = {
    firstCaptureAt: null,
    latestCaptureAt: null,
    firstCaptureUrl: null,
    latestCaptureUrl: null,
    checkedAt,
  };
  try {
    const base = new URL("https://web.archive.org/cdx/search/cdx");
    base.searchParams.set("url", `${domain}/*`);
    base.searchParams.set("output", "json");
    base.searchParams.set("fl", "timestamp,original");
    base.searchParams.append("filter", "statuscode:200");
    base.searchParams.append("filter", "mimetype:text/html");
    base.searchParams.set("collapse", "digest");
    base.searchParams.set("limit", "1");
    const latestUrl = new URL(base);
    latestUrl.searchParams.set("sort", "reverse");
    const [firstResponse, latestResponse] = await Promise.all([
      fetch(base, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(timeoutMs) }),
      fetch(latestUrl, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(timeoutMs) }),
    ]);
    if (!firstResponse.ok || !latestResponse.ok) return { status: "unavailable", ...empty };
    const [firstPayload, latestPayload] = await Promise.all([firstResponse.json(), latestResponse.json()]);
    const first = captureRow(firstPayload);
    const latest = captureRow(latestPayload);
    if (!first && !latest) return { status: "not_found", ...empty };
    return {
      status: "available",
      firstCaptureAt: first?.date ?? null,
      latestCaptureAt: latest?.date ?? null,
      firstCaptureUrl: first?.url ?? null,
      latestCaptureUrl: latest?.url ?? null,
      checkedAt,
    };
  } catch {
    return { status: "unavailable", ...empty };
  }
}

export function emptyIntelligence(domain: string, checkedAt = new Date()): DomainIntelligence {
  return {
    tranco: { status: "unavailable", rank: null, rankedAt: null, checkedAt },
    crux: {
      status: "unavailable",
      origin: `https://${domain}`,
      lcpP75Ms: null,
      inpP75Ms: null,
      clsP75: null,
      periodStart: null,
      periodEnd: null,
      checkedAt,
    },
    ahrefs: { status: "unavailable", domainRating: null, checkedAt },
    wayback: {
      status: "unavailable",
      firstCaptureAt: null,
      latestCaptureAt: null,
      firstCaptureUrl: null,
      latestCaptureUrl: null,
      checkedAt,
    },
  };
}

function percentile(metrics: Record<string, unknown>, key: string): number | null {
  const metric = isRecord(metrics[key]) ? metrics[key] : null;
  const percentiles = metric && isRecord(metric.percentiles) ? metric.percentiles : null;
  return percentiles ? finiteNumber(percentiles.p75) : null;
}

function cruxDate(value: unknown): string | null {
  if (!isRecord(value)) return null;
  const year = finiteNumber(value.year);
  const month = finiteNumber(value.month);
  const day = finiteNumber(value.day);
  if (year === null || month === null || day === null) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function captureRow(value: unknown): { date: Date; url: string } | null {
  if (!Array.isArray(value)) return null;
  for (const row of value.slice(1)) {
    if (!Array.isArray(row) || typeof row[0] !== "string" || typeof row[1] !== "string") continue;
    const date = waybackDate(row[0]);
    if (!date) continue;
    return { date, url: `https://web.archive.org/web/${row[0]}/${row[1]}` };
  }
  return null;
}

function waybackDate(timestamp: string): Date | null {
  if (!/^\d{14}$/.test(timestamp)) return null;
  const date = new Date(
    `${timestamp.slice(0, 4)}-${timestamp.slice(4, 6)}-${timestamp.slice(6, 8)}T${timestamp.slice(8, 10)}:${timestamp.slice(10, 12)}:${timestamp.slice(12, 14)}Z`,
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

function finiteNumber(value: unknown): number | null {
  const number = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : Number.NaN;
  return Number.isFinite(number) ? number : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
