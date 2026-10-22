import type { Bot } from "grammy";
import { TELEGRAM_ALLOWED_UPDATES } from "./telegram.js";

export function assertLocalPollingSafe(env: NodeJS.ProcessEnv, webhookUrl: string): void {
  if (env.LOCAL_POLLING !== "true") {
    throw new Error("本地 Bot 默认不启动。请使用独立测试 Bot，并明确设置 LOCAL_POLLING=true。");
  }
  if (webhookUrl) {
    throw new Error("此 Bot 已连接 Webhook；为保护线上服务，本地启动已拒绝接管。请改用独立测试 Bot。");
  }
}

export async function runSafeLocalPolling(bot: Bot, env: NodeJS.ProcessEnv, signal?: AbortSignal): Promise<void> {
  assertLocalPollingSafe(env, "");
  assertLocalPollingSafe(env, (await bot.api.getWebhookInfo()).url ?? "");
  await bot.init();
  let offset = 0;
  // bot.start() deletes webhooks internally, so the local loop only uses getUpdates.
  while (!signal?.aborted) {
    try {
      const updates = await bot.api.getUpdates({ offset, timeout: 5, allowed_updates: TELEGRAM_ALLOWED_UPDATES });
      for (const update of updates) {
        await bot.handleUpdate(update);
        offset = update.update_id + 1;
      }
    } catch (error) { if (!signal?.aborted) throw error; }
  }
}
