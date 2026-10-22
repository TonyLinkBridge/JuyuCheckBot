import { LogOut } from "lucide-react";
import { logout } from "@/app/actions";
import { SectionNav } from "@/components/section-nav";
import { Badge } from "@/components/ui/badge";
import type { BotHealth } from "@/lib/bot-health";

export function AppSidebar({ followUpCount = 0, qualityAlerts = 0, health }: { followUpCount?: number; qualityAlerts?: number; health?: BotHealth }) {
  const healthy = health?.status === "healthy";
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-mark">J</div>
        <div><strong>JUYU</strong><span>Domain Check</span></div>
      </div>
      <SectionNav followUpCount={followUpCount} qualityAlerts={qualityAlerts} />
      <div className="sidebar-status">
        <div className="status-row"><span className="status-pulse" style={healthy ? undefined : { background: "#d19b45", animation: "none" }} /><span>{healthy ? "服务检查正常" : health?.status === "degraded" ? "服务需要处理" : "状态未确认"}</span><Badge>{healthy ? "LIVE" : "CHECK"}</Badge></div>
        <p>@JuyuCheckBot</p>
      </div>
      <form action={logout}>
        <button className="signout-button" type="submit"><LogOut size={15} aria-hidden="true" /> 退出 Sign out</button>
      </form>
    </aside>
  );
}
