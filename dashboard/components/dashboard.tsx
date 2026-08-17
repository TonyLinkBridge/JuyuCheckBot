import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bot,
  Briefcase,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Database,
  ExternalLink,
  Fingerprint,
  Gauge,
  GitFork,
  Radio,
  RefreshCw,
  Share2,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Wrench,
  XCircle,
} from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { GrowthAreaChart } from "@/components/tremor/growth-area-chart";
import { SourceBarChart } from "@/components/tremor/source-bar-chart";
import { ThemeToggle } from "@/components/theme-toggle";
import { rangeOptions, type DashboardData, type Metric } from "@/lib/dashboard-data";
import { cn } from "@/lib/utils";

const metricDefinitions = [
  { key: "newUsers", label: "新用户", secondary: "New Users", detail: "首次启动 Bot 的独立用户", icon: Users },
  { key: "toolUsers", label: "工具用户", secondary: "Tool Users", detail: "至少提交一次域名的独立用户", icon: Wrench },
  { key: "unlockRate", label: "解锁率", secondary: "Unlock Rate", detail: "解锁用户 ÷ Preview 用户", icon: ShieldCheck },
  { key: "shareRate", label: "分享率", secondary: "Share Rate", detail: "分享用户 ÷ 解锁用户", icon: Share2 },
  { key: "referredUsers", label: "推荐新用户", secondary: "Referred Users", detail: "分享带来的真实新用户", icon: GitFork },
  { key: "loopRate", label: "增长闭环率", secondary: "Growth Loop", detail: "推荐新用户 ÷ 分享用户", icon: Sparkles },
] as const;

const eventLabels: Record<string, string> = {
  user_created: "获得新用户",
  domain_submitted: "提交域名",
  preview_shown: "生成体检预览",
  intent_selected: "选择用户意图",
  gate_shown: "显示订阅门槛",
  unlock_failed: "订阅验证失败",
  report_unlocked: "解锁完整报告",
  share_generated: "生成分享卡",
  referral_opened: "打开推荐链接",
  commerce_handoff: "进入聚域助手",
  check_failed: "域名体检失败",
  rate_limited: "触发频率限制",
  history_viewed: "查看历史报告",
};

const funnelLabels: Record<string, { primary: string; secondary: string }> = {
  new: { primary: "新用户", secondary: "New User" },
  submitted: { primary: "提交域名", secondary: "Domain Submitted" },
  preview: { primary: "查看预览", secondary: "Preview Shown" },
  unlocked: { primary: "解锁报告", secondary: "Report Unlocked" },
  shared: { primary: "生成分享", secondary: "Share Generated" },
  referred: { primary: "推荐新用户", secondary: "Referred New User" },
};

