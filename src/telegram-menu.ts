import type { Api } from "grammy";

export const TELEGRAM_COMMANDS = [
  { command: "start", description: "开始域名体检" },
  { command: "menu", description: "打开主菜单" },
  { command: "check", description: "体检一个域名" },
  { command: "buy", description: "委托购买域名" },
  { command: "sell", description: "提交出售域名" },
  { command: "register", description: "协助注册域名" },
  { command: "contact", description: "联系 JUYU" },
  { command: "cancel", description: "取消当前提交" },
  { command: "recent", description: "查看最近体检" },
  { command: "privacy", description: "隐私与数据删除" },
  { command: "help", description: "查看使用说明" },
];

// Menu-only publishing: never change the webhook or start a polling process.
export async function syncBotMenu(api: Pick<Api, "setMyCommands">): Promise<void> {
  await api.setMyCommands(TELEGRAM_COMMANDS);
  await api.setMyCommands(TELEGRAM_COMMANDS, { scope: { type: "all_private_chats" } });
}
