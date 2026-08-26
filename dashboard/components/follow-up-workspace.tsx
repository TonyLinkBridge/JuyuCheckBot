"use client";

import {
  AlertCircle,
  ArrowRight,
  Check,
  ChevronRight,
  CircleUserRound,
  Clipboard,
  Clock3,
  Command,
  ExternalLink,
  Filter,
  Search,
  Send,
  ShieldAlert,
  Sparkles,
  UserRoundSearch,
  Users,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { DashboardData } from "@/lib/dashboard-data";
import { getDashboardSection, type DashboardSectionId } from "@/lib/dashboard-sections";
import type { FollowUpItem } from "@/lib/follow-up";
import { sourceLabel } from "@/lib/source-label";
import { telegramContactUrl } from "@/lib/telegram-contact";
import { cn } from "@/lib/utils";

type InboxFilter = "all" | "high" | "unlock" | "commercial";

const filterOptions: Array<{ value: InboxFilter; label: string }> = [
  { value: "all", label: "全部" },
  { value: "high", label: "高优先级" },
  { value: "unlock", label: "解锁／验证失败" },
  { value: "commercial", label: "买卖意向" },
];

const eventLabels: Record<string, string> = {
  bot_started: "启动 Bot",
  user_created: "首次进入",
  domain_submitted: "提交域名",
  preview_shown: "查看体检预览",
  intent_selected: "选择意图",
  gate_shown: "进入解锁页面",
  unlock_failed: "解锁失败",
  verification_unavailable: "验证不可用",
  report_unlocked: "解锁完整报告",
  share_generated: "生成分享卡",
  commerce_handoff: "进入聚域助手",
  jucha_handoff: "进入聚查",
  check_failed: "体检失败",
  history_viewed: "查看历史报告",
};

const intentLabels = { buyer: "买家", owner: "持有人", research: "研究" } as const;

export function FollowUpWorkspace({ data, activeSection }: { data: DashboardData; activeSection: DashboardSectionId }) {
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(data.followUp.items[0]?.telegramUserId ?? null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return data.followUp.items.filter((item) => {
      if (filter === "high" && item.priority !== "high") return false;
      if (filter === "unlock" && item.blockerCode !== "unlock_failed" && item.blockerCode !== "verification_unavailable") return false;
      if (filter === "commercial" && item.intent !== "buyer" && item.intent !== "owner") return false;
      if (!normalized) return true;
      return [String(item.telegramUserId), item.username ?? "", item.displayName ?? "", item.domain ?? "", item.blocker, item.source, ...item.domains]
        .some((value) => value.toLowerCase().includes(normalized));
    });
  }, [data.followUp.items, filter, query]);

  const selected = data.followUp.items.find((item) => item.telegramUserId === selectedId) ?? filtered[0] ?? null;
  const events = useMemo(
    () => data.followUp.items
      .flatMap((item) => item.timeline.map((event) => ({ ...event, telegramUserId: item.telegramUserId })))
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      .slice(0, 24),
    [data.followUp.items],
  );

  async function copyId(item: FollowUpItem) {
    await navigator.clipboard.writeText(String(item.telegramUserId));
    setCopiedId(item.telegramUserId);
    window.setTimeout(() => setCopiedId((current) => current === item.telegramUserId ? null : current), 1600);
  }

  const section = getDashboardSection(activeSection);
  const hasUserDetail = activeSection === "inbox" || activeSection === "users" || activeSection === "activity";

  const userTable = (
    <section className="ops-panel inbox-panel">
      <div className="ops-panel-header inbox-toolbar">
        <div className="filter-tabs" role="tablist" aria-label="跟进筛选">
          {filterOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={filter === option.value}
              className={cn(filter === option.value && "active")}
              onClick={() => setFilter(option.value)}
            >
              {option.label}
              <span>{filterCount(option.value, data.followUp.items)}</span>
            </button>
          ))}
        </div>
        <div className="inbox-result-count"><Filter size={13} /> {filtered.length} 位用户</div>
      </div>

      <div className="inbox-table-wrap">
        <table className="inbox-table">
          <thead>
            <tr>
              <th>优先级</th><th>Telegram 用户</th><th>最近域名</th><th>意图</th><th>当前状态</th><th>最后活动</th><th><span className="sr-only">操作</span></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length ? filtered.slice(0, activeSection === "users" ? 50 : 12).map((item) => (
              <tr key={item.telegramUserId} className={cn(selected?.telegramUserId === item.telegramUserId && "selected")} onClick={() => setSelectedId(item.telegramUserId)}>
                <td><PriorityBadge priority={item.priority} /></td>
                <td><button type="button" className="user-cell" onClick={() => setSelectedId(item.telegramUserId)}><strong>{item.username ? `@${item.username}` : item.displayName ?? item.telegramUserId}</strong><small>ID {item.telegramUserId} · {sourceLabel(item.source)}</small></button></td>
                <td><span className="domain-value">{item.domain ?? "—"}</span></td>
                <td>{item.intent ? <span className={cn("intent-chip", `intent-${item.intent}`)}>{intentLabels[item.intent]}</span> : <span className="muted-value">未选择</span>}</td>
                <td><span className={cn("blocker-value", item.priority === "high" && "is-urgent")}>{item.blocker}</span></td>
                <td><span className="relative-time">{relativeTime(item.lastSeenAt)}</span></td>
                <td><button type="button" className="follow-button" onClick={() => setSelectedId(item.telegramUserId)}>查看 <ChevronRight size={13} /></button></td>
              </tr>
            )) : <tr><td colSpan={7} className="inbox-empty">没有符合当前条件的用户。</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );

  return (
    <div className={cn("ops-layout", !hasUserDetail && "ops-layout-wide")}>
      <div className="ops-canvas">
        <section className="ops-hero">
          <div>
            <p className="ops-eyebrow">{section.eyebrow}</p>
            <h1>{section.label}</h1>
            <span>{section.description}</span>
          </div>
          {activeSection === "inbox" || activeSection === "users" ? (
            <label className="command-search" htmlFor="ops-search">
              <Search size={15} aria-hidden="true" />
              <input id="ops-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索 Telegram ID、域名或问题…" />
              {query ? <button type="button" onClick={() => setQuery("")} aria-label="清除搜索"><X size={14} /></button> : <kbd><Command size={11} /> K</kbd>}
            </label>
          ) : null}
        </section>

        {activeSection === "inbox" ? <>
          <section className="ops-metric-grid" aria-label="跟进摘要">
            <SummaryCard label="待跟进" value={data.followUp.summary.total} detail="高、中优先级用户" icon={UserRoundSearch} tone="brand" />
            <SummaryCard label="今日新增" value={data.followUp.summary.newToday} detail="今天首次出现" icon={Users} />
            <SummaryCard label="解锁失败" value={data.followUp.summary.unlockFailed} detail="尚未恢复" icon={ShieldAlert} tone="red" />
            <SummaryCard label="买卖意向" value={data.followUp.summary.commercialIntent} detail="尚未进入商业流程" icon={Sparkles} tone="amber" />
          </section>
          {userTable}
        </> : null}

        {activeSection === "users" ? userTable : null}

        {activeSection === "funnel" ? <section className="ops-section ops-page-section">
          <div className="funnel-strip">
            {data.funnel.map((stage, index) => {
              const previous = data.funnel[index - 1]?.value ?? stage.value;
              const rate = previous > 0 ? stage.value / previous : 0;
              return (
                <div className="funnel-step" key={stage.key}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <strong>{funnelLabel(stage.key)}</strong>
                  <b>{stage.value}</b>
                  {index > 0 ? <small>{formatPercent(rate)} of previous</small> : <small>周期内新用户</small>}
                  {index < data.funnel.length - 1 ? <ArrowRight size={15} aria-hidden="true" /> : null}
                </div>
              );
            })}
          </div>
        </section> : null}

        {activeSection === "sources" ? <section className="ops-section ops-page-section">
          <div className="ops-panel compact-table-panel">
            <table className="compact-ops-table">
              <thead><tr><th>来源</th><th>新用户</th><th>提交域名</th><th>解锁</th><th>激活率</th></tr></thead>
              <tbody>
                {data.sources.length ? data.sources.map((item) => (
                  <tr key={item.source}>
                    <td><span className="source-cell"><strong>{sourceLabel(item.source)}</strong><small>{item.source}</small></span></td>
                    <td>{item.newUsers}</td><td>{item.activated}</td><td>{item.unlocked}</td><td>{formatPercent(item.activationRate)}</td>
                  </tr>
                )) : <tr><td colSpan={5} className="compact-empty-row">当前周期暂无来源数据。</td></tr>}
              </tbody>
            </table>
          </div>
        </section> : null}

        {activeSection === "quality" ? <section className="ops-section ops-page-section quality-page-grid">
          <div className="quality-summary-panel">
            <QualityLine label="权威注册资料" value={formatPercent(data.quality.authoritativeRate)} status={data.quality.authoritativeRate >= .8 ? "good" : "warn"} />
            <QualityLine label="注册状态确认" value={formatPercent(data.quality.registrationConfirmedRate)} status={data.quality.registrationConfirmedRate >= .8 ? "good" : "warn"} />
            <QualityLine label="注册资料未知" value={formatPercent(data.quality.registrationUnknownRate)} status={data.quality.registrationUnknownRate <= .2 ? "good" : "bad"} />
            <QualityLine label="体检失败率" value={formatPercent(data.quality.failureRate)} status={data.quality.failureRate <= .1 ? "good" : "bad"} />
            <QualityLine label="中位响应时间" value={data.quality.medianDurationMs ? `${(data.quality.medianDurationMs / 1000).toFixed(1)}s` : "—"} status={data.quality.medianDurationMs <= 8000 ? "good" : "warn"} />
          </div>
          <div className="ops-panel quality-explainer">
            <p>QUALITY STANDARD</p>
            <h2>只把可验证的数据展示给用户</h2>
            <span>注册局 RDAP、辅助 WHOIS 与实时 DNS 分别标示来源；无法确认的项目不会包装成评分。</span>
          </div>
        </section> : null}

        {activeSection === "activity" ? <section className="ops-section ops-page-section">
            <div className="ops-panel compact-table-panel">
              <table className="event-table">
                <thead><tr><th>事件</th><th>Telegram ID</th><th>域名</th><th>意图</th><th>来源</th><th>时间</th></tr></thead>
                <tbody>
                  {events.length ? events.map((event, index) => (
                    <tr key={`${event.telegramUserId}-${event.createdAt}-${event.event}-${index}`}>
                      <td><span className={cn("event-name", event.event.includes("failed") && "error")}><i />{eventLabels[event.event] ?? event.event}</span></td>
                      <td><button type="button" className="id-link" onClick={() => setSelectedId(event.telegramUserId)}>{event.telegramUserId}</button></td>
                      <td>{event.domain ?? "—"}</td><td>{event.intent ? intentLabels[event.intent] : "—"}</td><td>{sourceLabel(event.source)}</td><td>{formatTime(event.createdAt)}</td>
                    </tr>
                  )) : <tr><td colSpan={6} className="compact-empty-row">当前周期暂无活动。</td></tr>}
                </tbody>
              </table>
            </div>
        </section> : null}

        {activeSection === "settings" ? <section className="ops-section ops-page-section system-strip">
          <div><span className="system-dot" /> <strong>系统运行正常</strong><small>数据更新时间 {formatDateTime(data.generatedAt)}</small></div>
          <div><span>Bot</span><strong>@JuyuCheckBot</strong></div>
          <div><span>数据来源</span><strong>Supabase · Server-side</strong></div>
        </section> : null}
      </div>

      {hasUserDetail ? <aside className="user-detail-panel" aria-label="用户详情">
        {selected ? (
          <>
            <div className="detail-header">
              <div><p>用户详情</p><span>ADMIN ONLY</span></div>
              <CircleUserRound size={18} aria-hidden="true" />
            </div>
            <div className="detail-identity">
              <div className="detail-avatar"><Send size={22} /></div>
              <strong>{selected.username ? `@${selected.username}` : selected.displayName ?? selected.telegramUserId}</strong>
              <span>{selected.displayName && selected.username ? `${selected.displayName} · ` : ""}ID {selected.telegramUserId}</span>
              <small>{selected.intent ? `${intentLabels[selected.intent]}意向` : "尚未选择意图"} · {selected.priority === "high" ? "高优先级" : selected.priority === "medium" ? "中优先级" : "低优先级"}</small>
            </div>
            <div className="detail-actions">
              <a href={telegramContactUrl(selected)} target={selected.username ? "_blank" : undefined} rel={selected.username ? "noreferrer" : undefined}><ExternalLink size={14} /> {selected.username ? `打开 @${selected.username}` : "尝试按 ID 打开"}</a>
              <button type="button" onClick={() => copyId(selected)}>{copiedId === selected.telegramUserId ? <Check size={14} /> : <Clipboard size={14} />}{copiedId === selected.telegramUserId ? "已复制" : "复制 ID"}</button>
            </div>
            {!selected.username ? <p className="profile-open-note">该用户没有公开 @username；Telegram 是否允许按数字 ID 打开，取决于对方的隐私设置。</p> : null}

            <DetailSection title="基本信息">
              <DetailRow label="来源" value={sourceLabel(selected.source)} />
              <DetailRow label="首次出现" value={formatDateTime(selected.firstSeenAt)} />
              <DetailRow label="最后活动" value={formatDateTime(selected.lastSeenAt)} />
              <DetailRow label="当前问题" value={selected.blocker} tone={selected.priority === "high" ? "danger" : undefined} />
              <DetailRow label="已查域名" value={`${selected.domains.length} 个`} />
              <div className="domain-tags">{selected.domains.slice(0, 5).map((domain) => <span key={domain}>{domain}</span>)}</div>
            </DetailSection>

            <DetailSection title="事件时间线">
              <div className="detail-timeline">
                {[...selected.timeline].reverse().map((event, index) => (
                  <div className={cn(event.event.includes("failed") || event.event === "verification_unavailable" ? "is-error" : "")} key={`${event.event}-${event.createdAt}-${index}`}>
                    <time>{formatClock(event.createdAt)}</time>
                    <span />
                    <p><strong>{eventLabels[event.event] ?? event.event}</strong><small>{event.domain ?? (event.intent ? intentLabels[event.intent] : sourceLabel(event.source))}</small></p>
                  </div>
                ))}
              </div>
            </DetailSection>

            <DetailSection title="体检线索">
              <DetailRow label="证据覆盖" value={selected.evidenceTotal ? `${selected.evidenceAvailable ?? 0}/${selected.evidenceTotal}` : "暂无"} />
              <DetailRow label="最近耗时" value={selected.durationMs ? `${(selected.durationMs / 1000).toFixed(1)} 秒` : "暂无"} />
              <DetailRow label="Report Token" value={selected.reportToken ? `${selected.reportToken.slice(0, 10)}…` : "暂无"} />
            </DetailSection>
          </>
        ) : (
          <div className="detail-empty"><AlertCircle size={22} /><strong>请选择一位用户</strong><span>从收件箱或最近活动打开详情。</span></div>
        )}
      </aside> : null}
    </div>
  );
}

