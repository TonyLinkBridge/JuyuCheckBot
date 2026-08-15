import { Bot, Context, GrammyError, HttpError } from "grammy";
import { AttributionStore, sourceFromStartPayload } from "./attribution.js";
import { createBackend } from "./backend.js";
import type { Config } from "./config.js";
import { checkDomain } from "./domain/check.js";
import { decodeDomainParam, DomainInputError, normalizeDomain } from "./domain/normalize.js";
import type { DomainIntent, DomainReport } from "./domain/types.js";
import {
  checkingText,
  fullReportKeyboard,
  fullReportText,
  gateKeyboard,
  gateText,
  helpText,
  intentKeyboard,
  intentPromptText,
  notSubscribedText,
  previewReportText,
  welcomeKeyboard,
  welcomeText,
} from "./messages.js";
import { ReportStore } from "./report-store.js";

const html = { parse_mode: "HTML" as const, link_preview_options: { is_disabled: true } };

export function createBot(config: Config): Bot {
  const bot = new Bot(config.BOT_TOKEN);
  const reports = new ReportStore();
  const attribution = new AttributionStore();
  const backend = createBackend(config);

  bot.command("start", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;
    const payload = ctx.match?.trim();
    const source = attribution.set(userId, sourceFromStartPayload(payload));
    void backend.track({ eventName: "bot_started", telegramUserId: userId, source });

    if (payload?.startsWith("share_")) {
      const encoded = payload.slice("share_".length);
      if (encoded) {
        await runCheck(ctx, decodeDomainParam(encoded));
        return;
      }
    }
    if (payload?.startsWith("check_")) {
      attribution.set(userId, "share");
      await runCheck(ctx, decodeDomainParam(payload.slice("check_".length)));
      return;
    }
    await ctx.reply(welcomeText, { ...html, reply_markup: welcomeKeyboard(config) });
  });

  bot.command("help", (ctx) => ctx.reply(helpText, html));
  bot.command("check", async (ctx) => {
    const domain = ctx.match?.trim();
    if (!domain) {
      await ctx.reply("请在命令后输入域名，例如：<code>/check example.com</code>", html);
      return;
    }
    await runCheck(ctx, domain);
  });

  bot.callbackQuery("start_check", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply("🔍 请直接发送一个域名，例如：<code>example.com</code>", html);
  });

  bot.callbackQuery("check_another", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply("🔎 请直接发送下一个域名，例如：<code>example.com</code>", html);
  });

  bot.callbackQuery(/^intent:(owner|buyer|research):([A-Za-z0-9_-]+)$/, async (ctx) => {
    const intent = ctx.match[1] as DomainIntent;
    const token = ctx.match[2];
    if (!token) {
      await ctx.answerCallbackQuery({ text: "体检链接无效，请重新发送域名。", show_alert: true });
      return;
    }
    const report = reports.get(token, ctx.from.id);
    if (!report) {
      await ctx.answerCallbackQuery({ text: "体检结果已过期，请重新发送域名。", show_alert: true });
      return;
    }

    const source = attribution.get(ctx.from.id);
    await ctx.answerCallbackQuery({ text: `已选择：${intentLabel(intent)}` });
    void backend.track({
      eventName: "intent_selected",
      telegramUserId: ctx.from.id,
      source,
      domain: report.domain,
      reportToken: token,
      intent,
    });
    void backend.saveReport({ reportToken: token, telegramUserId: ctx.from.id, source, report, intent });

    if (await isChannelMember(bot, config, ctx.from.id)) {
      await deliverFullReport(ctx, report, token, intent);
    } else {
      void backend.track({
        eventName: "gate_shown",
        telegramUserId: ctx.from.id,
        source,
        domain: report.domain,
        reportToken: token,
        intent,
      });
      await ctx.reply(gateText(config), {
        ...html,
        reply_markup: gateKeyboard(config, token, intent),
      });
    }
  });

  bot.callbackQuery(/^unlock:(owner|buyer|research):([A-Za-z0-9_-]+)$/, async (ctx) => {
    const intent = ctx.match[1] as DomainIntent;
    const token = ctx.match[2];
    if (!token) {
      await ctx.answerCallbackQuery({ text: "解锁链接无效，请重新发送域名。", show_alert: true });
      return;
    }
    const report = reports.get(token, ctx.from.id);
    if (!report) {
      await ctx.answerCallbackQuery({ text: "体检结果已过期，请重新发送域名。", show_alert: true });
      return;
    }

    const source = attribution.get(ctx.from.id);
    await ctx.answerCallbackQuery({ text: "正在验证订阅状态…" });
    if (!(await isChannelMember(bot, config, ctx.from.id))) {
      void backend.track({
        eventName: "unlock_failed",
        telegramUserId: ctx.from.id,
        source,
        domain: report.domain,
        reportToken: token,
        intent,
      });
      await ctx.reply(notSubscribedText(config), {
        ...html,
        reply_markup: gateKeyboard(config, token, intent),
      });
      return;
    }
    await deliverFullReport(ctx, report, token, intent);
  });

  bot.on("message:text", async (ctx) => {
    if (ctx.chat.type !== "private") return;
    await runCheck(ctx, ctx.message.text);
  });

  bot.catch((error) => {
    const cause = error.error;
    if (cause instanceof GrammyError) console.error(`Telegram API error: ${cause.error_code}`);
    else if (cause instanceof HttpError) console.error("Telegram network error");
    else console.error("Unhandled bot error");
  });

  async function runCheck(ctx: Context, raw: string): Promise<void> {
    let domain;
    try {
      domain = normalizeDomain(raw);
    } catch (error) {
      const message = error instanceof DomainInputError ? error.message : "无法识别这个域名，请重试。";
      await ctx.reply(`⚠️ ${message}`, html);
      return;
    }

    const userId = ctx.from!.id;
    const source = attribution.get(userId);
    void backend.track({ eventName: "domain_submitted", telegramUserId: userId, source, domain: domain.ascii });
    const progress = await ctx.reply(checkingText(domain.ascii), html);
    try {
      const report = await checkDomain(domain, config.CHECK_TIMEOUT_MS);
      const token = reports.put(userId, report);
      await ctx.api.editMessageText(
        ctx.chat!.id,
        progress.message_id,
        `${previewReportText(report)}\n\n${intentPromptText}`,
        { ...html, reply_markup: intentKeyboard(token) },
      );
      void backend.track({
        eventName: "preview_shown",
        telegramUserId: userId,
        source,
        domain: report.domain,
        reportToken: token,
        metadata: { score: report.score, grade: report.grade, scoreVersion: report.scoreVersion },
      });
      void backend.saveReport({ reportToken: token, telegramUserId: userId, source, report });
    } catch {
      console.error(`Domain check failed for ${domain.ascii}`);
      await ctx.api.editMessageText(ctx.chat!.id, progress.message_id, "⚠️ 体检服务暂时繁忙，请稍后再试。");
    }
  }

  async function deliverFullReport(
    ctx: Context,
    report: DomainReport,
    token: string,
    intent: DomainIntent,
  ): Promise<void> {
    const source = attribution.get(ctx.from!.id);
    void backend.track({
      eventName: "report_unlocked",
      telegramUserId: ctx.from!.id,
      source,
      domain: report.domain,
      reportToken: token,
      intent,
    });
    await ctx.reply(fullReportText(report, intent), {
      ...html,
      reply_markup: fullReportKeyboard(config, report, intent),
    });
  }

  console.log(`Backend mode: ${backend.enabled ? "Supabase" : "memory"}`);
  return bot;
}

async function isChannelMember(bot: Bot, config: Config, userId: number): Promise<boolean> {
  try {
    const member = await bot.api.getChatMember(`@${config.CHANNEL_USERNAME}`, userId);
    if (member.status === "creator" || member.status === "administrator" || member.status === "member") return true;
    return member.status === "restricted" && member.is_member;
  } catch {
    console.error("Unable to verify channel membership");
    return false;
  }
}

function intentLabel(intent: DomainIntent): string {
  if (intent === "owner") return "我拥有这个域名";
  if (intent === "buyer") return "我想购买这个域名";
  return "只是研究看看";
}
