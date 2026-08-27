export type FollowUpIntent = "owner" | "buyer" | "research" | null;

export type FollowUpEvent = {
  event_name: string;
  telegram_user_id: number;
  source: string;
  domain: string | null;
  report_token: string | null;
  intent: FollowUpIntent;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type FollowUpTimelineItem = {
  event: string;
  source: string;
  domain: string | null;
  intent: FollowUpIntent;
  createdAt: string;
  metadata: Record<string, unknown>;
};

export type FollowUpProfile = {
  telegram_user_id: number;
  telegram_username: string | null;
  telegram_first_name: string | null;
  telegram_last_name: string | null;
};

export type FollowUpItem = {
  telegramUserId: number;
  username: string | null;
  displayName: string | null;
  domain: string | null;
  domains: string[];
  intent: FollowUpIntent;
  blocker: string;
  blockerCode: "unlock_failed" | "verification_unavailable" | "check_failed" | "commercial_follow_up" | "limited_evidence" | "incomplete" | "resolved" | "active";
  priority: "high" | "medium" | "low";
  source: string;
  firstSeenAt: string;
  lastSeenAt: string;
  lastEvent: string;
  reportToken: string | null;
  evidenceAvailable: number | null;
  evidenceTotal: number | null;
  durationMs: number | null;
  timeline: FollowUpTimelineItem[];
};

export type FollowUpInbox = {
  summary: {
    total: number;
    newToday: number;
    unlockFailed: number;
    commercialIntent: number;
    verificationUnavailable: number;
  };
  items: FollowUpItem[];
};

const priorityRank = { high: 3, medium: 2, low: 1 } as const;

export function buildFollowUpInbox(events: FollowUpEvent[], now = new Date(), profiles: FollowUpProfile[] = []): FollowUpInbox {
  const byUser = new Map<number, FollowUpEvent[]>();
  const profilesByUser = new Map(profiles.map((profile) => [profile.telegram_user_id, profile]));
  for (const item of events) {
    const userEvents = byUser.get(item.telegram_user_id) ?? [];
    userEvents.push(item);
    byUser.set(item.telegram_user_id, userEvents);
  }

  const items = [...byUser.entries()].map(([telegramUserId, unsortedEvents]) => {
    const userEvents = [...unsortedEvents].sort((left, right) => dateValue(left.created_at) - dateValue(right.created_at));
    const latest = userEvents[userEvents.length - 1] as FollowUpEvent;
    const latestDomainEvent = findLast(userEvents, (item) => Boolean(item.domain));
    const latestIntentEvent = findLast(userEvents, (item) => Boolean(item.intent));
    const latestPreview = findLast(userEvents, (item) => item.event_name === "preview_shown");
    const domains = [...new Set(userEvents.map((item) => item.domain).filter((domain): domain is string => Boolean(domain)))];
    const blocker = resolveBlocker(userEvents, latestIntentEvent?.intent ?? null, latestPreview);
    const profile = profilesByUser.get(telegramUserId);

    return {
      telegramUserId,
      username: cleanUsername(profile?.telegram_username),
      displayName: telegramDisplayName(profile),
      domain: latestDomainEvent?.domain ?? null,
      domains,
      intent: latestIntentEvent?.intent ?? null,
      ...blocker,
      source: latest.source || "direct",
      firstSeenAt: userEvents[0]?.created_at ?? latest.created_at,
      lastSeenAt: latest.created_at,
      lastEvent: latest.event_name,
      reportToken: latestDomainEvent?.report_token ?? latest.report_token ?? null,
      evidenceAvailable: numberMetadata(latestPreview, "evidenceAvailable"),
      evidenceTotal: numberMetadata(latestPreview, "evidenceTotal"),
      durationMs: numberMetadata(latestPreview, "durationMs"),
      timeline: userEvents.slice(-12).map((item) => ({
        event: item.event_name,
        source: item.source,
        domain: item.domain,
        intent: item.intent,
        createdAt: item.created_at,
        metadata: item.metadata ?? {},
      })),
    } satisfies FollowUpItem;
  });

  items.sort(
    (left, right) =>
      priorityRank[right.priority] - priorityRank[left.priority]
      || dateValue(right.lastSeenAt) - dateValue(left.lastSeenAt),
  );

  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);

  return {
    summary: {
      total: items.filter((item) => item.priority !== "low").length,
      newToday: items.filter((item) => dateValue(item.firstSeenAt) >= dayStart.getTime()).length,
      unlockFailed: items.filter((item) => item.blockerCode === "unlock_failed").length,
      commercialIntent: items.filter((item) => item.blockerCode === "commercial_follow_up").length,
      verificationUnavailable: items.filter((item) => item.blockerCode === "verification_unavailable").length,
    },
    items,
  };
}

function cleanUsername(value: string | null | undefined): string | null {
  const cleaned = value?.trim().replace(/^@/, "");
  return cleaned || null;
}

