"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DashboardData } from "@/lib/dashboard-data";

export function SourceBarChart({ data }: { data: DashboardData["sources"] }) {
  if (!data.length) return <div className="compact-empty">暂无来源数据</div>;
  return (
    <div className="source-chart" role="img" aria-label="Acquisition sources chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data.slice(0, 6)} margin={{ top: 4, right: 0, left: -28, bottom: 0 }}>
          <CartesianGrid stroke="#24272d" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="source" axisLine={false} tickLine={false} tick={{ fill: "#777f89", fontSize: 10 }} />
          <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "#777f89", fontSize: 10 }} />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,.035)" }}
            contentStyle={{ background: "#111317", border: "1px solid #30343b", borderRadius: 9, fontSize: 12 }}
          />
          <Bar dataKey="newUsers" name="New Users" fill="#58d0a6" radius={[4, 4, 0, 0]} maxBarSize={34} />
          <Bar dataKey="activated" name="Activated" fill="#5e6672" radius={[4, 4, 0, 0]} maxBarSize={34} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
