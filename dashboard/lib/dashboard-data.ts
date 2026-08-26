import "server-only";
import { buildFollowUpInbox, type FollowUpEvent, type FollowUpInbox, type FollowUpProfile } from "@/lib/follow-up";

const CURRENT_REPORT_VERSION = "JUYU-EVIDENCE-3.1";

export const rangeOptions = [
  { value: "1d", label: "24H", days: 1 },
  { value: "7d", label: "7D", days: 7 },
  { value: "30d", label: "30D", days: 30 },
  { value: "90d", label: "90D", days: 90 },
] as const;

export type RangeValue = (typeof rangeOptions)[number]["value"];

type GrowthEvent = FollowUpEvent & {
  event_name: string;
  telegram_user_id: number;
  source: string;
  domain: string | null;
  report_token: string | null;
  intent: "owner" | "buyer" | "research" | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type ReportRow = {
  domain: string;
  report: Record<string, unknown>;
  created_at: string;
};

type CommerceLeadRow = {
  id: number;
  lead_type: "buy" | "sell" | "contact";
  telegram_user_id: number;
  data: Record<string, unknown> | null;
  status: string;
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
  followUp: FollowUpInbox;
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
  referral: {
    sharingUsers: number;
    sharedReports: number;
    openedUsers: number;
    newUsers: number;
    activatedUsers: number;
    unlockedUsers: number;
    openRate: number;
    activationRate: number;
    unlockRate: number;
    kFactor: number;
    topDomains: Array<{
      domain: string;
      opened: number;
      newUsers: number;
      activated: number;
    }>;
  };
  leads: {
    commerceConfigured: boolean;
    commerceError: string | null;
    commercialIntentUsers: number;
    buyerUsers: number;
    ownerUsers: number;
    handoffUsers: number;
    handoffRate: number;
    juchaUsers: number;
    juchaHandoffRate: number;
    submittedUsers: number;
    submittedLeads: number;
    completionRate: number;
    buyLeads: number;
    sellLeads: number;
    registerLeads: number;
    opportunities: Array<{
      domain: string;
      intent: "owner" | "buyer";
      action: "sell" | "buy" | "register";
      evidenceAvailable: number | null;
      evidenceTotal: number | null;
      registrationStatus: string | null;
      source: string;
      handedOff: boolean;
      submitted: boolean;
      leadStatus: string | null;
      priority: "high" | "medium" | "low";
      createdAt: string;
    }>;
    sources: Array<{
      source: string;
      intents: number;
      handoffs: number;
      submitted: number;
      handoffRate: number;
      completionRate: number;
    }>;
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
    authoritativeRate: number;
    registrationConfirmedRate: number;
    registryFallbackRate: number;
    registrationUnknownRate: number;
    cachedRate: number;
    failureRate: number;
    medianDurationMs: number;
    sources: Array<{
      name: string;
      type: string;
      reports: number;
      confirmed: number;
      successRate: number;
    }>;
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
  const commerceUrl = process.env.COMMERCE_SUPABASE_URL?.replace(/\/$/, "");
  const commerceKey = process.env.COMMERCE_SUPABASE_SECRET_KEY;
  const commerceConfigured = Boolean(commerceUrl && commerceKey);
  try {
    const commerceRead = commerceUrl && commerceKey
      ? readAll<CommerceLeadRow>(commerceUrl, commerceKey, "leads", {
          select: "id,lead_type,telegram_user_id,data,status,created_at",
          created_at: `gte.${currentStart.toISOString()}`,
          order: "created_at.asc",
        })
          .then((rows) => ({ rows, error: null as string | null }))
          .catch((error) => {
            console.error("Commerce leads load failed", error instanceof Error ? error.message : "unknown error");
            return { rows: [] as CommerceLeadRow[], error: "Commerce Supabase 暂时无法读取" };
          })
      : Promise.resolve({ rows: [] as CommerceLeadRow[], error: null as string | null });
    const profileRead = readAll<FollowUpProfile>(url, key, "user_profiles", {
      select: "telegram_user_id,telegram_username,telegram_first_name,telegram_last_name",
    }).catch(() => [] as FollowUpProfile[]);
    const [events, reports, profiles, commerce] = await Promise.all([
      readAll<GrowthEvent>(url, key, "growth_events", {
        select: "event_name,telegram_user_id,source,domain,report_token,intent,metadata,created_at",
        created_at: `gte.${queryStart.toISOString()}`,
        order: "created_at.asc",
      }),
      readAll<ReportRow>(url, key, "domain_reports", {
        select: "domain,report,created_at",
        created_at: `gte.${queryStart.toISOString()}`,
        order: "created_at.asc",
      }),
      profileRead,
      commerceRead,
    ]);
    return buildDashboard(
      range,
      option.days,
      now,
      currentStart,
      queryStart,
      events,
      reports,
      profiles,
      commerce.rows,
      commerceConfigured,
      commerce.error,
    );
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
  profiles: FollowUpProfile[],
  commerceLeads: CommerceLeadRow[],
  commerceConfigured: boolean,
  commerceError: string | null,
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
  const currentEvidenceReports = currentReports.filter((report) => reportVersion(report.report) === CURRENT_REPORT_VERSION);
  const previewEvents = current.filter((event) => event.event_name === "preview_shown");
  const durations = previewEvents
    .map((event) => numericMetadata(event, "durationMs"))
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b);

  return {
    configured: true,
    generatedAt: now.toISOString(),
    range,
    followUp: buildFollowUpInbox(current, now, profiles),
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
    referral: buildReferral(current),
    leads: buildLeads(current, commerceLeads, commerceConfigured, commerceError),
    trend: buildTrend(current, currentStart, now, days),
    sources: buildSources(current),
    quality: {
      reportCount: currentReports.length,
      authoritativeRate: ratio(
        currentEvidenceReports.filter((report) => registrationAuthoritative(report.report)).length,
        currentEvidenceReports.length,
      ),
      registrationConfirmedRate: ratio(
        currentEvidenceReports.filter((report) => registrationStatus(report.report) !== "unknown").length,
        currentEvidenceReports.length,
      ),
      registryFallbackRate: ratio(
        currentEvidenceReports.filter((report) => registrationSource(report.report) === "registry-whois").length,
        currentEvidenceReports.length,
      ),
      registrationUnknownRate: ratio(
        currentEvidenceReports.filter((report) => registrationStatus(report.report) === "unknown").length,
        currentEvidenceReports.length,
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
      sources: buildRegistrationSourceHealth(currentEvidenceReports),
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

function buildReferral(events: GrowthEvent[]): DashboardData["referral"] {
  const shareEvents = events.filter((event) => event.event_name === "share_generated");
  const openEvents = events.filter((event) => event.event_name === "referral_opened");
  const sharingUsers = new Set(shareEvents.map((event) => event.telegram_user_id));
  const sharedReports = new Set(shareEvents.map((event) => event.report_token).filter((token): token is string => Boolean(token)));
  const openedUsers = new Set(openEvents.map((event) => event.telegram_user_id));
  const openedSharedReports = new Set(
    openEvents
      .map((event) => event.report_token)
      .filter((token): token is string => typeof token === "string" && sharedReports.has(token)),
  );
  const newUsers = new Set(
    openEvents.filter((event) => event.metadata?.isNew === true).map((event) => event.telegram_user_id),
  );
  const submitted = userSet(events, "domain_submitted");
  const unlocked = userSet(events, "report_unlocked");
  const activatedUsers = intersectionSet(newUsers, submitted);
  const unlockedUsers = intersectionSet(activatedUsers, unlocked);
  const domainVisitors = new Map<string, { opened: Set<number>; newUsers: Set<number> }>();

  for (const event of openEvents) {
    if (!event.domain) continue;
    const visitors = domainVisitors.get(event.domain) ?? { opened: new Set<number>(), newUsers: new Set<number>() };
    visitors.opened.add(event.telegram_user_id);
    if (event.metadata?.isNew === true) visitors.newUsers.add(event.telegram_user_id);
    domainVisitors.set(event.domain, visitors);
  }

  return {
    sharingUsers: sharingUsers.size,
    sharedReports: sharedReports.size,
    openedUsers: openedUsers.size,
    newUsers: newUsers.size,
    activatedUsers: activatedUsers.size,
    unlockedUsers: unlockedUsers.size,
    openRate: ratio(openedSharedReports.size, sharedReports.size),
    activationRate: ratio(activatedUsers.size, newUsers.size),
    unlockRate: ratio(unlockedUsers.size, activatedUsers.size),
    kFactor: ratio(newUsers.size, sharingUsers.size),
    topDomains: [...domainVisitors.entries()]
      .map(([domain, visitors]) => ({
        domain,
        opened: visitors.opened.size,
        newUsers: visitors.newUsers.size,
        activated: intersectionSize(visitors.newUsers, submitted),
      }))
      .sort((left, right) => right.opened - left.opened || right.newUsers - left.newUsers)
      .slice(0, 5),
  };
}

function buildLeads(
  events: GrowthEvent[],
  commerceLeads: CommerceLeadRow[],
  commerceConfigured: boolean,
  commerceError: string | null,
): DashboardData["leads"] {
  const intentEvents = events.filter(
    (event) => event.event_name === "intent_selected" && (event.intent === "owner" || event.intent === "buyer"),
  );
  const handoffEvents = events.filter((event) => event.event_name === "commerce_handoff");
  const intentUsers = new Set([...intentEvents, ...handoffEvents].map((event) => event.telegram_user_id));
  const buyerUsers = new Set([...intentEvents, ...handoffEvents].filter((event) => event.intent === "buyer").map((event) => event.telegram_user_id));
  const ownerUsers = new Set([...intentEvents, ...handoffEvents].filter((event) => event.intent === "owner").map((event) => event.telegram_user_id));
  const handoffUsers = new Set(handoffEvents.map((event) => event.telegram_user_id));
  const unlockedUsers = new Set(events.filter((event) => event.event_name === "report_unlocked").map((event) => event.telegram_user_id));
  const juchaUsers = new Set(events.filter((event) => event.event_name === "jucha_handoff").map((event) => event.telegram_user_id));
  const checkBotLeads = commerceLeads.filter((lead) => {
    const source = stringData(lead.data, "source");
    const handoffSource = stringData(lead.data, "handoff_source");
    return source === "juyu_check_bot" || handoffSource === "juyu_check_bot";
  });
  const submittedUsers = new Set(checkBotLeads.map((lead) => lead.telegram_user_id));
  const completedHandoffUsers = intersectionSet(handoffUsers, submittedUsers);
  const commerceByUserDomain = new Map<string, CommerceLeadRow>();
  for (const lead of checkBotLeads) {
    const domain = stringData(lead.data, "domain");
    if (!domain) continue;
    const key = `${lead.telegram_user_id}:${domain}`;
    const existing = commerceByUserDomain.get(key);
    if (!existing || new Date(lead.created_at) > new Date(existing.created_at)) commerceByUserDomain.set(key, lead);
  }
  const handoffByToken = new Map(
    handoffEvents.filter((event) => event.report_token).map((event) => [event.report_token as string, event]),
  );
  const previewByToken = new Map(
    events
      .filter((event) => event.event_name === "preview_shown" && event.report_token)
      .map((event) => [event.report_token as string, event]),
  );
  const opportunities = new Map<string, DashboardData["leads"]["opportunities"][number]>();

  for (const event of intentEvents) {
    if (!event.report_token || !event.domain || (event.intent !== "owner" && event.intent !== "buyer")) continue;
    const handoff = handoffByToken.get(event.report_token);
    const preview = previewByToken.get(event.report_token);
    const evidenceEvent = handoff ?? preview ?? event;
    const evidenceAvailable = numericMetadata(evidenceEvent, "evidenceAvailable");
    const evidenceTotal = numericMetadata(evidenceEvent, "evidenceTotal");
    const registrationStatusValue = evidenceEvent.metadata?.registrationStatus;
    const action = leadAction(event.intent, handoff?.metadata?.action, handoff?.metadata?.registrationStatus);
    const submittedLead = commerceByUserDomain.get(`${event.telegram_user_id}:${event.domain}`);
    opportunities.set(event.report_token, {
      domain: event.domain,
      intent: event.intent,
      action,
      evidenceAvailable,
      evidenceTotal,
      registrationStatus: typeof registrationStatusValue === "string" ? registrationStatusValue : null,
      source: event.source,
      handedOff: Boolean(handoff),
      submitted: Boolean(submittedLead),
      leadStatus: submittedLead?.status ?? null,
      priority: leadPriority(event.intent, Boolean(handoff), Boolean(submittedLead)),
      createdAt: submittedLead?.created_at ?? handoff?.created_at ?? event.created_at,
    });
  }

  for (const event of handoffEvents) {
    if (!event.report_token || opportunities.has(event.report_token) || !event.domain || (event.intent !== "owner" && event.intent !== "buyer")) continue;
    const evidenceAvailable = numericMetadata(event, "evidenceAvailable");
    const evidenceTotal = numericMetadata(event, "evidenceTotal");
    const registrationStatusValue = event.metadata?.registrationStatus;
    const submittedLead = commerceByUserDomain.get(`${event.telegram_user_id}:${event.domain}`);
    opportunities.set(event.report_token, {
      domain: event.domain,
      intent: event.intent,
      action: leadAction(event.intent, event.metadata?.action, event.metadata?.registrationStatus),
      evidenceAvailable,
      evidenceTotal,
      registrationStatus: typeof registrationStatusValue === "string" ? registrationStatusValue : null,
      source: event.source,
      handedOff: true,
      submitted: Boolean(submittedLead),
      leadStatus: submittedLead?.status ?? null,
      priority: leadPriority(event.intent, true, Boolean(submittedLead)),
      createdAt: submittedLead?.created_at ?? event.created_at,
    });
  }

  const sourceMap = new Map<string, { intentUsers: Set<number>; handoffUsers: Set<number>; submittedUsers: Set<number> }>();
  for (const event of [...intentEvents, ...handoffEvents]) {
    const item = sourceMap.get(event.source) ?? {
      intentUsers: new Set<number>(),
      handoffUsers: new Set<number>(),
      submittedUsers: new Set<number>(),
    };
    if (event.event_name === "intent_selected") item.intentUsers.add(event.telegram_user_id);
    if (event.event_name === "commerce_handoff") {
      item.intentUsers.add(event.telegram_user_id);
      item.handoffUsers.add(event.telegram_user_id);
      if (submittedUsers.has(event.telegram_user_id)) item.submittedUsers.add(event.telegram_user_id);
    }
    sourceMap.set(event.source, item);
  }

  return {
    commerceConfigured,
    commerceError,
    commercialIntentUsers: intentUsers.size,
    buyerUsers: buyerUsers.size,
    ownerUsers: ownerUsers.size,
    handoffUsers: handoffUsers.size,
    handoffRate: ratio(handoffUsers.size, intentUsers.size),
    juchaUsers: juchaUsers.size,
    juchaHandoffRate: ratio(juchaUsers.size, unlockedUsers.size),
    submittedUsers: submittedUsers.size,
    submittedLeads: checkBotLeads.length,
    completionRate: ratio(completedHandoffUsers.size, handoffUsers.size),
    buyLeads: checkBotLeads.filter((lead) => lead.lead_type === "buy" && stringData(lead.data, "service") !== "register").length,
    sellLeads: checkBotLeads.filter((lead) => lead.lead_type === "sell").length,
    registerLeads: checkBotLeads.filter((lead) => stringData(lead.data, "service") === "register").length,
    opportunities: [...opportunities.values()]
      .sort((left, right) => leadPriorityRank(right.priority) - leadPriorityRank(left.priority) || new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      .slice(0, 12),
    sources: [...sourceMap.entries()]
      .map(([source, value]) => ({
        source,
        intents: value.intentUsers.size,
        handoffs: value.handoffUsers.size,
        submitted: value.submittedUsers.size,
        handoffRate: ratio(value.handoffUsers.size, value.intentUsers.size),
        completionRate: ratio(value.submittedUsers.size, value.handoffUsers.size),
      }))
      .sort((left, right) => right.handoffs - left.handoffs || right.intents - left.intents),
  };
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

function intersectionSet(left: Set<number>, right: Set<number>): Set<number> {
  return new Set([...left].filter((value) => right.has(value)));
}

function leadAction(
  intent: "owner" | "buyer",
  metadataAction: unknown,
  registrationStatus: unknown,
): "sell" | "buy" | "register" {
  if (intent === "owner") return "sell";
  if (metadataAction === "register" || registrationStatus === "available") return "register";
  return "buy";
}

function leadPriority(
  intent: "owner" | "buyer",
  handedOff: boolean,
  submitted: boolean,
): "high" | "medium" | "low" {
  const points = (submitted ? 4 : handedOff ? 3 : 0) + (intent === "buyer" ? 2 : 1);
  if (points >= 5) return "high";
  if (points >= 3) return "medium";
  return "low";
}

function leadPriorityRank(priority: "high" | "medium" | "low"): number {
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  return 1;
}

function metric(value: number, previous: number, format: Metric["format"], numerator?: number, denominator?: number): Metric {
  return { value, previous, format, numerator, denominator };
}

function ratio(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
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

function stringData(data: Record<string, unknown> | null, key: string): string {
  const value = data?.[key];
  return typeof value === "string" ? value : "";
}

function registrationStatus(report: Record<string, unknown>): string {
  const rdap = isRecord(report.rdap) ? report.rdap : null;
  return typeof rdap?.status === "string" ? rdap.status : "unknown";
}

function reportVersion(report: Record<string, unknown>): string {
  return typeof report.reportVersion === "string" ? report.reportVersion : "";
}

function registrationSource(report: Record<string, unknown>): string {
  const rdap = isRecord(report.rdap) ? report.rdap : null;
  const source = rdap && isRecord(rdap.source) ? rdap.source : null;
  return typeof source?.type === "string" ? source.type : "unavailable";
}

function registrationAuthoritative(report: Record<string, unknown>): boolean {
  const rdap = isRecord(report.rdap) ? report.rdap : null;
  const source = rdap && isRecord(rdap.source) ? rdap.source : null;
  return source?.authoritative === true;
}

function registrationSourceName(report: Record<string, unknown>): string {
  const rdap = isRecord(report.rdap) ? report.rdap : null;
  const source = rdap && isRecord(rdap.source) ? rdap.source : null;
  return typeof source?.name === "string" ? source.name : "暂未取得注册资料";
}

function buildRegistrationSourceHealth(reports: ReportRow[]): DashboardData["quality"]["sources"] {
  const grouped = new Map<string, { type: string; reports: number; confirmed: number }>();
  for (const report of reports) {
    const name = registrationSourceName(report.report);
    const item = grouped.get(name) ?? { type: registrationSource(report.report), reports: 0, confirmed: 0 };
    item.reports += 1;
    if (registrationStatus(report.report) !== "unknown") item.confirmed += 1;
    grouped.set(name, item);
  }
  return [...grouped.entries()]
    .map(([name, item]) => ({ ...item, name, successRate: ratio(item.confirmed, item.reports) }))
    .sort((a, b) => b.reports - a.reports || a.name.localeCompare(b.name));
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
    followUp: buildFollowUpInbox([], now),
    totals: {
      newUsers: zero("number"),
      toolUsers: zero("number"),
      unlockRate: zero("percent"),
      shareRate: zero("percent"),
      referredUsers: zero("number"),
      loopRate: zero("percent"),
    },
    funnel: [
      { key: "new", label: "New User", value: 0 },
      { key: "submitted", label: "Domain Submitted", value: 0 },
      { key: "preview", label: "Preview Shown", value: 0 },
      { key: "unlocked", label: "Report Unlocked", value: 0 },
      { key: "shared", label: "Share Generated", value: 0 },
      { key: "referred", label: "Referred New User", value: 0 },
    ],
    gate: { shown: 0, failed: 0, unlocked: 0, conversionRate: 0, recoveryRate: 0 },
    referral: {
      sharingUsers: 0,
      sharedReports: 0,
      openedUsers: 0,
      newUsers: 0,
      activatedUsers: 0,
      unlockedUsers: 0,
      openRate: 0,
      activationRate: 0,
      unlockRate: 0,
      kFactor: 0,
      topDomains: [],
    },
    leads: {
      commerceConfigured: false,
      commerceError: null,
      commercialIntentUsers: 0,
      buyerUsers: 0,
      ownerUsers: 0,
      handoffUsers: 0,
      handoffRate: 0,
      juchaUsers: 0,
      juchaHandoffRate: 0,
      submittedUsers: 0,
      submittedLeads: 0,
      completionRate: 0,
      buyLeads: 0,
      sellLeads: 0,
      registerLeads: 0,
      opportunities: [],
      sources: [],
    },
    trend: [],
    sources: [],
    quality: {
      reportCount: 0,
      authoritativeRate: 0,
      registrationConfirmedRate: 0,
      registryFallbackRate: 0,
      registrationUnknownRate: 0,
      cachedRate: 0,
      failureRate: 0,
      medianDurationMs: 0,
      sources: [],
    },
    recent: [],
  };
}
