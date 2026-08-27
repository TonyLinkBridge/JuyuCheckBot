"use client";

import { Activity, BriefcaseBusiness, CircleGauge, Inbox, Megaphone, SearchCheck, Send, Settings, Users, Workflow } from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { dashboardSections } from "@/lib/dashboard-sections";

const sectionIcons = { inbox: Inbox, leads: BriefcaseBusiness, users: Users, funnel: Workflow, sources: Send, quality: CircleGauge, activity: Activity, settings: Settings } as const;

export function SectionNav({ followUpCount = 0, qualityAlerts = 0 }: { followUpCount?: number; qualityAlerts?: number }) {
  const pathname = usePathname();

  return (
    <nav className="section-nav" aria-label="Dashboard sections">
      <p>Workspace</p>
      {dashboardSections.map(({ id, href, label }) => {
        const Icon = sectionIcons[id];
        const count = id === "inbox" ? followUpCount : id === "quality" ? qualityAlerts : 0;
        return (
          <Link
            href={href}
            key={id}
            className={cn(pathname === href && "active")}
            aria-current={pathname === href ? "page" : undefined}
          >
            <Icon size={16} aria-hidden="true" />
            <span>{label}</span>
            {count > 0 ? <b className="nav-count">{count}</b> : null}
          </Link>
        );
      })}
      <p className="nav-group-label">Campaigns</p>
      <a href="/polls" className={cn(pathname === "/polls" && "active")} aria-current={pathname === "/polls" ? "page" : undefined}>
        <Megaphone size={16} aria-hidden="true" />
        <span>Poll 引流</span>
      </a>
      <a href="https://t.me/JuyuCheckBot" target="_blank" rel="noreferrer">
        <SearchCheck size={16} aria-hidden="true" />
        <span>打开 Bot</span>
      </a>
    </nav>
  );
}
