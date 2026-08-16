import { Dashboard } from "@/components/dashboard";
import { getDashboardData, normalizeRange } from "@/lib/dashboard-data";
import { requireDashboardSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  await requireDashboardSession();
  const params = await searchParams;
  const data = await getDashboardData(normalizeRange(params.range));
  return <Dashboard data={data} />;
}
