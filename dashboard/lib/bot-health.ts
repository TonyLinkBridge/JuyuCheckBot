import "server-only";

export type BotHealth = {
  status: "healthy" | "degraded" | "unavailable";
  checkedAt: string | null;
  checks: Record<"database" | "commerce" | "telegram" | "webhook" | "notifications", "healthy" | "degraded" | "unavailable">;
};
export async function loadBotHealth(): Promise<BotHealth> {
  const unavailable: BotHealth = { status: "unavailable", checkedAt: null,
    checks: { database: "unavailable", commerce: "unavailable", telegram: "unavailable", webhook: "unavailable", notifications: "unavailable" } };
  try {
    const response = await fetch(process.env.BOT_HEALTH_URL ?? "https://juyu-check-bot.vercel.app/health", {
      cache: "no-store", signal: AbortSignal.timeout(10_000),
    });
    const body = await response.json();
    const checkedAt = Date.parse(body.checkedAt);
    if (!Number.isFinite(checkedAt) || checkedAt > Date.now() + 30_000 || Date.now()-checkedAt > 120_000
      || !body.checks || !Object.keys(unavailable.checks).every((key) =>
        ["healthy", "degraded", "unavailable"].includes(body.checks[key]))) return unavailable;
    const ok = response.ok && body.ok === true && Object.keys(unavailable.checks).every((key) => body.checks[key] === "healthy");
    return { status: ok ? "healthy" : "degraded", checkedAt: new Date(checkedAt).toISOString(),
      checks: Object.fromEntries(Object.keys(unavailable.checks).map((key) => [key, body.checks[key]])) as BotHealth["checks"] };
  } catch { return unavailable; }
}
