import express, { type ErrorRequestHandler } from "express";
import { webhookCallback } from "grammy";
import { createBot } from "./bot.js";
import { loadConfig } from "./config.js";
import { REPORT_VERSION } from "./domain/evidence.js";
import { landingHtml, privacyHtml } from "./privacy.js";

export const TELEGRAM_WEBHOOK_PATH = "/telegram/webhook";

const config = loadConfig();
const bot = createBot(config);
const app = express();
const telegramWebhook = webhookCallback(bot, "express");

app.use(express.json({ limit: "1mb" }));
app.get("/", (_request, response) => {
  response.type("html").send(landingHtml(config.BOT_USERNAME, config.CHANNEL_URL));
});
app.get("/privacy", (_request, response) => {
  response.type("html").send(privacyHtml("JUYU 域名体检"));
});
app.get("/health", (_request, response) => {
  response.status(200).json({ ok: true, service: "juyu-domain-check", version: "0.9.0", reportVersion: REPORT_VERSION });
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
      allowed_updates: ["message", "callback_query"],
    });
    app.listen(config.PORT, () => console.log(`JUYU Domain Check webhook listening on :${config.PORT}`));
    return;
  }

  await bot.api.deleteWebhook({ drop_pending_updates: false });
  bot.start({
    allowed_updates: ["message", "callback_query"],
    onStart: () => console.log("JUYU Domain Check bot started with long polling"),
  });
}

export default app;
