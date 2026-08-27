export const dashboardSections = [
  { id: "inbox", href: "/inbox", label: "跟进收件箱", eyebrow: "OPERATIONS INBOX", description: "优先处理有买卖意向、解锁失败或资料异常的用户。" },
  { id: "leads", href: "/leads", label: "商业 Leads", eyebrow: "JUYU COMMERCE", description: "查看用户已提交的购买、注册、出售与咨询需求。" },
  { id: "users", href: "/users", label: "用户管理", eyebrow: "AUDIENCE", description: "查看真实 Telegram 用户 ID、来源、域名和最近行为。" },
  { id: "funnel", href: "/funnel", label: "转化漏斗", eyebrow: "CONVERSION", description: "快速判断用户主要卡在哪一步。" },
  { id: "sources", href: "/sources", label: "来源分析", eyebrow: "ACQUISITION", description: "比较不同入口带来的新用户与实际激活表现。" },
  { id: "quality", href: "/quality", label: "数据质量", eyebrow: "DATA HEALTH", description: "查看影响体检可信度和用户体验的关键指标。" },
  { id: "activity", href: "/activity", label: "活动记录", eyebrow: "EVENT STREAM", description: "按时间查看用户在 Bot 内发生的真实事件。" },
  { id: "settings", href: "/settings", label: "系统状态", eyebrow: "SYSTEM", description: "确认 Bot、数据库和后台数据更新时间。" },
] as const;

export type DashboardSectionId = (typeof dashboardSections)[number]["id"];

export function isDashboardSection(value: string): value is DashboardSectionId {
  return dashboardSections.some((section) => section.id === value);
}

export function getDashboardSection(id: DashboardSectionId) {
  return dashboardSections.find((section) => section.id === id) ?? dashboardSections[0];
}
