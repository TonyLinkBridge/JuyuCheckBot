import Link from "next/link";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bot,
  CheckCircle2,
  ChevronRight,
  CircleGauge,
  Clock3,
  Database,
  ExternalLink,
  Fingerprint,
  Gauge,
  GitFork,
  LayoutDashboard,
  LogOut,
  Radio,
  RefreshCw,
  Send,
  Share2,
  ShieldCheck,
  Sparkles,
  Users,
  Workflow,
  Wrench,
  XCircle,
} from "lucide-react";
import { logout } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { GrowthAreaChart } from "@/components/tremor/growth-area-chart";
import { SourceBarChart } from "@/components/tremor/source-bar-chart";
import { rangeOptions, type DashboardData, type Metric } from "@/lib/dashboard-data";
import { cn } from "@/lib/utils";

const metricDefinitions = [
  { key: "newUsers", label: "New Users", detail: "首次启动 Bot 的独立用户", icon: Users },
  { key: "toolUsers", label: "Tool Users", detail: "至少提交一次域名的独立用户", icon: Wrench },
  { key: "unlockRate", label: "Unlock Rate", detail: "解锁用户 ÷ Preview 用户", icon: ShieldCheck },
  { key: "shareRate", label: "Share Rate", detail: "分享用户 ÷ 解锁用户", icon: Share2 },
  { key: "referredUsers", label: "Referred Users", detail: "分享带来的真实新用户", icon: GitFork },
  { key: "loopRate", label: "Growth Loop Rate", detail: "推荐新用户 ÷ 分享用户", icon: Sparkles },
] as const;

const eventLabels: Record<string, string> = {
  user_created: "New user acquired",
  domain_submitted: "Domain submitted",
  preview_shown: "Preview generated",
  intent_selected: "Intent selected",
  gate_shown: "Growth gate shown",
  unlock_failed: "Unlock verification failed",
  report_unlocked: "Full report unlocked",
  share_generated: "Share card generated",
  referral_opened: "Referral opened",
  check_failed: "Domain check failed",
  rate_limited: "Rate limit applied",
  history_viewed: "Report history viewed",
};

