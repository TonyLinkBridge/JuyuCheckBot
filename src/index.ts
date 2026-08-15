import express from "express";
import { webhookCallback } from "grammy";
import { createBot } from "./bot.js";
import { loadConfig } from "./config.js";

const config = loadConfig();
const bot = createBot(config);

await bot.api.setMyCommands([
  { command: "start", description: "开始域名体检" },
  { command: "check", description: "体检一个域名" },
  { command: "help", description: "查看使用说明" },
]);

if (config.WEBHOOK_URL && config.WEBHOOK_SECRET) {
  const app = express();
  const path = `/telegram/${config.WEBHOOK_SECRET}`;
  const telegramWebhook = webhookCallback(bot, "express");
  app.use(express.json());
  app.get("/health", (_request, response) => response.status(200).json({ ok: true }));
  app.post(path, (request, response) => {
    if (request.header("X-Telegram-Bot-Api-Secret-Token") !== config.WEBHOOK_SECRET) {
      response.sendStatus(403);
      return;
    }
    void telegramWebhook(request, response);
  });

  await bot.api.setWebhook(`${config.WEBHOOK_URL}${path}`, {
    secret_token: config.WEBHOOK_SECRET,
    allowed_updates: ["message", "callback_query"],
  });
  app.listen(config.PORT, () => console.log(`JUYU Domain Check webhook listening on :${config.PORT}`));
} else {
  await bot.api.deleteWebhook({ drop_pending_updates: false });
  bot.start({
    allowed_updates: ["message", "callback_query"],
    onStart: () => console.log("JUYU Domain Check bot started with long polling"),
  });
}
