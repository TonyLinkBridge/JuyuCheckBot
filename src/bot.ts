import { Bot, Context, GrammyError, HttpError, InlineKeyboard } from "grammy";
import { AttributionStore, sourceFromStartPayload } from "./attribution.js";
import { createBackend, type StoredReport } from "./backend.js";
import { advanceCommerceChoice, advanceCommerceText, resumeCommerceFlow, startCommerceFlow } from "./commerce/flow.js";
import {
  commerceAdminText,
  commerceCompleteText,
  commerceInvalidText,
  commercePromptKeyboard,
  commercePromptText,
  commerceResumeKeyboard,
  commerceResumeText,
} from "./commerce/messages.js";
import { parseCommerceStartPayload } from "./commerce/start.js";
import type { CommerceAction, CommerceSession, CommerceTransition } from "./commerce/types.js";
import type { Config } from "./config.js";
import { checkDomain } from "./domain/check.js";
import { decodeDomainParam, DomainInputError, normalizeDomain } from "./domain/normalize.js";
import { REPORT_VERSION } from "./domain/evidence.js";
import type { DomainIntent, DomainReport } from "./domain/types.js";
import {
  checkingText,
  deleteDataConfirmKeyboard,
  deleteDataConfirmText,
  fullReportKeyboard,
  fullReportText,
  gateKeyboard,
  gateText,
  helpText,
  intentKeyboard,
  intentPromptText,
  inlineShareResult,
  inlineShareToken,
  notSubscribedText,
  previewReportText,
  privacyKeyboard,
  rateLimitText,
  recentReportsKeyboard,
  recentReportsText,
  referralWelcomeKeyboard,
  referralWelcomeText,
  shareCardKeyboard,
  shareCardText,
  juchaHandoffLink,
  verificationUnavailableText,
  welcomeKeyboard,
  welcomeText,
} from "./messages.js";
import { privacyBotText, PRIVACY_RETENTION_DAYS } from "./privacy.js";
import { ReportStore } from "./report-store.js";
import { UpdateDeduplicator } from "./update-deduplicator.js";

const html = { parse_mode: "HTML" as const, link_preview_options: { is_disabled: true } };
const reportCacheMs = 15 * 60 * 1000;

