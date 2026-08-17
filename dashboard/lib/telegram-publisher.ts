import "server-only";
import { botDeepLink, type PollDraft, type PollTarget } from "@/lib/poll";

type TelegramMessage = {
  message_id: number;
  chat: { username?: string };
};

type TelegramResponse = {
  ok: boolean;
  result?: TelegramMessage;
  description?: string;
};

export type PollPublisherStatus = {
  configured: boolean;
  botUsername: string;
  testTarget: string;
  productionTarget: string;
};

function publisherConfig() {
  return {
    token: process.env.TELEGRAM_BOT_TOKEN?.trim() || process.env.BOT_TOKEN?.trim() || "",
    botUsername: (process.env.BOT_USERNAME?.trim() || "JuyuCheckBot").replace(/^@/, ""),
    testTarget: process.env.POLL_TEST_CHAT_ID?.trim() || "@juyuofficial",
    productionTarget: process.env.POLL_PRODUCTION_CHAT_ID?.trim() || "@JUYU007",
  };
}

export function getPollPublisherStatus(): PollPublisherStatus {
  const config = publisherConfig();
  return {
    configured: config.token.length >= 20,
    botUsername: config.botUsername,
    testTarget: publicTargetLabel(config.testTarget, "测试频道"),
    productionTarget: publicTargetLabel(config.productionTarget, "正式频道"),
  };
}

export async function sendTelegramPoll(draft: PollDraft): Promise<{
  messageUrl?: string;
  messageId: number;
  target: PollTarget;
}> {
  const config = publisherConfig();
  if (config.token.length < 20) {
    throw new Error("Dashboard 尚未配置 TELEGRAM_BOT_TOKEN。请先在 Vercel 加入同一个 BotFather Token。 ");
  }

  const chatId = draft.target === "production" ? config.productionTarget : config.testTarget;
  const response = await fetch(`https://api.telegram.org/bot${config.token}/sendPoll`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      question: draft.question,
      options: draft.options.map((text) => ({ text })),
      is_anonymous: true,
      allows_multiple_answers: false,
      reply_markup: {
        inline_keyboard: [[{
          text: draft.buttonText,
          url: botDeepLink(config.botUsername, draft.campaign),
        }]],
      },
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });

  let payload: TelegramResponse;
  try {
    payload = await response.json() as TelegramResponse;
  } catch {
    throw new Error("Telegram 暂时没有返回有效结果，请稍后重试。 ");
  }

  if (!response.ok || !payload.ok || !payload.result) {
    throw new Error(telegramErrorMessage(payload.description));
  }

  const username = payload.result.chat.username;
  return {
    messageId: payload.result.message_id,
    target: draft.target,
    messageUrl: username ? `https://t.me/${username}/${payload.result.message_id}` : undefined,
  };
}

function telegramErrorMessage(description: string | undefined): string {
  if (!description) return "Telegram 发布失败，请检查 Bot 与频道配置。";
  if (/chat not found/i.test(description)) return "找不到目标频道。请检查频道用户名或数字 Chat ID。";
  if (/not enough rights|administrator|forbidden/i.test(description)) {
    return "Bot 没有发消息权限。请确认它已经成为该频道管理员，并开放 Post Messages。";
  }
  return `Telegram 发布失败：${description.slice(0, 180)}`;
}

function publicTargetLabel(value: string, fallback: string): string {
  return value.startsWith("@") ? value : fallback;
}
