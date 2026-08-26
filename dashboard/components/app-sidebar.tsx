import { LogOut } from "lucide-react";
import { logout } from "@/app/actions";
import { SectionNav } from "@/components/section-nav";
import { Badge } from "@/components/ui/badge";

export function AppSidebar({ followUpCount = 0, qualityAlerts = 0 }: { followUpCount?: number; qualityAlerts?: number }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-mark">J</div>
        <div><strong>JUYU</strong><span>Domain Check</span></div>
      </div>
      <SectionNav followUpCount={followUpCount} qualityAlerts={qualityAlerts} />
      <div className="sidebar-status">
        <div className="status-row"><span className="status-pulse" /><span>Bot 在线</span><Badge>LIVE</Badge></div>
        <p>@JuyuCheckBot</p>
      </div>
      <form action={logout}>
        <button className="signout-button" type="submit"><LogOut size={15} aria-hidden="true" /> 退出 Sign out</button>
      </form>
    </aside>
  );
}