function telegramDisplayName(profile: FollowUpProfile | undefined): string | null {
  const name = [profile?.telegram_first_name, profile?.telegram_last_name]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(" ");
  return name || null;
}

function resolveBlocker(
  events: FollowUpEvent[],
  intent: FollowUpIntent,
  latestPreview: FollowUpEvent | undefined,
): Pick<FollowUpItem, "blocker" | "blockerCode" | "priority"> {
  const failed = findLast(events, (item) => item.event_name === "unlock_failed");
  if (failed && !hasLaterResolution(events, failed, "report_unlocked")) {
    return { blocker: "解锁失败", blockerCode: "unlock_failed", priority: "high" };
  }

  const unavailable = findLast(events, (item) => item.event_name === "verification_unavailable");
  if (unavailable && !hasLaterResolution(events, unavailable, "report_unlocked")) {
    return { blocker: "验证不可用", blockerCode: "verification_unavailable", priority: "high" };
  }

  const checkFailed = findLast(events, (item) => item.event_name === "check_failed");
  const previewAfterFailure = checkFailed && events.some(
    (item) => item.event_name === "preview_shown" && dateValue(item.created_at) > dateValue(checkFailed.created_at),
  );
  if (checkFailed && !previewAfterFailure) {
    return { blocker: "体检失败", blockerCode: "check_failed", priority: "high" };
  }

  const leadStarted = findLast(events, (item) => item.event_name === "lead_started");
  const leadSubmitted = findLast(events, (item) => item.event_name === "lead_submitted");
  if (leadSubmitted && (!leadStarted || dateValue(leadSubmitted.created_at) >= dateValue(leadStarted.created_at))) {
    const action = stringMetadata(leadSubmitted, "action");
    const label = action === "sell" ? "出售需求已提交" : action === "register" ? "注册需求已提交" : action === "contact" ? "咨询已提交" : "购买需求已提交";
    return { blocker: label, blockerCode: "resolved", priority: "low" };
  }
  if (leadStarted) {
    const resolved = events.some((item) =>
      (item.event_name === "lead_submitted" || item.event_name === "lead_cancelled")
      && dateValue(item.created_at) > dateValue(leadStarted.created_at),
    );
    if (!resolved) {
      const action = stringMetadata(leadStarted, "action");
      const label = action === "sell" ? "出售资料尚未填完" : action === "register" ? "注册资料尚未填完" : action === "contact" ? "咨询资料尚未填完" : "购买资料尚未填完";
      return { blocker: label, blockerCode: "commercial_follow_up", priority: "high" };
    }
  }

  const intentSelected = findLast(events, (item) => item.event_name === "intent_selected" && (item.intent === "buyer" || item.intent === "owner"));
  const handoffAfterIntent = intentSelected && events.some(
    (item) => item.event_name === "commerce_handoff" && dateValue(item.created_at) >= dateValue(intentSelected.created_at),
  );
  if (intentSelected && !handoffAfterIntent) {
    return {
      blocker: intent === "buyer" ? "买家等待跟进" : "卖家等待跟进",
      blockerCode: "commercial_follow_up",
      priority: intent === "buyer" ? "high" : "medium",
    };
  }

  const available = numberMetadata(latestPreview, "evidenceAvailable");
  const total = numberMetadata(latestPreview, "evidenceTotal");
  if (available !== null && total !== null && available < total) {
    return { blocker: "资料不足", blockerCode: "limited_evidence", priority: "medium" };
  }

  if (events.some((item) => item.event_name === "report_unlocked")) {
    return { blocker: "已完成解锁", blockerCode: "resolved", priority: "low" };
  }

  if (events.some((item) => item.event_name === "domain_submitted")) {
    return { blocker: "尚未完成体检", blockerCode: "incomplete", priority: "medium" };
  }

  return { blocker: "暂无阻塞", blockerCode: "active", priority: "low" };
}

function hasLaterResolution(events: FollowUpEvent[], problem: FollowUpEvent, resolutionName: string): boolean {
  return events.some((item) => {
    if (item.event_name !== resolutionName || dateValue(item.created_at) <= dateValue(problem.created_at)) return false;
    if (!problem.report_token) return true;
    return item.report_token === problem.report_token;
  });
}

function findLast(events: FollowUpEvent[], predicate: (item: FollowUpEvent) => boolean): FollowUpEvent | undefined {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const item = events[index];
    if (item && predicate(item)) return item;
  }
  return undefined;
}

function numberMetadata(event: FollowUpEvent | undefined, key: string): number | null {
  const value = event?.metadata?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringMetadata(event: FollowUpEvent | undefined, key: string): string | null {
  const value = event?.metadata?.[key];
  return typeof value === "string" && value ? value : null;
}

function dateValue(value: string): number {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}
