import express, { type ErrorRequestHandler } from "express";
import { webhookCallback } from "grammy";
import { createBackend } from "./backend.js";
import { createBot } from "./bot.js";
import { loadConfig } from "./config.js";
import { REPORT_VERSION } from "./domain/evidence.js";
import type { DomainIntent } from "./domain/types.js";
import { juchaDomainLink } from "./messages.js";
import { landingHtml, privacyHtml } from "./privacy.js";
import { dispatchLeadNotifications } from "./commerce/notifications.js";
import { notificationWorkerAuthorized } from "./commerce/notification-auth.js";
import { assertLocalPollingSafe, runSafeLocalPolling } from "./local-runtime.js";
import { checkSystemHealth, type SystemHealth } from "./health.js";

export const TELEGRAM_WEBHOOK_PATH = "/telegram/webhook";

const config = loadConfig();
const backend = createBackend(config);
const bot = createBot(config, backend);
const app = express();
const telegramWebhook = webhookCallback(bot, "express");

app.use(express.json({ limit: "1mb" }));
app.post("/internal/lead-notifications", async (request, response, next) => {
  if (!notificationWorkerAuthorized(request.header("Authorization"), config.WEBHOOK_SECRET)) {
    response.sendStatus(401);
    return;
  }
  try {
    response.json(await dispatchLeadNotifications(backend, bot.api, config));
  } catch (error) { next(error); }
});
app.get("/", (_request, response) => {
  response.type("html").send(landingHtml(config.BOT_USERNAME, config.CHANNEL_URL));
});
app.get("/privacy", (_request, response) => {
  response.type("html").send(privacyHtml("JUYU 域名体检"));
});
app.get("/go/jucha", async (request, response) => {
  const reportToken = typeof request.query.report === "string" && /^[A-Za-z0-9_-]+$/.test(request.query.report)
    ? request.query.report
    : "";
  const requestedIntent = request.query.intent;
  const intent: DomainIntent = requestedIntent === "owner" || requestedIntent === "buyer" ? requestedIntent : "research";
  let domain = "";

  if (reportToken) {
    try {
      const stored = await backend.getReferralReport(reportToken);
      if (stored) {
        domain = stored.report.domain;
        await backend.track({
          eventName: "jucha_handoff",
          telegramUserId: stored.telegramUserId,
          source: stored.source,
          domain,
          reportToken,
          intent,
          metadata: { target: "jucha", destination: "integrated_query" },
        });
      }
    } catch (error) {
      console.error("Unable to track Jucha handoff", error instanceof Error ? error.message : "unknown error");
    }
  }

  response.redirect(302, juchaDomainLink(config.JUCHA_URL, domain, intent));
});
let healthCache: { value: SystemHealth; expiresAt: number } | null = null;
app.get("/health", async (_request, response) => {
  const health = healthCache && healthCache.expiresAt > Date.now() ? healthCache.value
    : await checkSystemHealth(config, backend, bot.api);
  healthCache = { value: health, expiresAt: Date.now() + 15_000 };
  response.set("Cache-Control", "no-store").status(health.ok ? 200 : 503).json({
    ...health,
    service: "juyu-domain-check",
    version: "0.16.0",
    reportVersion: REPORT_VERSION,
    dataPolicy: "registry-and-dns",
  });
});
app.post(TELEGRAM_WEBHOOK_PATH, async (request, response, next) => {
  if (!config.WEBHOOK_SECRET) {
    response.status(503).json({ ok: false, error: "webhook_not_configured" });
    return;
  }
  if (request.header("X-Telegram-Bot-Api-Secret-Token") !== config.WEBHOOK_SECRET) {
    response.sendStatus(403);
    return;
  }

  try {
    await telegramWebhook(request, response);
  } catch (error) {
    next(error);
  }
});

const handleError: ErrorRequestHandler = (error, _request, response, _next) => {
  console.error("Webhook request failed", error instanceof Error ? error.message : "unknown error");
  if (!response.headersSent) response.status(500).json({ ok: false });
};
app.use(handleError);

if (process.env.VERCEL !== "1") {
  await startLocalProcess();
}

async function startLocalProcess(): Promise<void> {
  // Refuse before any Telegram mutation, including command/menu synchronisation.
  assertLocalPollingSafe(process.env, config.WEBHOOK_URL ?? "");
  const shutdown = new AbortController();
  process.once("SIGINT", () => shutdown.abort());
  process.once("SIGTERM", () => shutdown.abort());
  await runSafeLocalPolling(bot, process.env, shutdown.signal);
}

export default app;