export function Dashboard({ data }: { data: DashboardData }) {
  return (
    <div className="dashboard-shell">
      <Sidebar />
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
              {metricDefinitions.map(({ key, label, detail, icon }) => (
                <MetricCard key={key} label={label} detail={detail} metric={data.totals[key]} icon={icon} />
              ))}
            </div>
          </section>

          <section className="analytics-grid">
            <Card className="trend-card">
              <CardHeader>
                <div>
                  <p className="card-kicker">ACQUISITION VELOCITY</p>
                  <h2>Growth trend</h2>
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
                    <h2>Source distribution</h2>
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

function Sidebar() {
  const links = [
    { href: "#overview", label: "Overview", icon: LayoutDashboard },
    { href: "#funnel", label: "Funnel", icon: Workflow },
    { href: "#sources", label: "Acquisition", icon: Send },
    { href: "#intelligence", label: "Intelligence", icon: CircleGauge },
    { href: "#activity", label: "Activity", icon: Activity },
  ];
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-mark">J</div>
        <div><strong>JUYU</strong><span>Growth Intelligence</span></div>
      </div>
      <nav aria-label="Dashboard sections">
        <p>Workspace</p>
        {links.map(({ href, label, icon: Icon }, index) => (
          <a href={href} key={href} className={cn(index === 0 && "active")}>
            <Icon size={16} aria-hidden="true" /> {label}
          </a>
        ))}
      </nav>
      <div className="sidebar-status">
        <div className="status-row"><span className="status-pulse" /><span>Bot online</span><Badge>LIVE</Badge></div>
        <p>@JuyuCheckBot</p>
      </div>
      <form action={logout}>
        <button className="signout-button" type="submit"><LogOut size={15} aria-hidden="true" /> Sign out</button>
      </form>
    </aside>
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

function MetricCard({ label, detail, metric, icon: Icon }: { label: string; detail: string; metric: Metric; icon: typeof Users }) {
  const change = metric.previous > 0 ? (metric.value - metric.previous) / metric.previous : null;
  const positive = change === null || change >= 0;
  return (
    <Card className="metric-card" title={detail}>
      <CardHeader className="metric-header">
        <span>{label}</span><Icon size={16} aria-hidden="true" />
      </CardHeader>
      <CardContent>
        <div className="metric-value">{formatMetric(metric)}</div>
        <div className="metric-comparison">
          <span className={cn("delta", positive ? "positive" : "negative")}>
            {change === null ? <Radio size={12} /> : positive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {change === null ? (metric.value > 0 ? "New" : "—") : `${Math.abs(change * 100).toFixed(1)}%`}
          </span>
          <span>vs previous period</span>
        </div>
      </CardContent>
    </Card>
  );
}

function GateCard({ gate }: { gate: DashboardData["gate"] }) {
  return (
    <Card className="gate-card">
      <CardHeader><div><p className="card-kicker">GROWTH GATE</p><h2>Subscription unlock</h2></div><ShieldCheck size={18} className="muted-icon" /></CardHeader>
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
            return (
              <div className="funnel-row" key={stage.key}>
                <div className="funnel-index">{String(index + 1).padStart(2, "0")}</div>
                <div className="funnel-name"><strong>{stage.label}</strong><span>{index === 0 ? "Cohort entry" : `${formatPercent(ratio(stage.value, previous))} step conversion`}</span></div>
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
      <CardHeader><div><p className="card-kicker">SOURCE QUALITY</p><h2>Acquisition performance</h2></div><Fingerprint size={18} className="muted-icon" /></CardHeader>
      <CardContent className="table-wrap">
        <table>
          <thead><tr><th>Source</th><th>New</th><th>Active</th><th>Unlock</th><th>Share</th><th>Rate</th></tr></thead>
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

function QualityGrid({ quality }: { quality: DashboardData["quality"] }) {
  const items = [
    { label: "Reports", value: String(quality.reportCount), hint: `Average score ${quality.averageScore.toFixed(1)}`, icon: Bot, tone: "neutral" },
    { label: "Median latency", value: quality.medianDurationMs ? `${(quality.medianDurationMs / 1000).toFixed(1)}s` : "—", hint: "Preview generation", icon: Clock3, tone: quality.medianDurationMs > 6000 ? "warn" : "good" },
    { label: "Low confidence", value: formatPercent(quality.lowConfidenceRate), hint: "External data coverage", icon: Gauge, tone: quality.lowConfidenceRate > 0.15 ? "warn" : "good" },
    { label: "Activity N/A", value: formatPercent(quality.unavailableRate), hint: "Excluded from Score", icon: Database, tone: quality.unavailableRate > 0.1 ? "warn" : "good" },
    { label: "Cache hit", value: formatPercent(quality.cachedRate), hint: "15 minute reuse", icon: RefreshCw, tone: "neutral" },
    { label: "Check failures", value: formatPercent(quality.failureRate), hint: "Submitted → Failed", icon: quality.failureRate > 0 ? XCircle : CheckCircle2, tone: quality.failureRate > 0.05 ? "bad" : "good" },
  ];
  return <div className="quality-grid">{items.map(({ icon: Icon, ...item }) => <Card key={item.label} className="quality-card"><CardContent><div className={cn("quality-icon", item.tone)}><Icon size={16} /></div><span>{item.label}</span><strong>{item.value}</strong><small>{item.hint}</small></CardContent></Card>)}</div>;
}

function ActivityTable({ events }: { events: DashboardData["recent"] }) {
  return (
    <Card className="activity-card"><CardContent className="table-wrap"><table><thead><tr><th>Event</th><th>Domain</th><th>Source</th><th>Time</th></tr></thead><tbody>
      {events.length ? events.map((event, index) => <tr key={`${event.event}-${event.createdAt}-${index}`}><td><span className={cn("event-dot", event.event === "check_failed" && "event-error")} />{eventLabels[event.event] ?? event.event}</td><td className="domain-cell">{event.domain ?? "—"}</td><td><Badge>{event.source}</Badge></td><td className="time-cell">{formatTime(event.createdAt)}</td></tr>) : <tr><td colSpan={4} className="empty-cell">暂无活动</td></tr>}
    </tbody></table></CardContent></Card>
  );
}

function formatMetric(metric: Metric): string {
  if (metric.format === "percent") return formatPercent(metric.value);
  if (metric.format === "decimal") return metric.value.toFixed(1);
  return new Intl.NumberFormat("en-US").format(metric.value);
}

function formatPercent(value: number): string { return `${(value * 100).toFixed(value > 0 && value < 0.1 ? 1 : 0)}%`; }
function ratio(numerator: number, denominator: number): number { return denominator > 0 ? numerator / denominator : 0; }
function formatTime(value: string): string { return new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Kuala_Lumpur", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
