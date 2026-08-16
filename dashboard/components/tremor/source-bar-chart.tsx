"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DashboardData } from "@/lib/dashboard-data";

export function SourceBarChart({ data }: { data: DashboardData["sources"] }) {
  if (!data.length) return <div className="compact-empty">暂无来源数据</div>;
  return (
    <div className="source-chart" role="img" aria-label="Acquisition sources chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data.slice(0, 6)} margin={{ top: 4, right: 0, left: -28, bottom: 0 }}>
          <CartesianGrid stroke="var(--grid)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="source" axisLine={false} tickLine={false} tick={{ fill: "var(--text-soft)", fontSize: 10 }} />
          <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "var(--text-soft)", fontSize: 10 }} />
          <Tooltip
            cursor={{ fill: "var(--row-hover)" }}
            contentStyle={{ background: "var(--tooltip)", border: "1px solid var(--border)", borderRadius: 9, fontSize: 12, color: "var(--text-medium)" }}
          />
          <Bar dataKey="newUsers" name="New Users" fill="var(--green)" radius={[4, 4, 0, 0]} maxBarSize={34} />
          <Bar dataKey="activated" name="Activated" fill="var(--text-faint)" radius={[4, 4, 0, 0]} maxBarSize={34} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