function SummaryCard({ label, value, detail, icon: Icon, tone }: { label: string; value: number; detail: string; icon: typeof Users; tone?: string }) {
  return <article className={cn("ops-summary-card", tone)}><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div><Icon size={17} /></article>;
}

function PriorityBadge({ priority }: { priority: FollowUpItem["priority"] }) {
  return <span className={cn("priority-badge", priority)}>{priority === "high" ? "高" : priority === "medium" ? "中" : "低"}</span>;
}

function QualityLine({ label, value, status }: { label: string; value: string; status: "good" | "warn" | "bad" }) {
  return <div className="quality-line"><span className={cn("quality-status", status)} /><strong>{label}</strong><b>{value}</b></div>;
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="detail-section"><h3>{title}</h3>{children}</section>;
}

function DetailRow({ label, value, tone }: { label: string; value: string; tone?: "danger" }) {
  return <div className="detail-row"><span>{label}</span><strong className={cn(tone === "danger" && "danger")}>{value}</strong></div>;
}

function filterCount(filter: InboxFilter, items: FollowUpItem[]): number {
  if (filter === "high") return items.filter((item) => item.priority === "high").length;
  if (filter === "unlock") return items.filter((item) => item.blockerCode === "unlock_failed" || item.blockerCode === "verification_unavailable").length;
  if (filter === "commercial") return items.filter((item) => item.intent === "buyer" || item.intent === "owner").length;
  return items.length;
}

function funnelLabel(key: string): string {
  return ({ new: "新用户", submitted: "提交域名", preview: "查看预览", unlocked: "解锁报告", shared: "生成分享", referred: "推荐新用户" } as Record<string, string>)[key] ?? key;
}

function formatPercent(value: number): string {
  return new Intl.NumberFormat("zh-CN", { style: "percent", maximumFractionDigits: 1 }).format(value);
}

function relativeTime(value: string): string {
  const difference = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.floor(difference / 60_000));
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Kuala_Lumpur", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatClock(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Kuala_Lumpur", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(value));
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
}
