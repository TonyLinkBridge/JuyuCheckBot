export function eppAlerts(statuses: string[]): string[] {
  const normalized = new Set(statuses.map(normalizeStatus));
  const alerts: string[] = [];

  if (normalized.has("clienthold") || normalized.has("serverhold") || normalized.has("inactive")) {
    alerts.push("域名状态显示暂停解析，需到注册商或注册局核实原因");
  }
  if (normalized.has("redemptionperiod") || normalized.has("pendingdelete")) {
    alerts.push("域名处于赎回或待删除流程，状态可能快速变化");
  }

  return alerts;
}

function normalizeStatus(value: string): string {
  return value.toLowerCase().replace(/[\s_-]/g, "");
}
