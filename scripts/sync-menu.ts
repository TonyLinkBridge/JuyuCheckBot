import "dotenv/config";
import { Bot } from "grammy";
import { loadConfig } from "../src/config.js";
import { syncBotMenu, TELEGRAM_COMMANDS } from "../src/telegram-menu.js";

const bot = new Bot(loadConfig().BOT_TOKEN);
await syncBotMenu(bot.api);
const published = await bot.api.getMyCommands({ scope: { type: "all_private_chats" } });
if (TELEGRAM_COMMANDS.some((command) => !published.some((item) => item.command === command.command))) {
  throw new Error("菜单尚未完整同步，请稍后重试。");
}
console.log(`Telegram 菜单已确认：${published.map((command) => command.command).join(", ")}`);
