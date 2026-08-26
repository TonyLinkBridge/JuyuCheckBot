import Link from "next/link";
import { ChevronDown, ChevronRight, ExternalLink, RefreshCw } from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar";
import { FollowUpWorkspace } from "@/components/follow-up-workspace";
import { ThemeToggle } from "@/components/theme-toggle";
import { rangeOptions, type DashboardData } from "@/lib/dashboard-data";
import { getDashboardSection, type DashboardSectionId } from "@/lib/dashboard-sections";
import { cn } from "@/lib/utils";

export function Dashboard({ data, activeSection }: { data: DashboardData; activeSection: DashboardSectionId }) {
  return (
    <div className="dashboard-shell">
      <AppSidebar followUpCount={data.followUp.summary.total} qualityAlerts={qualityAlertCount(data)} />
      <main className="dashboard-main">
        <Topbar data={data} activeSection={activeSection} />
        {data.error ? (
          <div className="ops-global-notice">
            <span>数据提醒</span>
            {data.error}。界面仍可使用，连接恢复后会自动显示最新数据。
          </div>
        ) : null}
        <FollowUpWorkspace data={data} activeSection={activeSection} />
      </main>
    </div>
  );
}

function Topbar({ data, activeSection }: { data: DashboardData; activeSection: DashboardSectionId }) {
  const section = getDashboardSection(activeSection);
  return (
    <header className="topbar ops-topbar">
      <div>
        <div className="breadcrumb"><span>JUYU Domain Check</span><ChevronRight size={13} /><strong>{section.label}</strong></div>
        <p className="topbar-subtitle">Internal operations · Asia/Kuala_Lumpur</p>
      </div>
      <div className="topbar-actions">
        <nav className="range-picker" aria-label="日期范围">
          {rangeOptions.map((option) => (
            <Link key={option.value} href={`${section.href}?range=${option.value}`} className={cn(data.range === option.value && "selected")}>
              {option.label}
            </Link>
          ))}
        </nav>
        <div className="ops-date-label"><span>近 {rangeDays(data.range)} 天</span><ChevronDown size={13} /></div>
        <Link href={`${section.href}?range=${data.range}`} className="icon-button" aria-label="刷新 Dashboard"><RefreshCw size={15} /></Link>
        <ThemeToggle />
        <a className="icon-button" href="https://t.me/JuyuCheckBot" target="_blank" rel="noreferrer" aria-label="打开 Telegram Bot"><ExternalLink size={15} /></a>
      </div>
    </header>
  );
}

function rangeDays(range: DashboardData["range"]): number {
  if (range === "1d") return 1;
  if (range === "30d") return 30;
  if (range === "90d") return 90;
  return 7;
}

function qualityAlertCount(data: DashboardData): number {
  return Number(data.quality.registrationUnknownRate > .2)
    + Number(data.quality.failureRate > .1)
    + Number(data.quality.medianDurationMs > 8000);
}
