"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DashboardData } from "@/lib/dashboard-data";

export function GrowthAreaChart({ data }: { data: DashboardData["trend"] }) {
  if (!data.length) return <ChartEmpty />;
  return (
    <div className="chart-frame" role="img" aria-label="Growth trend chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 4, left: -24, bottom: 0 }}>
          <defs>
            <linearGradient id="usersGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#58d0a6" stopOpacity={0.26} />
              <stop offset="100%" stopColor="#58d0a6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#24272d" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#777f89", fontSize: 11 }} minTickGap={24} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "#777f89", fontSize: 11 }} />
          <Tooltip
            cursor={{ stroke: "#454b55", strokeDasharray: "4 4" }}
            contentStyle={{
              background: "#111317",
              border: "1px solid #30343b",
              borderRadius: 9,
              boxShadow: "0 18px 50px rgba(0,0,0,.35)",
              fontSize: 12,
            }}
            labelStyle={{ color: "#f4f5f6", marginBottom: 6 }}
          />
          <Area type="monotone" dataKey="newUsers" name="New Users" stroke="#58d0a6" strokeWidth={2} fill="url(#usersGradient)" />
          <Area type="monotone" dataKey="unlocked" name="Unlocked" stroke="#d7dbdf" strokeWidth={1.5} fill="transparent" />
          <Area type="monotone" dataKey="referrals" name="Referrals" stroke="#8b93a0" strokeWidth={1.5} fill="transparent" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function ChartEmpty() {
  return (
    <div className="chart-empty">
      <span />
      <p>等待增长数据</p>
    </div>
  );
}
