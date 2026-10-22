import type { Config } from "./config.js";

export type DatabaseReadiness = { database_ok: boolean; commerce_ok: boolean; stale_notifications: number };
type CheckState = "healthy" | "degraded" | "unavailable";
export type SystemHealth = {
  ok: boolean;
  status: "healthy" | "degraded";
  checkedAt: string;
  scope: string;
  checks: Record<"database" | "commerce" | "telegram" | "webhook" | "notifications", CheckState>;
};
type HealthApi = {
  getMe(): Promise<unknown>;
  getWebhookInfo(): Promise<{ url?: string; pending_update_count: number; last_error_date?: number }>;
  getChat(chatId: string): Promise<unknown>;
};

export async function checkSystemHealth(config: Config, backend: { getReadiness(): Promise<DatabaseReadiness | null> }, api: HealthApi): Promise<SystemHealth> {
  const [database, telegram, webhook, admin] = await Promise.allSettled([
    backend.getReadiness(), api.getMe(), api.getWebhookInfo(),
    config.ADMIN_CHAT_ID ? api.getChat(config.ADMIN_CHAT_ID) : Promise.reject(new Error("unconfigured")),
  ]);
  const ready = database.status === "fulfilled" ? database.value : null;
  const expectedBase = config.WEBHOOK_URL ?? "https://juyu-check-bot.vercel.app";
  const currentWebhook = webhook.status === "fulfilled" ? webhook.value : null;
  const webhookOk = currentWebhook?.url === `${expectedBase}/telegram/webhook`
    && currentWebhook.pending_update_count < 20
    && (!currentWebhook.last_error_date || currentWebhook.last_error_date * 1000 < Date.now() - 10 * 60_000);
  const checks: SystemHealth["checks"] = {
    database: ready?.database_ok ? "healthy" : "unavailable",
    commerce: ready ? ready.commerce_ok ? "healthy" : "degraded" : "unavailable",
    telegram: telegram.status === "fulfilled" ? "healthy" : "unavailable",
    webhook: currentWebhook ? webhookOk ? "healthy" : "degraded" : "unavailable",
    notifications: !ready || admin.status === "rejected" ? "unavailable"
      : ready.stale_notifications > 0 ? "degraded" : "healthy",
  };
  const ok = Object.values(checks).every((state) => state === "healthy");
  return { ok, status: ok ? "healthy" : "degraded", checkedAt: new Date().toISOString(), checks,
    scope: "连接、数据库权限、提交接口、通知配置与队列检查；未试发通知，不代表实际送达，不自动提交需求。" };
}