export function createBot(config: Config): Bot {
  const bot = new Bot(config.BOT_TOKEN);
  const reports = new ReportStore();
  const attribution = new AttributionStore();
  const backend = createBackend(config);
  const updates = new UpdateDeduplicator();
  let lastCleanupAt = 0;

  bot.use(async (ctx, next) => {
    if (!updates.accept(ctx.update.update_id)) return;
    await next();
  });

  bot.command("start", async (ctx) => {
    const from = ctx.from;
    if (!from) return;
    const userId = from.id;
    const payload = ctx.match?.trim();
    const referralToken = payload?.startsWith("ref_") ? payload.slice("ref_".length) : null;
    const sharedReferral = referralToken ? await backend.getReferralReport(referralToken) : null;
    const isSelfReferral = sharedReferral?.telegramUserId === userId;
    const requestedSource = referralToken && !sharedReferral ? "direct" : sourceFromStartPayload(payload);
    const source = attribution.set(userId, isSelfReferral ? "direct" : requestedSource);
    const identity = await backend.identifyUser(userId, source, {
      username: from.username,
      firstName: from.first_name,
      lastName: from.last_name,
    });
    const startEvents = [
      backend.track({
        eventName: "bot_started",
        telegramUserId: userId,
        source,
        metadata: { isNew: identity.isNew },
      }),
    ];
    if (identity.isNew) {
      startEvents.push(backend.track({ eventName: "user_created", telegramUserId: userId, source }));
    }
    if (Date.now() - lastCleanupAt > 24 * 60 * 60 * 1000) {
      lastCleanupAt = Date.now();
      startEvents.push(backend.cleanupExpiredData(PRIVACY_RETENTION_DAYS));
    }

    const commerceStart = parseCommerceStartPayload(payload);
    if (commerceStart) {
      await Promise.all(startEvents);
      await beginCommerce(ctx, commerceStart.action, commerceStart.domain, undefined, source);
      return;
    }

    if (referralToken && sharedReferral) {
      if (isSelfReferral) {
        await Promise.all([
          ...startEvents,
          ctx.reply(`👀 <b>这是你生成的分享页面</b>\n\n${shareCardText(sharedReferral.report)}`, {
            ...html,
            reply_markup: shareCardKeyboard(referralToken),
          }),
        ]);
        return;
      }
      const alreadyRecorded = await backend.hasReferralOpen(userId, referralToken);
      const referralEvents = alreadyRecorded
        ? []
        : [
            backend.track({
              eventName: "referral_opened" as const,
              telegramUserId: userId,
              source,
              domain: sharedReferral.report.domain,
              reportToken: referralToken,
              metadata: { isNew: identity.isNew },
            }),
          ];
      await Promise.all([
        ...startEvents,
        ...referralEvents,
        ctx.reply(referralWelcomeText(sharedReferral.report), {
          ...html,
          reply_markup: referralWelcomeKeyboard(),
        }),
      ]);
      return;
    }
    if (payload?.startsWith("share_")) {
      const encoded = payload.slice("share_".length);
      if (encoded) {
        await Promise.all([...startEvents, runCheck(ctx, decodeDomainParam(encoded))]);
        return;
      }
    }
    if (payload?.startsWith("check_")) {
      attribution.set(userId, "share");
      await Promise.all([...startEvents, runCheck(ctx, decodeDomainParam(payload.slice("check_".length)))]);
      return;
    }
    const unfinished = await backend.getCommerceSession(userId);
    if (unfinished) {
      await Promise.all([
        ...startEvents,
        ctx.reply(commerceResumeText(unfinished), { ...html, reply_markup: commerceResumeKeyboard() }),
      ]);
      return;
    }
    await Promise.all([
      ...startEvents,
      ctx.reply(welcomeText, { ...html, reply_markup: welcomeKeyboard(config) }),
    ]);
  });

  bot.command("help", (ctx) => ctx.reply(helpText, html));
  bot.command("privacy", (ctx) => ctx.reply(privacyBotText, { ...html, reply_markup: privacyKeyboard(config) }));
  bot.command("recent", (ctx) => showRecentReports(ctx));
  bot.command("check", async (ctx) => {
    const domain = ctx.match?.trim();
    if (!domain) {
      await ctx.reply("请在命令后输入域名，例如：<code>/check example.com</code>", html);
      return;
    }
    await runCheck(ctx, domain);
  });
  bot.command("buy", async (ctx) => beginCommerce(ctx, "buy", ctx.match?.trim() || undefined));
  bot.command("sell", async (ctx) => beginCommerce(ctx, "sell", ctx.match?.trim() || undefined));
  bot.command("register", async (ctx) => beginCommerce(ctx, "register", ctx.match?.trim() || undefined));
  bot.command("contact", async (ctx) => beginCommerce(ctx, "contact"));
  bot.command("cancel", async (ctx) => cancelCommerce(ctx));
  bot.command("notifytest", async (ctx) => {
    const allowed = config.ADMIN_CHAT_ID
      && (String(ctx.from?.id) === config.ADMIN_CHAT_ID || String(ctx.chat.id) === config.ADMIN_CHAT_ID);
    if (!allowed) {
      await ctx.reply(config.ADMIN_CHAT_ID ? "⛔ 只有已配置的管理员可以测试 Lead 通知。" : "⚠️ ADMIN_CHAT_ID 尚未配置。", html);
      return;
    }
    await ctx.api.sendMessage(config.ADMIN_CHAT_ID!, "✅ <b>JUYU Lead 管理员通知测试成功</b>", html);
  });

  bot.callbackQuery(/^commerce:start:(buy|sell|register|contact)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await beginCommerce(ctx, ctx.match[1] as CommerceAction);
  });

  bot.callbackQuery("commerce:resume", async (ctx) => {
    const session = await backend.getCommerceSession(ctx.from.id);
    if (!session) {
      await ctx.answerCallbackQuery({ text: "没有未完成的操作。", show_alert: true });
      return;
    }
    await ctx.answerCallbackQuery();
    await sendCommerceTransition(ctx, resumeCommerceFlow(session), false);
  });

  bot.callbackQuery("commerce:cancel", async (ctx) => {
    await ctx.answerCallbackQuery();
    await cancelCommerce(ctx);
  });

  bot.callbackQuery(/^commerce:choice:(.+)$/, async (ctx) => {
    const session = await backend.getCommerceSession(ctx.from.id);
    if (!session) {
      await ctx.answerCallbackQuery({ text: "这个操作已经过期，请重新开始。", show_alert: true });
      return;
    }
    await ctx.answerCallbackQuery();
    await sendCommerceTransition(ctx, advanceCommerceChoice(session, ctx.match[1] ?? ""), true);
  });

  bot.callbackQuery("start_check", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply("🔍 请直接发送一个域名，例如：<code>example.com</code>", html);
  });

  bot.callbackQuery("check_another", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply("🔎 请直接发送下一个域名，例如：<code>example.com</code>", html);
  });

  bot.callbackQuery("recent_reports", async (ctx) => {
    await ctx.answerCallbackQuery();
    await showRecentReports(ctx);
  });

  bot.callbackQuery("privacy", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply(privacyBotText, { ...html, reply_markup: privacyKeyboard(config) });
  });

  bot.callbackQuery("delete_data_request", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply(deleteDataConfirmText, { ...html, reply_markup: deleteDataConfirmKeyboard() });
  });

  bot.callbackQuery("delete_data_cancel", async (ctx) => {
    await ctx.answerCallbackQuery({ text: "已取消" });
    await ctx.editMessageText("✅ 已取消删除。你的数据没有改变。", html);
  });

  bot.callbackQuery("delete_data_confirm", async (ctx) => {
    await ctx.answerCallbackQuery({ text: "正在删除…" });
    const deleted = await backend.deleteUserData(ctx.from.id);
    if (!deleted) {
      await ctx.reply("⚠️ 数据删除暂时失败，请稍后重试或通过 JUYU.com 联系我们。", html);
      return;
    }
    reports.deleteUser(ctx.from.id);
    attribution.delete(ctx.from.id);
    await ctx.editMessageText("✅ 与你的 Telegram 用户 ID 关联的 JUYU 体检数据已删除。", html);
  });

  bot.callbackQuery(/^refresh:([A-Za-z0-9_-]+)$/, async (ctx) => {
    const token = ctx.match[1];
    if (!token) return;
    const stored = await resolveReport(token, ctx.from.id);
    if (!stored) {
      await ctx.answerCallbackQuery({ text: "体检结果已过期，请重新发送域名。", show_alert: true });
      return;
    }
    await ctx.answerCallbackQuery({ text: "正在绕过缓存重新查询…" });
    await Promise.all([
      backend.track({
        eventName: "refresh_requested",
        telegramUserId: ctx.from.id,
        source: stored.source,
        domain: stored.report.domain,
        reportToken: token,
      }),
      runCheck(ctx, stored.report.domain, true),
    ]);
  });

  bot.callbackQuery(/^history:([A-Za-z0-9_-]+)$/, async (ctx) => {
    const token = ctx.match[1];
    if (!token) return;
    const stored = await resolveReport(token, ctx.from.id);
    if (!stored) {
      await ctx.answerCallbackQuery({ text: "报告不存在或已过期。", show_alert: true });
      return;
    }
    await ctx.answerCallbackQuery();
    await Promise.all([
      backend.track({
        eventName: "history_viewed",
        telegramUserId: ctx.from.id,
        source: stored.source,
        domain: stored.report.domain,
        reportToken: token,
      }),
      ctx.reply(`${previewReportText(stored.report)}\n\n${intentPromptText}`, {
        ...html,
        reply_markup: intentKeyboard(token),
      }),
    ]);
  });

  bot.callbackQuery(/^share:(owner|buyer|research):([A-Za-z0-9_-]+)$/, async (ctx) => {
    const intent = ctx.match[1] as DomainIntent;
    const token = ctx.match[2];
    if (!token) return;
    const stored = await resolveReport(token, ctx.from.id);
    if (!stored) {
      await ctx.answerCallbackQuery({ text: "报告不存在或已过期。", show_alert: true });
      return;
    }
    await ctx.answerCallbackQuery({ text: "分享卡已生成" });
    await Promise.all([
      backend.track({
        eventName: "share_generated",
        telegramUserId: ctx.from.id,
        source: stored.source,
        domain: stored.report.domain,
        reportToken: token,
        intent,
      }),
      ctx.reply(shareCardText(stored.report), {
        ...html,
        reply_markup: shareCardKeyboard(token),
      }),
    ]);
  });

  bot.callbackQuery(/^technical:(owner|buyer|research):([A-Za-z0-9_-]+)$/, async (ctx) => {
    const intent = ctx.match[1] as DomainIntent;
    const token = ctx.match[2];
    if (!token) return;
    const stored = await resolveReport(token, ctx.from.id);
    if (!stored) {
      await ctx.answerCallbackQuery({ text: "报告不存在或已过期。", show_alert: true });
      return;
    }
    const link = juchaHandoffLink(config, stored.report.domain, intent, token);
    await ctx.answerCallbackQuery({ text: "完整技术资料已移至聚查" });
    await Promise.all([
      backend.track({
        eventName: "jucha_handoff",
        telegramUserId: ctx.from.id,
        source: stored.source,
        domain: stored.report.domain,
        reportToken: token,
        intent,
      }),
      ctx.reply("🔎 <b>完整技术资料请到聚查继续查询</b>\n\n可继续查看网站历史、历史 WHOIS、备案、黑名单、平台风险、SEO 与历史价格。", {
        ...html,
        reply_markup: new InlineKeyboard().url("🔓 打开聚查完整查询", link),
      }),
    ]);
  });

  bot.callbackQuery(/^lead:(owner|buyer):([A-Za-z0-9_-]+)$/, async (ctx) => {
    const intent = ctx.match[1] as Extract<DomainIntent, "owner" | "buyer">;
    const token = ctx.match[2];
    if (!token) return;
    const stored = await resolveReport(token, ctx.from.id);
    if (!stored) {
      await ctx.answerCallbackQuery({ text: "体检结果已过期，请重新发送域名。", show_alert: true });
      return;
    }
    const action = intent === "owner" ? "sell" : stored.report.rdap.status === "available" ? "register" : "buy";
    await ctx.answerCallbackQuery({ text: action === "sell" ? "开始提交出售需求" : action === "register" ? "开始注册协助" : "开始收购委托" });
    await beginCommerce(ctx, action, stored.report.domain, token, stored.source);
  });

  bot.callbackQuery(/^intent:(owner|buyer|research):([A-Za-z0-9_-]+)$/, async (ctx) => {
    const intent = ctx.match[1] as DomainIntent;
    const token = ctx.match[2];
    if (!token) return;
    const stored = await resolveReport(token, ctx.from.id);
    if (!stored) {
      await ctx.answerCallbackQuery({ text: "体检结果已过期，请重新发送域名。", show_alert: true });
      return;
    }
    const { report, source } = stored;
    await ctx.answerCallbackQuery({ text: `已选择：${intentLabel(intent)}` });
    const [membership] = await Promise.all([
      channelMembership(bot, config, ctx.from.id),
      backend.track({
        eventName: "intent_selected",
        telegramUserId: ctx.from.id,
        source,
        domain: report.domain,
        reportToken: token,
        intent,
      }),
      backend.saveReport({ reportToken: token, telegramUserId: ctx.from.id, source, report, intent }),
    ]);

    if (membership === "member") {
      await deliverFullReport(ctx, report, token, intent, source);
    } else if (membership === "unavailable") {
      await verificationUnavailable(ctx, report, token, intent, source);
    } else {
      await Promise.all([
        backend.track({
          eventName: "gate_shown",
          telegramUserId: ctx.from.id,
          source,
          domain: report.domain,
          reportToken: token,
          intent,
        }),
        ctx.reply(gateText(config), { ...html, reply_markup: gateKeyboard(config, token, intent) }),
      ]);
    }
  });

  bot.callbackQuery(/^unlock:(owner|buyer|research):([A-Za-z0-9_-]+)$/, async (ctx) => {
    const intent = ctx.match[1] as DomainIntent;
    const token = ctx.match[2];
    if (!token) return;
    const stored = await resolveReport(token, ctx.from.id);
    if (!stored) {
      await ctx.answerCallbackQuery({ text: "体检结果已过期，请重新发送域名。", show_alert: true });
      return;
    }
    const { report, source } = stored;
    await ctx.answerCallbackQuery({ text: "正在验证订阅状态…" });
    const membership = await channelMembership(bot, config, ctx.from.id);
    if (membership === "unavailable") {
      await verificationUnavailable(ctx, report, token, intent, source);
      return;
    }
    if (membership === "not_member") {
      await Promise.all([
        backend.track({
          eventName: "unlock_failed",
          telegramUserId: ctx.from.id,
          source,
          domain: report.domain,
          reportToken: token,
          intent,
        }),
        ctx.reply(notSubscribedText(config), { ...html, reply_markup: gateKeyboard(config, token, intent) }),
      ]);
      return;
    }
    await deliverFullReport(ctx, report, token, intent, source);
  });

  bot.on("inline_query", async (ctx) => {
    const token = inlineShareToken(ctx.inlineQuery.query);
    if (!token) {
      await ctx.answerInlineQuery([], { cache_time: 0, is_personal: true });
      return;
    }

    try {
      const stored = await backend.getReferralReport(token);
      const results = stored ? [inlineShareResult(config, stored.report, token)] : [];
      await ctx.answerInlineQuery(results, { cache_time: 0, is_personal: true });
    } catch (error) {
      console.error("Unable to prepare inline share", error instanceof Error ? error.message : "unknown error");
      await ctx.answerInlineQuery([], { cache_time: 0, is_personal: true });
    }
  });

  bot.on("message:text", async (ctx) => {
    if (ctx.chat.type !== "private") return;
    const session = await backend.getCommerceSession(ctx.from.id);
    if (session) {
      await sendCommerceTransition(ctx, advanceCommerceText(session, ctx.message.text), true);
      return;
    }
    await runCheck(ctx, ctx.message.text);
  });

  async function beginCommerce(
    ctx: Context,
    action: CommerceAction,
    domain?: string,
    reportToken?: string,
    sourceOverride?: string,
  ): Promise<void> {
    const userId = ctx.from?.id;
    if (!userId) return;
    const source = sourceOverride ?? await sourceForUser(userId);
    let transition: CommerceTransition;
    try {
      transition = startCommerceFlow(action, { domain, source, reportToken });
    } catch {
      await ctx.reply("⚠️ 域名格式不正确，请重新发送，例如：<code>example.com</code>", html);
      return;
    }
    if (transition.kind !== "prompt") return;
    const saved = await backend.saveCommerceSession(userId, transition.session);
    if (!saved) {
      await ctx.reply("⚠️ 暂时无法开始提交，请稍后重试。", html);
      return;
    }
    await Promise.all([
      backend.track({
        eventName: "lead_started",
        telegramUserId: userId,
        source,
        domain: transition.session.data.domain,
        reportToken,
        intent: commerceIntent(action),
        metadata: { action, step: transition.session.step },
      }),
      ctx.reply(commercePromptText(transition), {
        ...html,
        reply_markup: commercePromptKeyboard(transition.prompt),
      }),
    ]);
  }

  async function sendCommerceTransition(
    ctx: Context,
    transition: CommerceTransition,
    trackStep: boolean,
  ): Promise<void> {
    const userId = ctx.from?.id;
    if (!userId) return;
    if (transition.kind === "invalid") {
      await ctx.reply(commerceInvalidText(transition.reason), html);
      return;
    }
    if (transition.kind === "complete") {
      await completeCommerce(ctx, transition.lead);
      return;
    }
    const saved = await backend.saveCommerceSession(userId, transition.session);
    if (!saved) {
      await ctx.reply("⚠️ 暂时无法保存这一步，请稍后重试。", html);
      return;
    }
    const source = transition.session.data.source;
    const tasks: Promise<unknown>[] = [
      ctx.reply(commercePromptText(transition), {
        ...html,
        reply_markup: commercePromptKeyboard(transition.prompt),
      }),
    ];
    if (trackStep) {
      tasks.push(backend.track({
        eventName: "lead_step_completed",
        telegramUserId: userId,
        source,
        domain: transition.session.data.domain,
        reportToken: transition.session.data.report_token,
        intent: commerceIntent(transition.session.flow),
        metadata: { action: transition.session.flow, step: transition.session.step },
      }));
    }
    await Promise.all(tasks);
  }

  async function completeCommerce(ctx: Context, lead: Extract<CommerceTransition, { kind: "complete" }>["lead"]): Promise<void> {
    const from = ctx.from;
    if (!from) return;
    const leadId = await backend.createLead(from.id, from.username, lead);
    if (leadId === null) {
      await ctx.reply("⚠️ 资料暂时无法提交。你的当前步骤已经保留，请稍后再试。", html);
      return;
    }
    const source = lead.data.source;
    const action = lead.data.service === "register" ? "register" : lead.leadType;
    const submitted = backend.track({
      eventName: "lead_submitted",
      telegramUserId: from.id,
      source,
      domain: lead.data.domain,
      reportToken: lead.data.report_token,
      intent: commerceIntent(action),
      metadata: { action, leadId },
    });
    await Promise.all([
      backend.clearCommerceSession(from.id),
      submitted,
      ctx.reply(commerceCompleteText(leadId, lead), {
        ...html,
        reply_markup: new InlineKeyboard()
          .text("🔍 继续体检", "start_check")
          .row()
          .url("📡 JUYU 情报局", config.CHANNEL_URL),
      }),
    ]);

    const notified = await notifyCommerceAdmin(leadId, { id: from.id, username: from.username }, lead);
    if (!notified) {
      await backend.track({
        eventName: "lead_notification_failed",
        telegramUserId: from.id,
        source,
        domain: lead.data.domain,
        reportToken: lead.data.report_token,
        intent: commerceIntent(action),
        metadata: { action, leadId, reason: config.ADMIN_CHAT_ID ? "telegram_send_failed" : "admin_chat_not_configured" },
      });
    }
  }

  async function notifyCommerceAdmin(
    leadId: number,
    user: { id: number; username?: string },
    lead: Extract<CommerceTransition, { kind: "complete" }>["lead"],
  ): Promise<boolean> {
    if (!config.ADMIN_CHAT_ID) {
      console.error(`Lead #${leadId} saved but ADMIN_CHAT_ID is not configured`);
      return false;
    }
    try {
      await bot.api.sendMessage(config.ADMIN_CHAT_ID, commerceAdminText(leadId, user, lead), html);
      return true;
    } catch (error) {
      console.error(`Lead #${leadId} admin notification failed`, error instanceof Error ? error.message : "unknown error");
      return false;
    }
  }

  async function cancelCommerce(ctx: Context): Promise<void> {
    const userId = ctx.from?.id;
    if (!userId) return;
    const session = await backend.getCommerceSession(userId);
    if (!session) {
      await ctx.reply("目前没有进行中的提交。", html);
      return;
    }
    const cleared = await backend.clearCommerceSession(userId);
    if (!cleared) {
      await ctx.reply("⚠️ 暂时无法取消，请稍后重试。", html);
      return;
    }
    await Promise.all([
      backend.track({
        eventName: "lead_cancelled",
        telegramUserId: userId,
        source: session.data.source,
        domain: session.data.domain,
        reportToken: session.data.report_token,
        intent: commerceIntent(session.flow),
        metadata: { action: session.flow, step: session.step },
      }),
      ctx.reply("✅ 已取消当前操作。你可以继续发送域名进行体检。", html),
    ]);
  }

  bot.catch((error) => {
    const cause = error.error;
    if (cause instanceof GrammyError) console.error(`Telegram API error: ${cause.error_code}`);
    else if (cause instanceof HttpError) console.error("Telegram network error");
    else console.error("Unhandled bot error", cause instanceof Error ? cause.message : "unknown error");
  });

  async function runCheck(ctx: Context, raw: string, forceRefresh = false): Promise<void> {
    let domain;
    try {
      domain = normalizeDomain(raw);
    } catch (error) {
      const message = error instanceof DomainInputError ? error.message : "无法识别这个域名，请重试。";
      await ctx.reply(`⚠️ ${message}`, html);
      return;
    }

    const userId = ctx.from?.id;
    if (!userId) return;
    const checkStartedAt = Date.now();
    const source = await sourceForUser(userId);
    const rateLimit = await backend.checkRateLimit(userId);
    if (!rateLimit.allowed) {
      await Promise.all([
        backend.track({
          eventName: "rate_limited",
          telegramUserId: userId,
          source,
          domain: domain.ascii,
          metadata: { scope: rateLimit.scope, retryAfterSeconds: rateLimit.retryAfterSeconds },
        }),
        ctx.reply(rateLimitText(rateLimit.scope, rateLimit.retryAfterSeconds), html),
      ]);
      return;
    }

    const submittedEvent = backend.track({
      eventName: "domain_submitted",
      telegramUserId: userId,
      source,
      domain: domain.ascii,
    });
    const progress = await ctx.reply(checkingText(domain.ascii), html);
    let report: DomainReport;
    let cached = false;
    try {
      const cachedReport = forceRefresh
        ? null
        : await backend.getRecentReport(domain.ascii, REPORT_VERSION, reportCacheMs);
      cached = Boolean(cachedReport);
      [report] = await Promise.all([
        cachedReport
          ? Promise.resolve(cachedReport)
          : checkDomain(domain, {
              timeoutMs: config.CHECK_TIMEOUT_MS,
            }),
        submittedEvent,
      ]);
      const token = reports.put(userId, report);
      const persisted = await backend.saveReport({ reportToken: token, telegramUserId: userId, source, report });
      if (backend.enabled && !persisted) throw new Error("Report persistence failed");
      const preview = `${previewReportText(report)}\n\n${intentPromptText}`;
      try {
        await ctx.api.editMessageText(ctx.chat!.id, progress.message_id, preview, {
          ...html,
          reply_markup: intentKeyboard(token),
        });
      } catch {
        await ctx.reply(preview, { ...html, reply_markup: intentKeyboard(token) });
      }
      await backend.track({
        eventName: "preview_shown",
        telegramUserId: userId,
        source,
        domain: report.domain,
        reportToken: token,
        metadata: {
          reportVersion: report.reportVersion,
          cached,
          forcedRefresh: forceRefresh,
          dataCoverage: report.dataCoverage,
          evidenceAvailable: report.evidenceItems.filter((item) => item.available).length,
          evidenceTotal: report.evidenceItems.length,
          registrationStatus: report.rdap.status,
          registrationSource: report.rdap.source.type,
          registrationSourceName: report.rdap.source.name,
          registrationAuthoritative: report.rdap.source.authoritative,
          dnsChecked: report.dns.checked,
          alertCount: report.alerts.length,
          durationMs: Date.now() - checkStartedAt,
        },
      });
    } catch (error) {
      console.error(`Domain check failed for ${domain.ascii}`, error instanceof Error ? error.message : "unknown error");
      await backend.track({
        eventName: "check_failed",
        telegramUserId: userId,
        source,
        domain: domain.ascii,
        metadata: {
          durationMs: Date.now() - checkStartedAt,
          stage: "report_generation",
        },
      });
      const failureText = "⚠️ 体检服务暂时繁忙，请稍后再试，或发送另一个域名。";
      try {
        await ctx.api.editMessageText(ctx.chat!.id, progress.message_id, failureText);
      } catch {
        await ctx.reply(failureText, html);
      }
    }
  }

  async function showRecentReports(ctx: Context): Promise<void> {
    const userId = ctx.from?.id;
    if (!userId) return;
    const source = await sourceForUser(userId);
    const recent = await backend.listReports(userId, 5);
    await Promise.all([
      backend.track({ eventName: "history_viewed", telegramUserId: userId, source }),
      ctx.reply(recentReportsText(recent), { ...html, reply_markup: recentReportsKeyboard(recent) }),
    ]);
  }

  async function deliverFullReport(
    ctx: Context,
    report: DomainReport,
    token: string,
    intent: DomainIntent,
    source: string,
  ): Promise<void> {
    await Promise.all([
      backend.track({
        eventName: "report_unlocked",
        telegramUserId: ctx.from!.id,
        source,
        domain: report.domain,
        reportToken: token,
        intent,
      }),
      ctx.reply(fullReportText(report, intent), {
        ...html,
        reply_markup: fullReportKeyboard(config, report, intent, token),
      }),
    ]);
  }

  async function verificationUnavailable(
    ctx: Context,
    report: DomainReport,
    token: string,
    intent: DomainIntent,
    source: string,
  ): Promise<void> {
    await Promise.all([
      backend.track({
        eventName: "verification_unavailable",
        telegramUserId: ctx.from!.id,
        source,
        domain: report.domain,
        reportToken: token,
        intent,
      }),
      ctx.reply(verificationUnavailableText, { ...html, reply_markup: gateKeyboard(config, token, intent) }),
    ]);
  }

  async function resolveReport(token: string, userId: number): Promise<StoredReport | null> {
    const cached = reports.get(token, userId);
    if (cached) {
      return {
        reportToken: token,
        telegramUserId: userId,
        source: await sourceForUser(userId),
        report: cached,
      };
    }
    return backend.getReport(token, userId);
  }

  async function sourceForUser(userId: number): Promise<string> {
    const cached = attribution.peek(userId);
    if (cached) return cached;
    const persisted = await backend.getUserSource(userId);
    if (persisted) return attribution.set(userId, persisted);
    return "direct";
  }

  console.log(`Backend mode: ${backend.enabled ? "Supabase" : "memory"}`);
  return bot;
}

type MembershipResult = "member" | "not_member" | "unavailable";

async function channelMembership(bot: Bot, config: Config, userId: number): Promise<MembershipResult> {
  try {
    const member = await bot.api.getChatMember(`@${config.CHANNEL_USERNAME}`, userId);
    if (member.status === "creator" || member.status === "administrator" || member.status === "member") {
      return "member";
    }
    if (member.status === "restricted" && member.is_member) return "member";
    return "not_member";
  } catch {
    console.error("Unable to verify channel membership");
    return "unavailable";
  }
}

function intentLabel(intent: DomainIntent): string {
  if (intent === "owner") return "我拥有这个域名";
  if (intent === "buyer") return "我想购买这个域名";
  return "只是研究看看";
}

function commerceIntent(action: string): DomainIntent | undefined {
  if (action === "sell") return "owner";
  if (action === "buy" || action === "register") return "buyer";
  return undefined;
}
