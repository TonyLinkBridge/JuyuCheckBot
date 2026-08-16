import "server-only";

export const rangeOptions = [
  { value: "1d", label: "24H", days: 1 },
  { value: "7d", label: "7D", days: 7 },
  { value: "30d", label: "30D", days: 30 },
  { value: "90d", label: "90D", days: 90 },
] as const;

export type RangeValue = (typeof rangeOptions)[number]["value"];

type GrowthEvent = {
  event_name: string;
  telegram_user_id: number;
  source: string;
  domain: string | null;
  report_token: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type ReportRow = {
  domain: string;
  score: number;
  grade: string;
  score_version: string;
  confidence: string;
  data_coverage: number;
  report: Record<string, unknown>;
  created_at: string;
};

export type Metric = {
  value: number;
  previous: number;
  format: "number" | "percent" | "decimal";
  numerator?: number;
  denominator?: number;
};

export type DashboardData = {
  configured: boolean;
  generatedAt: string;
  range: RangeValue;
  totals: {
    newUsers: Metric;
    toolUsers: Metric;
    unlockRate: Metric;
    shareRate: Metric;
    referredUsers: Metric;
    loopRate: Metric;
  };
  funnel: Array<{ key: string; label: string; value: number }>;
  gate: {
    shown: number;
    failed: number;
    unlocked: number;
    conversionRate: number;
    recoveryRate: number;
  };
  trend: Array<{
    label: string;
    newUsers: number;
    toolUsers: number;
    unlocked: number;
    referrals: number;
  }>;
  sources: Array<{
    source: string;
    newUsers: number;
    activated: number;
    unlocked: number;
    shared: number;
    activationRate: number;
  }>;
  quality: {
    reportCount: number;
    averageScore: number;
    lowConfidenceRate: number;
    unavailableRate: number;
    cachedRate: number;
    failureRate: number;
    medianDurationMs: number;
  };
  recent: Array<{
    event: string;
    source: string;
    domain: string | null;
    createdAt: string;
  }>;
  error?: string;
};

export function normalizeRange(value: string | undefined): RangeValue {
  return rangeOptions.some((option) => option.value === value) ? (value as RangeValue) : "7d";
}

export async function getDashboardData(range: RangeValue): Promise<DashboardData> {
  const option = rangeOptions.find((item) => item.value === range) ?? rangeOptions[1];
  const now = new Date();
  const empty = emptyDashboard(range, now);
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { ...empty, configured: false, error: "Supabase 尚未配置" };

  const currentStart = new Date(now.getTime() - option.days * 86_400_000);
  const queryStart = new Date(now.getTime() - option.days * 2 * 86_400_000);
  try {
    const [events, reports] = await Promise.all([
      readAll<GrowthEvent>(url, key, "growth_events", {
        select: "event_name,telegram_user_id,source,domain,report_token,metadata,created_at",
        created_at: `gte.${queryStart.toISOString()}`,
        order: "created_at.asc",
      }),
      readAll<ReportRow>(url, key, "domain_reports", {
        select: "domain,score,grade,score_version,confidence,data_coverage,report,created_at",
        created_at: `gte.${queryStart.toISOString()}`,
        order: "created_at.asc",
      }),
    ]);
    return buildDashboard(range, option.days, now, currentStart, queryStart, events, reports);
  } catch (error) {
    console.error("Growth dashboard data load failed", error instanceof Error ? error.message : "unknown error");
    return { ...empty, configured: true, error: "暂时无法读取增长数据" };
  }
}

async function readAll<T>(
  url: string,
  key: string,
  table: string,
  query: Record<string, string>,
): Promise<T[]> {
  const params = new URLSearchParams(query);
  const rows: T[] = [];
  const pageSize = 1000;
  for (let offset = 0; offset < 10_000; offset += pageSize) {
    const response = await fetch(`${url}/rest/v1/${table}?${params}`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Range: `${offset}-${offset + pageSize - 1}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`${table}: HTTP ${response.status}`);
    const page = (await response.json()) as T[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

function buildDashboard(
  range: RangeValue,
  days: number,
  now: Date,
  currentStart: Date,
  previousStart: Date,
  events: GrowthEvent[],
  reports: ReportRow[],
): DashboardData {
  const current = events.filter((event) => new Date(event.created_at) >= currentStart);
  const previous = events.filter((event) => {
    const date = new Date(event.created_at);
    return date >= previousStart && date < currentStart;
  });
  const currentMetrics = periodMetrics(current);
  const previousMetrics = periodMetrics(previous);
  const newUserIds = userSet(current, "user_created");
  const cohortStage = (eventName: string, predicate?: (event: GrowthEvent) => boolean) =>
    new Set(
      current
        .filter((event) => event.event_name === eventName && newUserIds.has(event.telegram_user_id) && (!predicate || predicate(event)))
        .map((event) => event.telegram_user_id),
    ).size;
  const gateEvents = current.filter((event) => event.event_name === "gate_shown" && event.report_token);
  const failedTokens = new Set(
    current.filter((event) => event.event_name === "unlock_failed" && event.report_token).map((event) => event.report_token),
  );
  const unlockedTokens = new Set(
    current.filter((event) => event.event_name === "report_unlocked" && event.report_token).map((event) => event.report_token),
  );
  const gateTokens = new Set(gateEvents.map((event) => event.report_token));
  const gateUnlocked = [...gateTokens].filter((token) => unlockedTokens.has(token)).length;
  const recovered = [...failedTokens].filter((token) => unlockedTokens.has(token)).length;
  const currentReports = reports.filter((report) => new Date(report.created_at) >= currentStart);
  const previewEvents = current.filter((event) => event.event_name === "preview_shown");
  const durations = previewEvents
    .map((event) => numericMetadata(event, "durationMs"))
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b);

  return {
    configured: true,
    generatedAt: now.toISOString(),
    range,
    totals: {
      newUsers: metric(currentMetrics.newUsers, previousMetrics.newUsers, "number", currentMetrics.newUsers),
      toolUsers: metric(currentMetrics.toolUsers, previousMetrics.toolUsers, "number", currentMetrics.toolUsers),
      unlockRate: metric(currentMetrics.unlockRate, previousMetrics.unlockRate, "percent", currentMetrics.unlocked, currentMetrics.previewed),
      shareRate: metric(currentMetrics.shareRate, previousMetrics.shareRate, "percent", currentMetrics.shared, currentMetrics.unlocked),
      referredUsers: metric(currentMetrics.referredUsers, previousMetrics.referredUsers, "number", currentMetrics.referredUsers),
      loopRate: metric(currentMetrics.loopRate, previousMetrics.loopRate, "percent", currentMetrics.referredUsers, currentMetrics.shared),
    },
    funnel: [
      { key: "new", label: "New User", value: newUserIds.size },
      { key: "submitted", label: "Domain Submitted", value: cohortStage("domain_submitted") },
      { key: "preview", label: "Preview Shown", value: cohortStage("preview_shown") },
      { key: "unlocked", label: "Report Unlocked", value: cohortStage("report_unlocked") },
      { key: "shared", label: "Share Generated", value: cohortStage("share_generated") },
      {
        key: "referred",
        label: "Referred New User",
        value: cohortStage("referral_opened", (event) => event.metadata?.isNew === true),
      },
    ],
    gate: {
      shown: gateTokens.size,
      failed: failedTokens.size,
      unlocked: gateUnlocked,
      conversionRate: ratio(gateUnlocked, gateTokens.size),
      recoveryRate: ratio(recovered, failedTokens.size),
    },
    trend: buildTrend(current, currentStart, now, days),
    sources: buildSources(current),
    quality: {
      reportCount: currentReports.length,
      averageScore: average(currentReports.map((report) => Number(report.score)).filter(Number.isFinite)),
      lowConfidenceRate: ratio(
        currentReports.filter((report) => report.confidence === "low").length,
        currentReports.length,
      ),
      unavailableRate: ratio(
        currentReports.filter((report) => activityUnavailable(report.report)).length,
        currentReports.length,
      ),
      cachedRate: ratio(
        previewEvents.filter((event) => event.metadata?.cached === true).length,
        previewEvents.length,
      ),
      failureRate: ratio(
        current.filter((event) => event.event_name === "check_failed").length,
        current.filter((event) => event.event_name === "domain_submitted").length,
      ),
      medianDurationMs: median(durations),
    },
    recent: [...current]
      .reverse()
      .filter((event) => event.event_name !== "bot_started")
      .slice(0, 12)
      .map((event) => ({
        event: event.event_name,
        source: event.source,
        domain: event.domain,
        createdAt: event.created_at,
      })),
  };
}

function periodMetrics(events: GrowthEvent[]) {
  const newUsers = userSet(events, "user_created").size;
  const toolUsers = userSet(events, "domain_submitted").size;
  const previewed = userSet(events, "preview_shown").size;
  const unlocked = userSet(events, "report_unlocked").size;
  const shared = userSet(events, "share_generated").size;
  const referredUsers = new Set(
    events
      .filter((event) => event.event_name === "referral_opened" && event.metadata?.isNew === true)
      .map((event) => event.telegram_user_id),
  ).size;
  return {
    newUsers,
    toolUsers,
    previewed,
    unlocked,
    shared,
    unlockRate: ratio(unlocked, previewed),
    shareRate: ratio(shared, unlocked),
    referredUsers,
    loopRate: ratio(referredUsers, shared),
  };
}

function buildSources(events: GrowthEvent[]): DashboardData["sources"] {
  const usersBySource = new Map<string, Set<number>>();
  for (const event of events.filter((item) => item.event_name === "user_created")) {
    const users = usersBySource.get(event.source) ?? new Set<number>();
    users.add(event.telegram_user_id);
    usersBySource.set(event.source, users);
  }
  const stageUsers = (name: string) => userSet(events, name);
  const activated = stageUsers("domain_submitted");
  const unlocked = stageUsers("report_unlocked");
  const shared = stageUsers("share_generated");
  return [...usersBySource.entries()]
    .map(([source, users]) => ({
      source,
      newUsers: users.size,
      activated: intersectionSize(users, activated),
      unlocked: intersectionSize(users, unlocked),
      shared: intersectionSize(users, shared),
      activationRate: ratio(intersectionSize(users, activated), users.size),
    }))
    .sort((left, right) => right.newUsers - left.newUsers);
}

function buildTrend(events: GrowthEvent[], start: Date, end: Date, days: number): DashboardData["trend"] {
  const bucketCount = days === 1 ? 12 : Math.min(days, 30);
  const interval = Math.max(1, (end.getTime() - start.getTime()) / bucketCount);
  const buckets = Array.from({ length: bucketCount }, (_, index) => {
    const date = new Date(start.getTime() + interval * index);
    return {
      label: new Intl.DateTimeFormat("zh-CN", {
        timeZone: "Asia/Kuala_Lumpur",
        ...(days === 1 ? { hour: "2-digit", minute: "2-digit" } : { month: "2-digit", day: "2-digit" }),
      }).format(date),
      newUsers: new Set<number>(),
      toolUsers: new Set<number>(),
      unlocked: new Set<number>(),
      referrals: new Set<number>(),
    };
  });
  for (const event of events) {
    const index = Math.min(bucketCount - 1, Math.max(0, Math.floor((new Date(event.created_at).getTime() - start.getTime()) / interval)));
    const bucket = buckets[index];
    if (!bucket) continue;
    if (event.event_name === "user_created") bucket.newUsers.add(event.telegram_user_id);
    if (event.event_name === "domain_submitted") bucket.toolUsers.add(event.telegram_user_id);
    if (event.event_name === "report_unlocked") bucket.unlocked.add(event.telegram_user_id);
    if (event.event_name === "referral_opened" && event.metadata?.isNew === true) {
      bucket.referrals.add(event.telegram_user_id);
    }
  }
  return buckets.map((bucket) => ({
    label: bucket.label,
    newUsers: bucket.newUsers.size,
    toolUsers: bucket.toolUsers.size,
    unlocked: bucket.unlocked.size,
    referrals: bucket.referrals.size,
  }));
}

function userSet(events: GrowthEvent[], eventName: string): Set<number> {
  return new Set(events.filter((event) => event.event_name === eventName).map((event) => event.telegram_user_id));
}

function intersectionSize(left: Set<number>, right: Set<number>): number {
  let count = 0;
  for (const value of left) if (right.has(value)) count += 1;
  return count;
}

function metric(value: number, previous: number, format: Metric["format"], numerator?: number, denominator?: number): Metric {
  return { value, previous, format, numerator, denominator };
}

function ratio(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

function average(values: number[]): number {
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const middle = Math.floor(values.length / 2);
  return values.length % 2 ? (values[middle] ?? 0) : ((values[middle - 1] ?? 0) + (values[middle] ?? 0)) / 2;
}

function numericMetadata(event: GrowthEvent, key: string): number | null {
  const value = event.metadata?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function activityUnavailable(report: Record<string, unknown>): boolean {
  const dimensions = isRecord(report.dimensions) ? report.dimensions : null;
  const activity = dimensions && isRecord(dimensions.marketSignals) ? dimensions.marketSignals : null;
  return activity?.available === false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function emptyDashboard(range: RangeValue, now: Date): DashboardData {
  const zero = (format: Metric["format"]): Metric => ({ value: 0, previous: 0, format });
  return {
    configured: false,
    generatedAt: now.toISOString(),
    range,
    totals: {
      newUsers: zero("number"),
      toolUsers: zero("number"),
      unlockRate: zero("percent"),
      shareRate: zero("percent"),
      referredUsers: zero("number"),
      loopRate: zero("percent"),
    },
    funnel: ["New User", "Domain Submitted", "Preview Shown", "Report Unlocked", "Share Generated", "Referred New User"].map(
      (label, index) => ({ key: String(index), label, value: 0 }),
    ),
    gate: { shown: 0, failed: 0, unlocked: 0, conversionRate: 0, recoveryRate: 0 },
    trend: [],
    sources: [],
    quality: {
      reportCount: 0,
      averageScore: 0,
      lowConfidenceRate: 0,
      unavailableRate: 0,
      cachedRate: 0,
      failureRate: 0,
      medianDurationMs: 0,
    },
    recent: [],
  };
}
