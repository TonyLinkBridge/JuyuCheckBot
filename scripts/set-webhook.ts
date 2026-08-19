import "dotenv/config";
import { Bot } from "grammy";
import { loadConfig } from "../src/config.js";
import { TELEGRAM_ALLOWED_UPDATES } from "../src/telegram.js";

const WEBHOOK_PATH = "/telegram/webhook";
const config = loadConfig();
const commandUrl = process.argv[2]?.trim().replace(/\/$/, "");
const baseUrl = commandUrl || config.WEBHOOK_URL;

if (!baseUrl) {
  throw new Error("请提供 Production URL：npm run webhook:set -- https://your-project.vercel.app");
}
if (!config.WEBHOOK_SECRET) {
  throw new Error("请先在本地 .env 配置 WEBHOOK_SECRET（至少 16 个字符）");
}

const url = new URL(baseUrl);
if (url.protocol !== "https:") throw new Error("Webhook 必须使用 HTTPS URL");

const bot = new Bot(config.BOT_TOKEN);
await bot.api.setMyCommands([
  { command: "start", description: "开始域名体检" },
  { command: "check", description: "体检一个域名" },
  { command: "help", description: "查看使用说明" },
  { command: "recent", description: "查看最近体检" },
  { command: "privacy", description: "隐私与数据删除" },
]);
await bot.api.setWebhook(`${url.origin}${WEBHOOK_PATH}`, {
  secret_token: config.WEBHOOK_SECRET,
  allowed_updates: TELEGRAM_ALLOWED_UPDATES,
});

const info = await bot.api.getWebhookInfo();
console.log(`Telegram webhook configured: ${info.url}`);
