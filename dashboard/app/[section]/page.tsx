import { notFound } from "next/navigation";
import { Dashboard } from "@/components/dashboard";
import { requireDashboardSession } from "@/lib/auth";
import { getDashboardData, normalizeRange } from "@/lib/dashboard-data";
import { isDashboardSection } from "@/lib/dashboard-sections";

export const dynamic = "force-dynamic";

export default async function DashboardSectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<{ range?: string }>;
}) {
  await requireDashboardSession();
  const [{ section }, query] = await Promise.all([params, searchParams]);
  if (!isDashboardSection(section)) notFound();
  const data = await getDashboardData(normalizeRange(query.range));
  return <Dashboard data={data} activeSection={section} />;
}
