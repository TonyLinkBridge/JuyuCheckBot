import Link from "next/link";
import { ArrowLeft, ChevronRight, ExternalLink } from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar";
import { PollComposer } from "@/components/poll-composer";
import { ThemeToggle } from "@/components/theme-toggle";
import { requireDashboardSession } from "@/lib/auth";
import { getPollPublisherStatus } from "@/lib/telegram-publisher";

export const dynamic = "force-dynamic";

export default async function PollsPage() {
  await requireDashboardSession();
  const publisher = getPollPublisherStatus();

  return (
    <div className="dashboard-shell">
      <AppSidebar />
      <main className="dashboard-main">
        <header className="topbar">
          <div>
            <div className="breadcrumb"><span>JUYU Domain Check</span><ChevronRight size={13} /><strong>Poll Campaign</strong></div>
            <p className="topbar-subtitle">Channel acquisition · Server-side publishing</p>
          </div>
          <div className="topbar-actions">
            <Link href="/" className="back-button"><ArrowLeft size={14} /> 返回总览</Link>
            <ThemeToggle />
            <a className="icon-button" href={`https://t.me/${publisher.botUsername}`} target="_blank" rel="noreferrer" aria-label="Open Telegram bot"><ExternalLink size={15} /></a>
          </div>
        </header>
        <div className="dashboard-content poll-page-content">
          <section className="section-block">
            <div className="section-heading">
              <div><p>POLL ACQUISITION</p><h2>内容引流发布器</h2></div>
              <span>由 Bot 发送 Poll，并把每一位点击用户归因到对应 Campaign。</span>
            </div>
            <PollComposer publisher={publisher} defaultCampaign={`morningbrief_${kualaLumpurDate()}`} />
          </section>
        </div>
      </main>
    </div>
  );
}

function kualaLumpurDate(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}${value.month}${value.day}`;
}
