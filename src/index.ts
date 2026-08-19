import express, { type ErrorRequestHandler } from "express";
import { webhookCallback } from "grammy";
import { createBackend } from "./backend.js";
import { createBot } from "./bot.js";
import { loadConfig } from "./config.js";
import { REPORT_VERSION } from "./domain/evidence.js";
import type { DomainIntent } from "./domain/types.js";
import { juchaDomainLink } from "./messages.js";
import { landingHtml, privacyHtml } from "./privacy.js";
import { TELEGRAM_ALLOWED_UPDATES } from "./telegram.js";

export const TELEGRAM_WEBHOOK_PATH = "/telegram/webhook";

const config = loadConfig();
const bot = createBot(config);
const backend = createBackend(config);
const app = express();
const telegramWebhook = webhookCallback(bot, "express");

app.use(express.json({ limit: "1mb" }));
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
app.get("/health", (_request, response) => {
  response.status(200).json({
    ok: true,
    service: "juyu-domain-check",
    version: "0.15.0",
    reportVersion: REPORT_VERSION,
    externalData: {
      tranco: "enabled",
      wayback: "enabled",
      crux: config.GOOGLE_CRUX_API_KEY ? "configured" : "not_configured",
      ahrefs: config.AHREFS_API_KEY ? "configured" : "not_configured",
    },
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
  await bot.api.setMyCommands([
    { command: "start", description: "开始域名体检" },
    { command: "check", description: "体检一个域名" },
    { command: "help", description: "查看使用说明" },
    { command: "recent", description: "查看最近体检" },
    { command: "privacy", description: "隐私与数据删除" },
  ]);

  if (config.WEBHOOK_URL && config.WEBHOOK_SECRET) {
    await bot.api.setWebhook(`${config.WEBHOOK_URL}${TELEGRAM_WEBHOOK_PATH}`, {
      secret_token: config.WEBHOOK_SECRET,
      allowed_updates: TELEGRAM_ALLOWED_UPDATES,
    });
    app.listen(config.PORT, () => console.log(`JUYU Domain Check webhook listening on :${config.PORT}`));
    return;
  }

  await bot.api.deleteWebhook({ drop_pending_updates: false });
  bot.start({
    allowed_updates: TELEGRAM_ALLOWED_UPDATES,
    onStart: () => console.log("JUYU Domain Check bot started with long polling"),
  });
}

export default app;
