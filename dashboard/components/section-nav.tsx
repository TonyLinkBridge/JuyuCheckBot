"use client";

import { Activity, Briefcase, CircleGauge, GitFork, LayoutDashboard, Send, Workflow } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const sections = [
  { id: "overview", label: "总览 Overview", icon: LayoutDashboard },
  { id: "funnel", label: "漏斗 Funnel", icon: Workflow },
  { id: "referrals", label: "推荐 Referral", icon: GitFork },
  { id: "leads", label: "客户 Leads", icon: Briefcase },
  { id: "sources", label: "获客 Acquisition", icon: Send },
  { id: "intelligence", label: "质量 Intelligence", icon: CircleGauge },
  { id: "activity", label: "活动 Activity", icon: Activity },
] as const;

type SectionId = (typeof sections)[number]["id"];

function isSectionId(value: string): value is SectionId {
  return sections.some((section) => section.id === value);
}

export function SectionNav() {
  const [activeSection, setActiveSection] = useState<SectionId>("overview");
  const frame = useRef<number | null>(null);

  useEffect(() => {
    function updateActiveSection() {
      const marker = window.scrollY + Math.min(180, window.innerHeight * 0.3);
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 8;
      let current: SectionId = "overview";

      for (const { id } of sections) {
        const section = document.getElementById(id);
        const sectionTop = section ? section.getBoundingClientRect().top + window.scrollY : Number.POSITIVE_INFINITY;
        if (sectionTop <= marker) current = id;
      }
      if (atBottom) current = sections[sections.length - 1].id;
      setActiveSection(current);
    }

    function scheduleUpdate() {
      if (frame.current !== null) return;
      frame.current = window.requestAnimationFrame(() => {
        frame.current = null;
        updateActiveSection();
      });
    }

    const hashSection = window.location.hash.slice(1);
    if (isSectionId(hashSection)) setActiveSection(hashSection);
    scheduleUpdate();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("hashchange", scheduleUpdate);
    return () => {
      if (frame.current !== null) window.cancelAnimationFrame(frame.current);
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("hashchange", scheduleUpdate);
    };
  }, []);

  function navigateTo(id: SectionId) {
    const section = document.getElementById(id);
    if (!section) return;
    setActiveSection(id);
    window.history.replaceState(null, "", `#${id}`);
    section.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    });
  }

  return (
    <nav className="section-nav" aria-label="Dashboard sections">
      <p>Workspace</p>
      {sections.map(({ id, label, icon: Icon }) => (
        <a
          href={`#${id}`}
          key={id}
          className={cn(activeSection === id && "active")}
          aria-current={activeSection === id ? "page" : undefined}
          onClick={(event) => {
            event.preventDefault();
            navigateTo(id);
          }}
        >
          <Icon size={16} aria-hidden="true" />
          <span>{label}</span>
        </a>
      ))}
    </nav>
  );
}
