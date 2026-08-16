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
              <stop offset="0%" stopColor="var(--green)" stopOpacity={0.26} />
              <stop offset="100%" stopColor="var(--green)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--grid)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--text-soft)", fontSize: 11 }} minTickGap={24} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "var(--text-soft)", fontSize: 11 }} />
          <Tooltip
            cursor={{ stroke: "var(--text-faint)", strokeDasharray: "4 4" }}
            contentStyle={{
              background: "var(--tooltip)",
              border: "1px solid var(--border)",
              borderRadius: 9,
              boxShadow: "0 18px 50px var(--shadow)",
              fontSize: 12,
            }}
            labelStyle={{ color: "var(--text-strong)", marginBottom: 6 }}
            itemStyle={{ color: "var(--text-medium)" }}
          />
          <Area type="monotone" dataKey="newUsers" name="New Users" stroke="var(--green)" strokeWidth={2} fill="url(#usersGradient)" />
          <Area type="monotone" dataKey="unlocked" name="Unlocked" stroke="var(--text-medium)" strokeWidth={1.5} fill="transparent" />
          <Area type="monotone" dataKey="referrals" name="Referrals" stroke="var(--text-faint)" strokeWidth={1.5} fill="transparent" />
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