export function Dashboard({ data }: { data: DashboardData }) {
  const insights = buildInsights(data);
  return (
    <div className="dashboard-shell">
      <AppSidebar />
      <main className="dashboard-main">
        <Topbar data={data} />
        <div className="dashboard-content">
          {data.error ? (
            <div className="notice-banner">
              <Database size={16} aria-hidden="true" />
              <span>{data.error}。界面保持可用，数据恢复后会自动显示。</span>
            </div>
          ) : null}

          <section id="overview" className="section-block">
            <SectionHeading
              eyebrow="GROWTH OVERVIEW"
              title="增长闭环"
              description="从新用户进入工具，到分享带来下一位新用户。"
            />
            <div className="metric-grid">
              {metricDefinitions.map(({ key, label, secondary, detail, icon }) => (
                <MetricCard key={key} label={label} secondary={secondary} detail={detail} metric={data.totals[key]} icon={icon} />
              ))}
            </div>
            <div className="insight-panel" aria-label="自动增长洞察">
              <div className="insight-heading">
                <div><p className="card-kicker">JUYU SIGNALS</p><h2>自动增长洞察</h2></div>
                <span>基于当前周期实时生成 · Auto insights</span>
              </div>
              <div className="insight-grid">
                {insights.map(({ label, title, body, tone, icon: Icon }) => (
                  <article className={cn("insight-card", tone)} key={label}>
                    <div className="insight-icon"><Icon size={16} aria-hidden="true" /></div>
                    <div><span>{label}</span><strong>{title}</strong><p>{body}</p></div>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="analytics-grid">
            <Card className="trend-card">
              <CardHeader>
                <div>
                  <p className="card-kicker">ACQUISITION VELOCITY</p>
                  <h2>增长趋势 <small>Growth trend</small></h2>
                </div>
                <div className="chart-legend" aria-label="Chart legend">
                  <span><i className="legend-dot legend-green" /> New users</span>
                  <span><i className="legend-dot legend-white" /> Unlocked</span>
                  <span><i className="legend-dot legend-gray" /> Referrals</span>
                </div>
              </CardHeader>
              <CardContent className="chart-content">
                <GrowthAreaChart data={data.trend} />
              </CardContent>
            </Card>

            <GateCard gate={data.gate} />
          </section>

          <section id="funnel" className="section-block">
            <SectionHeading
              eyebrow="ACTIVATION FUNNEL"
              title="新用户漏斗"
              description="只追踪当前周期首次进入的用户，避免老用户活动污染转化率。"
            />
            <FunnelCard data={data.funnel} />
          </section>

          <section id="referrals" className="section-block">
            <SectionHeading
              eyebrow="REFERRAL GROWTH LOOP"
              title="推荐增长闭环"
              description="追踪分享是否真正带来新用户、域名提交与完整报告解锁。"
            />
            <ReferralLoop referral={data.referral} />
          </section>

          <section id="leads" className="section-block">
            <SectionHeading
              eyebrow="LEAD CONVERSION"
              title="潜在客户"
              description="识别想购买、出售或注册域名的用户，并追踪 JUYU 商业服务导流。"
            />
            <LeadConversion leads={data.leads} />
          </section>

          <section id="sources" className="section-block">
            <SectionHeading
              eyebrow="ACQUISITION"
              title="来源质量"
              description="来源不只看流量，也看用户是否真正完成域名体检。"
            />
            <div className="source-grid">
              <Card>
                <CardHeader>
                  <div>
                    <p className="card-kicker">NEW USERS BY SOURCE</p>
                    <h2>来源分布 <small>Source distribution</small></h2>
                  </div>
                  <BarChart3 size={18} className="muted-icon" aria-hidden="true" />
                </CardHeader>
                <CardContent className="chart-content source-chart-content">
                  <SourceBarChart data={data.sources} />
                </CardContent>
              </Card>
              <SourceTable sources={data.sources} />
            </div>
          </section>

          <section id="intelligence" className="section-block">
            <SectionHeading
              eyebrow="INTELLIGENCE HEALTH"
              title="数据质量"
              description="监控外部数据、报告稳定性与体检响应速度。"
            />
            <QualityGrid quality={data.quality} />
          </section>

          <section id="activity" className="section-block section-last">
            <SectionHeading
              eyebrow="EVENT STREAM"
              title="最近活动"
              description="不显示 Telegram 用户 ID，只保留产品行为与来源。"
            />
            <ActivityTable events={data.recent} />
          </section>
        </div>
      </main>
    </div>
  );
}

function Topbar({ data }: { data: DashboardData }) {
  return (
    <header className="topbar">
      <div>
        <div className="breadcrumb"><span>JUYU Domain Check</span><ChevronRight size={13} /><strong>Growth</strong></div>
        <p className="topbar-subtitle">Product analytics · Asia/Kuala_Lumpur</p>
      </div>
      <div className="topbar-actions">
        <nav className="range-picker" aria-label="Date range">
          {rangeOptions.map((option) => (
            <Link key={option.value} href={`/?range=${option.value}`} className={cn(data.range === option.value && "selected")}>
              {option.label}
            </Link>
          ))}
        </nav>
        <ThemeToggle />
        <Link href={`/?range=${data.range}`} className="icon-button" aria-label="Refresh dashboard"><RefreshCw size={15} /></Link>
        <a className="icon-button" href="https://t.me/JuyuCheckBot" target="_blank" rel="noreferrer" aria-label="Open Telegram bot">
          <ExternalLink size={15} />
        </a>
      </div>
    </header>
  );
}

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="section-heading">
      <div><p>{eyebrow}</p><h2>{title}</h2></div>
      <span>{description}</span>
    </div>
  );
}

function MetricCard({ label, secondary, detail, metric, icon: Icon }: { label: string; secondary: string; detail: string; metric: Metric; icon: typeof Users }) {
  const change = metric.previous > 0 ? (metric.value - metric.previous) / metric.previous : null;
  const positive = change === null || change >= 0;
  const sampleSize = metric.denominator ?? metric.numerator ?? 0;
  const sample = metric.format === "percent"
    ? `${metric.numerator ?? 0}/${metric.denominator ?? 0} users`
    : `${metric.numerator ?? metric.value} unique users`;
  return (
    <Card className="metric-card" title={detail}>
      <CardHeader className="metric-header">
        <span className="metric-label"><strong>{label}</strong><small>{secondary}</small></span><Icon size={16} aria-hidden="true" />
      </CardHeader>
      <CardContent>
        <div className="metric-value">{formatMetric(metric)}</div>
        <div className="metric-comparison">
          <span className={cn("delta", positive ? "positive" : "negative")}>
            {change === null ? <Radio size={12} /> : positive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {change === null ? (metric.value > 0 ? "New" : "—") : `${Math.abs(change * 100).toFixed(1)}%`}
          </span>
          <span>vs 上一周期</span>
        </div>
        <div className="metric-sample"><span>{sample}</span>{sampleSize > 0 && sampleSize < 10 ? <Badge>SMALL SAMPLE</Badge> : null}</div>
      </CardContent>
    </Card>
  );
}

function GateCard({ gate }: { gate: DashboardData["gate"] }) {
  return (
    <Card className="gate-card">
      <CardHeader><div><p className="card-kicker">GROWTH GATE</p><h2>订阅解锁 <small>Subscription unlock</small></h2></div><ShieldCheck size={18} className="muted-icon" /></CardHeader>
      <CardContent>
        <div className="gate-score"><strong>{formatPercent(gate.conversionRate)}</strong><span>Gate → Unlock</span></div>
        <div className="progress-track"><span style={{ width: `${Math.min(100, gate.conversionRate * 100)}%` }} /></div>
        <div className="gate-stats">
          <div><span>Gate shown</span><strong>{gate.shown}</strong></div>
          <div><span>First verify failed</span><strong>{gate.failed}</strong></div>
          <div><span>Unlocked</span><strong>{gate.unlocked}</strong></div>
        </div>
        <div className="recovery-line"><RefreshCw size={13} /><span>Retry recovery</span><strong>{formatPercent(gate.recoveryRate)}</strong></div>
      </CardContent>
    </Card>
  );
}

function FunnelCard({ data }: { data: DashboardData["funnel"] }) {
  const maximum = Math.max(1, data[0]?.value ?? 0);
  return (
    <Card className="funnel-card">
      <CardContent>
        <div className="funnel-list">
          {data.map((stage, index) => {
            const previous = index === 0 ? stage.value : data[index - 1]?.value ?? 0;
            const copy = funnelLabels[stage.key] ?? { primary: stage.label, secondary: stage.label };
            return (
              <div className="funnel-row" key={stage.key}>
                <div className="funnel-index">{String(index + 1).padStart(2, "0")}</div>
                <div className="funnel-name"><strong>{copy.primary}</strong><span>{copy.secondary} · {index === 0 ? "Cohort entry" : `${formatPercent(ratio(stage.value, previous))} step conversion`}</span></div>
                <div className="funnel-bar-track"><span style={{ width: `${Math.max(stage.value ? 5 : 0, (stage.value / maximum) * 100)}%` }} /></div>
                <strong className="funnel-value">{stage.value}</strong>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function SourceTable({ sources }: { sources: DashboardData["sources"] }) {
  return (
    <Card className="source-table-card">
      <CardHeader><div><p className="card-kicker">SOURCE QUALITY</p><h2>获客表现 <small>Acquisition performance</small></h2></div><Fingerprint size={18} className="muted-icon" /></CardHeader>
      <CardContent className="table-wrap">
        <table>
          <thead><tr><th>来源</th><th>新用户</th><th>激活</th><th>解锁</th><th>分享</th><th>激活率</th></tr></thead>
          <tbody>
            {sources.length ? sources.map((source) => (
              <tr key={source.source}>
                <td><span className="source-name">{source.source}</span></td><td>{source.newUsers}</td><td>{source.activated}</td><td>{source.unlocked}</td><td>{source.shared}</td><td>{formatPercent(source.activationRate)}</td>
              </tr>
            )) : <tr><td colSpan={6} className="empty-cell">等待首批来源数据</td></tr>}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function ReferralLoop({ referral }: { referral: DashboardData["referral"] }) {
  const stages = [
    { label: "分享用户", secondary: "Sharing User", value: referral.sharingUsers },
    { label: "推荐打开", secondary: "Referral Opened", value: referral.openedUsers },
    { label: "推荐新用户", secondary: "New User", value: referral.newUsers },
    { label: "提交自己的域名", secondary: "Domain Submitted", value: referral.activatedUsers },
    { label: "解锁完整报告", secondary: "Report Unlocked", value: referral.unlockedUsers },
  ];
  const metrics = [
    { label: "分享报告", value: String(referral.sharedReports), hint: "Shared reports" },
    { label: "链接打开率", value: formatPercent(referral.openRate), hint: "Opened reports / shared reports" },
    { label: "推荐激活率", value: formatPercent(referral.activationRate), hint: "Submitted / referred new users" },
    { label: "增长系数", value: referral.kFactor.toFixed(2), hint: "New users per sharing user" },
  ];
  return (
    <div className="referral-grid">
      <Card className="referral-funnel-card">
        <CardHeader>
          <div><p className="card-kicker">LOOP PERFORMANCE</p><h2>分享转化路径 <small>Referral funnel</small></h2></div>
          <GitFork size={18} className="muted-icon" aria-hidden="true" />
        </CardHeader>
        <CardContent>
          <div className="referral-metrics">
            {metrics.map((metric) => <div key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.hint}</small></div>)}
          </div>
          <div className="referral-flow">
            {stages.map((stage, index) => {
              const previous = index === 0 ? stage.value : stages[index - 1]?.value ?? 0;
              return <div className="referral-stage" key={stage.secondary}>
                <span className="referral-stage-index">{String(index + 1).padStart(2, "0")}</span>
                <div><strong>{stage.label}</strong><small>{stage.secondary}</small></div>
                <span className="referral-stage-rate">{index === 0 ? "ENTRY" : index === 1 ? `${ratio(stage.value, previous).toFixed(2)}×` : formatPercent(ratio(stage.value, previous))}</span>
                <b>{stage.value}</b>
              </div>;
            })}
          </div>
        </CardContent>
      </Card>
      <Card className="referral-domains-card">
        <CardHeader><div><p className="card-kicker">SHARED DOMAINS</p><h2>推荐表现最佳域名 <small>Top referrals</small></h2></div><Share2 size={18} className="muted-icon" aria-hidden="true" /></CardHeader>
        <CardContent className="table-wrap">
          <table>
            <thead><tr><th>域名</th><th>打开</th><th>新用户</th><th>激活</th></tr></thead>
            <tbody>{referral.topDomains.length ? referral.topDomains.map((domain) => <tr key={domain.domain}><td><span className="source-name">{domain.domain}</span></td><td>{domain.opened}</td><td>{domain.newUsers}</td><td>{domain.activated}</td></tr>) : <tr><td colSpan={4} className="empty-cell">分享链接带来访问后显示</td></tr>}</tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function LeadConversion({ leads }: { leads: DashboardData["leads"] }) {
  const metrics = [
    { label: "商业意向用户", value: String(leads.commercialIntentUsers), hint: "Owner + Buyer" },
    { label: "进入聚域助手", value: String(leads.handoffUsers), hint: `${formatPercent(leads.handoffRate)} of commercial intent` },
    { label: "完成资料提交", value: String(leads.submittedUsers), hint: `${leads.submittedLeads} completed lead forms` },
    { label: "Lead 完成率", value: formatPercent(leads.completionRate), hint: `购买 ${leads.buyLeads} · 出售 ${leads.sellLeads} · 注册 ${leads.registerLeads}` },
  ];
  return (
    <>
      {!leads.commerceConfigured || leads.commerceError ? <div className="lead-connection-notice">
        <Database size={15} aria-hidden="true" />
        <span>{leads.commerceError ?? "尚未连接 Commerce Supabase；目前只显示意向与导流点击。"}</span>
      </div> : null}
      <div className="lead-metrics">
        {metrics.map((metric) => <Card key={metric.label} className="lead-metric-card"><CardContent><span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.hint}</small></CardContent></Card>)}
      </div>
      <div className="lead-grid">
        <Card className="lead-opportunities-card">
          <CardHeader><div><p className="card-kicker">OPPORTUNITIES</p><h2>潜在客户列表 <small>Lead opportunities</small></h2></div>{leads.commerceConfigured && !leads.commerceError ? <Badge className="commerce-connected">COMMERCE CONNECTED</Badge> : <Briefcase size={18} className="muted-icon" aria-hidden="true" />}</CardHeader>
          <CardContent className="table-wrap">
            <table>
              <thead><tr><th>优先级</th><th>域名</th><th>意图</th><th>操作</th><th>资料</th><th>来源</th><th>状态</th></tr></thead>
              <tbody>{leads.opportunities.length ? leads.opportunities.map((lead, index) => <tr key={`${lead.domain}-${lead.intent}-${index}`}>
                <td><Badge className={`priority-${lead.priority}`}>{priorityLabel(lead.priority)}</Badge></td>
                <td><span className="source-name">{lead.domain}</span></td>
                <td>{lead.intent === "buyer" ? "想购买" : "想出售"}</td>
                <td>{leadActionLabel(lead.action)}</td>
                <td>{lead.evidenceAvailable === null || lead.evidenceTotal === null ? registrationStatusLabel(lead.registrationStatus) : `${lead.evidenceAvailable}/${lead.evidenceTotal} · ${registrationStatusLabel(lead.registrationStatus)}`}</td>
                <td><Badge>{lead.source}</Badge></td>
                <td><span className={cn("lead-status", lead.handedOff && "handed-off", lead.submitted && "submitted")}><i />{lead.submitted ? leadStatusLabel(lead.leadStatus) : lead.handedOff ? "已进入助手" : "待行动"}</span></td>
              </tr>) : <tr><td colSpan={7} className="empty-cell">用户选择购买或出售意图后显示</td></tr>}</tbody>
            </table>
          </CardContent>
        </Card>
        <Card className="lead-sources-card">
          <CardHeader><div><p className="card-kicker">LEAD SOURCES</p><h2>客户来源 <small>Commercial attribution</small></h2></div><Fingerprint size={18} className="muted-icon" aria-hidden="true" /></CardHeader>
          <CardContent className="table-wrap">
            <table><thead><tr><th>来源</th><th>意向</th><th>导流</th><th>提交</th><th>完成率</th></tr></thead><tbody>
              {leads.sources.length ? leads.sources.map((source) => <tr key={source.source}><td><span className="source-name">{source.source}</span></td><td>{source.intents}</td><td>{source.handoffs}</td><td>{source.submitted}</td><td>{formatPercent(source.completionRate)}</td></tr>) : <tr><td colSpan={5} className="empty-cell">等待商业意向数据</td></tr>}
            </tbody></table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function QualityGrid({ quality }: { quality: DashboardData["quality"] }) {
  const items = [
    { label: "体检报告", value: String(quality.reportCount), hint: "Evidence reports · 不含自创评分", icon: Bot, tone: "neutral" },
    { label: "响应中位数", value: quality.medianDurationMs ? `${(quality.medianDurationMs / 1000).toFixed(1)}s` : "—", hint: "Median latency · Preview", icon: Clock3, tone: quality.medianDurationMs > 6000 ? "warn" : "good" },
    { label: "注册状态确认", value: formatPercent(quality.registrationConfirmedRate), hint: "RDAP / Registry WHOIS", icon: Gauge, tone: quality.registrationConfirmedRate < 0.85 ? "warn" : "good" },
    { label: "注册局回退", value: formatPercent(quality.registryFallbackRate), hint: "Private suffix fallback", icon: Database, tone: "neutral" },
    { label: "缓存命中", value: formatPercent(quality.cachedRate), hint: "Cache hit · 15 分钟复用", icon: RefreshCw, tone: "neutral" },
    { label: "体检失败", value: formatPercent(quality.failureRate), hint: "Check failures · 提交→失败", icon: quality.failureRate > 0 ? XCircle : CheckCircle2, tone: quality.failureRate > 0.05 ? "bad" : "good" },
  ];
  return <div className="quality-grid">{items.map(({ icon: Icon, ...item }) => <Card key={item.label} className="quality-card"><CardContent><div className={cn("quality-icon", item.tone)}><Icon size={16} /></div><span>{item.label}</span><strong>{item.value}</strong><small>{item.hint}</small></CardContent></Card>)}</div>;
}

function ActivityTable({ events }: { events: DashboardData["recent"] }) {
  return (
    <Card className="activity-card"><CardContent className="table-wrap"><table><thead><tr><th>事件</th><th>域名</th><th>来源</th><th>时间</th></tr></thead><tbody>
      {events.length ? events.map((event, index) => <tr key={`${event.event}-${event.createdAt}-${index}`}><td><span className={cn("event-dot", event.event === "check_failed" && "event-error")} />{eventLabels[event.event] ?? event.event}</td><td className="domain-cell">{event.domain ?? "—"}</td><td><Badge>{event.source}</Badge></td><td className="time-cell">{formatTime(event.createdAt)}</td></tr>) : <tr><td colSpan={4} className="empty-cell">暂无活动</td></tr>}
    </tbody></table></CardContent></Card>
  );
}

function buildInsights(data: DashboardData) {
  const newUsers = data.totals.newUsers.value;
  const toolUsers = data.totals.toolUsers.value;
  const activationRate = ratio(toolUsers, newUsers);
  const shared = data.totals.shareRate.numerator ?? 0;
  const referred = data.totals.referredUsers.value;
  const activationInsight = newUsers === 0
    ? { label: "激活 ACTIVATION", title: "等待首位新用户", body: "当前周期还没有新用户，先从频道内容或 Deep Link 引入第一批流量。", tone: "neutral", icon: Target }
    : { label: "激活 ACTIVATION", title: `工具激活率 ${formatPercent(activationRate)}`, body: `${toolUsers}/${newUsers} 位新用户提交过域名${newUsers < 10 ? "；当前样本较小，暂不判断趋势。" : "。"}`, tone: activationRate >= 0.6 ? "good" : "warn", icon: Target };
  const loopInsight = referred > 0
    ? { label: "闭环 GROWTH LOOP", title: `分享带来 ${referred} 位新用户`, body: `已有 ${shared} 位用户生成分享，推荐路径开始形成真实增长。`, tone: "good", icon: TrendingUp }
    : shared > 0
      ? { label: "闭环 GROWTH LOOP", title: "分享尚未形成新用户", body: `${shared} 位用户生成过分享，但还没有推荐新用户；下一步应优化分享卡与 Deep Link。`, tone: "warn", icon: AlertTriangle }
      : { label: "闭环 GROWTH LOOP", title: "等待第一次分享", body: "完整报告已经是价值交付点，建议继续强化报告底部的分享理由。", tone: "neutral", icon: Share2 };
  const healthInsight = data.quality.failureRate > 0.05
    ? { label: "质量 HEALTH", title: "体检失败率需要关注", body: `失败率为 ${formatPercent(data.quality.failureRate)}，优先检查外部数据源和超时阶段。`, tone: "bad", icon: XCircle }
    : data.quality.registrationUnknownRate > 0.15
      ? { label: "质量 HEALTH", title: "部分注册状态无法确认", body: `${formatPercent(data.quality.registrationUnknownRate)} 的报告未取得注册资料，应继续补充对应注册局回退源。`, tone: "warn", icon: AlertTriangle }
      : { label: "质量 HEALTH", title: "体检服务运行稳定", body: `当前失败率 ${formatPercent(data.quality.failureRate)}，注册状态确认率 ${formatPercent(data.quality.registrationConfirmedRate)}。`, tone: "good", icon: CheckCircle2 };
  return [activationInsight, loopInsight, healthInsight];
}

function formatMetric(metric: Metric): string {
  if (metric.format === "percent") return formatPercent(metric.value);
  if (metric.format === "decimal") return metric.value.toFixed(1);
  return new Intl.NumberFormat("en-US").format(metric.value);
}

function formatPercent(value: number): string { return `${(value * 100).toFixed(value > 0 && value < 0.1 ? 1 : 0)}%`; }
function ratio(numerator: number, denominator: number): number { return denominator > 0 ? numerator / denominator : 0; }
function priorityLabel(priority: "high" | "medium" | "low"): string { return priority === "high" ? "高" : priority === "medium" ? "中" : "低"; }
function leadActionLabel(action: "sell" | "buy" | "register"): string { return action === "sell" ? "出售评估" : action === "register" ? "协助注册" : "协助收购"; }
function registrationStatusLabel(status: string | null): string { return status === "registered" ? "已注册" : status === "available" ? "未发现记录" : "待确认"; }
function leadStatusLabel(status: string | null): string { return status === "qualified" ? "合格客户" : status === "won" ? "已成交" : status === "lost" ? "已关闭" : status === "contacted" ? "已联系" : "已提交资料"; }
function formatTime(value: string): string { return new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Kuala_Lumpur", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
