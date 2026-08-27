import { InlineKeyboard } from "grammy";
import type { InlineQueryResultArticle } from "grammy/types";
import type { StoredReport } from "./backend.js";
import type { Config } from "./config.js";
import { encodeDomainParam } from "./domain/normalize.js";
import type { DomainIntent, DomainReport, RegistrationStatus } from "./domain/types.js";

export const welcomeText = `🌐 <b>JUYU 域名体检</b>

一个域名值得继续查、准备买卖，
还是需要 JUYU 协助？

直接发送域名，免费查看：
✓ 注册状态、域龄与 DNS 概况
✓ 到期时间、资料来源与取得时间
✓ 基础警报与下一步方向

完整历史、风险、备案与网站数据会引导到聚查；
购买、出售、注册与咨询都可以在同一个 Bot 完成。

直接发送一个域名，例如：
<code>example.com</code>`;

export function welcomeKeyboard(config: Config): InlineKeyboard {
  return new InlineKeyboard()
    .text("🔍 开始域名体检", "start_check")
    .row()
    .text("🕘 最近体检", "recent_reports")
    .text("🔐 隐私", "privacy")
    .row()
    .text("🤝 委托购买", "commerce:start:buy")
    .text("💰 提交出售", "commerce:start:sell")
    .row()
    .text("💬 联系 JUYU", "commerce:start:contact")
    .row()
    .url("📡 JUYU 情报局", config.CHANNEL_URL);
}

export const helpText = `🔍 <b>如何使用 JUYU 域名体检</b>

直接发送域名或完整网址，例如：
<code>example.com</code>

免费初检会先显示注册状态、域龄、到期时间、DNS、资料来源和快速结论。选择目的后，订阅 JUYU 情报局即可解锁进阶摘要；需要完整历史、备案、中国商标、国内平台风险或网站数据时进入聚查。购买、出售、注册和联系 JUYU 都在本 Bot 内完成。

常用命令：
/recent 最近体检
/buy 委托购买域名
/sell 提交出售域名
/contact 联系 JUYU
/cancel 取消当前提交
/privacy 隐私与数据删除

<i>结果仅供初步筛查，不替代商标、法律、安全、估值或交易尽调。</i>`;

export function checkingText(domain: string): string {
  return `🔍 正在查询 <b>${escapeHtml(domain)}</b> 的注册资料与 DNS…`;
}

export function previewReportText(report: DomainReport): string {
  return `✅ <b>JUYU 域名初检</b>

🌐 <b>${escapeHtml(report.domain)}</b>

注册状态　${registrationStatusLine(report.rdap.status)}
域名年龄　${report.ageYears === null ? "○ 暂未取得" : `<b>${formatYears(report.ageYears)} 年</b>`}
到期时间　${formatDate(report.rdap.expiresAt)}
DNS 状态　${dnsStatusLine(report)}
基础提醒　${shareAttentionCount(report) ? `⚠️ ${shareAttentionCount(report)} 项` : "✅ 本次未发现明确警报"}

资料来源　${registrationSource(report)}
取得时间　${formatDateTime(report.rdap.source.checkedAt)}

━━━━━━━━━━━━━━
<b>快速结论</b>
${escapeHtml(decisionConclusion(report, "research"))}

<i>这是免费初筛，不代替完整尽调。选择你的目的后查看下一步。</i>`;
}

export const intentPromptText = `为了给你真正有用的下一步：
<b>你查这个域名，是为了什么？</b>`;

export function intentKeyboard(token: string): InlineKeyboard {
  return new InlineKeyboard()
    .text("💼 我是域名持有人", `intent:owner:${token}`)
    .row()
    .text("🎯 我想购买这个域名", `intent:buyer:${token}`)
    .row()
    .text("🔍 只是研究看看", `intent:research:${token}`)
    .row()
    .text("🔄 忽略缓存｜重新检查", `refresh:${token}`);
}

export function gateText(config: Config): string {
  return `🔒 <b>解锁 JUYU 进阶体检摘要</b>

进阶摘要包含：
✓ 一句话说明这个域名现在是什么情况
✓ 最重要的 2–3 项可验证依据
✓ 需要继续核查的重点
✓ 根据买家 / 持有人 / 研究目的给出下一步

完整历史、ICP 备案、中国商标、国内平台风险、网站与价格资料，需前往聚查继续查询。

免费订阅
<b>${escapeHtml(config.CHANNEL_NAME)}</b>
即可解锁。`;
}

export function gateKeyboard(config: Config, token: string, intent: DomainIntent): InlineKeyboard {
  return new InlineKeyboard()
    .url("📡 订阅 JUYU 情报局", config.CHANNEL_URL)
    .row()
    .text("✅ 我已订阅｜立即解锁", `unlock:${intent}:${token}`);
}

export function fullReportText(report: DomainReport, intent: DomainIntent): string {
  const evidenceItems = decisionEvidence(report).slice(0, 4);
  const attentionItems = decisionAttention(report);
  const evidence = evidenceItems.map((item) => `• ${escapeHtml(item)}`).join("\n");
  const attention = attentionItems.slice(0, 2).map((item) => `• ${escapeHtml(item)}`).join("\n");
  const remainingAttention = Math.max(0, attentionItems.length - 2);

  return `🔓 <b>JUYU 进阶体检摘要</b>

🌐 <b>${escapeHtml(report.domain)}</b>

━━━━━━━━━━━━━━
💡 <b>一句话结论</b>

${escapeHtml(decisionConclusion(report, intent))}

━━━━━━━━━━━━━━
✅ <b>本次已确认</b>

${evidence}

⚠️ <b>值得注意</b>

${attention}${remainingAttention ? `\n• 另有 ${remainingAttention} 项建议到聚查继续核验` : ""}

━━━━━━━━━━━━━━
🎯 <b>JUYU 建议</b>

${escapeHtml(actionAdvice(report, intent))}

━━━━━━━━━━━━━━
🔒 <b>聚查可继续查询</b>

• 完整 WHOIS 与注册技术资料
• 历史 WHOIS 与历史 DNS
• ICP 备案与国内平台风险
• 中国商标与品牌近似检索
• 网站与搜索表现
• 历史价格与市场资料

<i>${escapeHtml(report.reportVersion)} · ${formatDateTime(report.checkedAt)}
Bot 只提供初筛摘要，不代替聚查完整查询、估值、商标、法律或交易尽调。</i>`;
}

export function technicalReportText(report: DomainReport): string {
  const registrar = report.rdap.registrar ? escapeHtml(report.rdap.registrar) : "未公开 / 未获取";
  const age = report.ageYears === null ? "未知" : `${formatYears(report.ageYears)} 年`;
  const dnssec = report.rdap.dnssec === null ? "未知" : report.rdap.dnssec ? "已启用" : "未启用";
  const evidenceLines = report.evidenceItems
    .map((item) => `${item.available ? "✓" : "○"} ${escapeHtml(item.label)}`)
    .join("　");
  const structureLines = report.observations.map((item) => `• ${escapeHtml(item)}`).join("\n");
  const alerts = report.alerts.length
    ? report.alerts.map((item, index) => `${padIndex(index)} ${escapeHtml(item)}`).join("\n")
    : "本次基础检查未发现明显警报";

  return `📋 <b>JUYU 技术资料</b>

🌐 <b>${escapeHtml(report.domain)}</b>
资料取得：<b>${evidenceCount(report)}</b>
资料来源：${registrationSource(report)}

━━━━━━━━━━━━━━
📋 <b>可验证数据</b>
• 注册状态：${registrationLabel(report.rdap.status)}
• 注册商：${registrar}
• 注册日期：${formatDate(report.rdap.createdAt)}
• 更新日期：${formatDate(report.rdap.updatedAt)}
• 域名年龄：${age}
• 到期日期：${formatDate(report.rdap.expiresAt)}
• DNS 解析：${report.dns.checked === false ? "数据暂不可用" : report.dns.resolves ? "正常" : "未发现有效解析"}
• DNSSEC：${dnssec}

<b>DNS 明细</b>
• A：${formatValues(report.dns.ipv4)}
• AAAA：${formatValues(report.dns.ipv6)}
• 注册资料域名服务器（NS）：${formatValues(report.rdap.nameServers)}
• DNS 域名服务器（NS）：${formatValues(report.dns.nameServers)}
• MX：${formatValues(report.dns.mx.map((item) => `${item.priority} ${item.exchange}`))}

<b>资料出处</b>
• 注册资料：${registrationSource(report)}
• 权威性：${report.rdap.source.authoritative ? "权威注册局资料" : "中转或暂不可用"}
• 取得时间：${formatDateTime(report.rdap.source.checkedAt)}
• DNS：${escapeHtml(report.dns.source.name)}
• DNS 时间：${formatDateTime(report.dns.source.checkedAt)}

<b>已取得项目</b>
${evidenceLines}

━━━━━━━━━━━━━━
🔎 <b>名称结构事实</b>
${structureLines}

<b>基础警报</b>
${alerts}

<i>${escapeHtml(report.reportVersion)} · 数据取得 ${evidenceCount(report)}
体检时间：${formatDateTime(report.checkedAt)}
这是原始技术资料页。没有取得的资料会明确显示，不会换算成 JUYU 分数。注册可用性以对应注册服务的实时结果为准。</i>`;
}

export function fullReportKeyboard(
  config: Config,
  report: DomainReport,
  intent: DomainIntent,
  token: string,
): InlineKeyboard {
  const keyboard = new InlineKeyboard().url(
    intent === "buyer"
      ? "🔍 去聚查完成购买前尽调"
      : intent === "owner"
        ? "📊 去聚查查看完整域名资料"
        : "🔓 去聚查查看完整资料",
    juchaHandoffLink(config, report.domain, intent, token),
  );

  if (intent === "owner") {
    keyboard.row().text("💰 提交 JUYU 出售 / 深度评估", `lead:owner:${token}`);
  } else if (intent === "buyer") {
    keyboard
      .row()
      .text(
        report.rdap.status === "available" ? "🎯 委托 JUYU 协助注册" : "🤝 委托 JUYU 协助收购",
        `lead:buyer:${token}`,
      );
  }
  keyboard.row().text("📤 生成分享卡", `share:${intent}:${token}`);
  keyboard.row().text("🔄 重新实时检查", `refresh:${token}`);
  keyboard.row().text("🔎 继续体检", "check_another");
  return keyboard;
}

export function technicalReportKeyboard(token: string): InlineKeyboard {
  return new InlineKeyboard()
    .url("®️ 中国商标官方查询", "https://sbj.cnipa.gov.cn/sbj/sbcx/")
    .row()
    .text("🔄 重新实时检查", `refresh:${token}`)
    .row()
    .text("🔎 继续体检", "check_another");
}

export function shareCardText(report: DomainReport): string {
  return `📤 <b>JUYU 域名初检</b>

🌐 <b>${escapeHtml(report.domain)}</b>

💡 <b>${escapeHtml(decisionConclusion(report, "research"))}</b>

━━━━━━━━━━━━━━
✅ <b>已确认资料</b>
${shareSignalLines(report)}

资料覆盖　基础 ${evidenceCount(report)}
值得注意　${shareAttentionCount(report) ? `⚠️ ${shareAttentionCount(report)} 项` : "✅ 本次未发现明确警报"}

━━━━━━━━━━━━━━
👇 <b>你也可以免费查一个域名</b>

<i>数据注明来源 · 不做自创评分
免费域名体检 · Powered by JUYU 聚域</i>`;
}

export function shareCardKeyboard(token: string): InlineKeyboard {
  return new InlineKeyboard()
    .switchInline("📤 分享带按钮的体检", `share_${token}`)
    .row()
    .text("🔎 继续体检", "check_another");
}

export function inlineShareResult(
  config: Config,
  report: DomainReport,
  token: string,
): InlineQueryResultArticle {
  const reportLink = referralLink(config.BOT_USERNAME, token);
  return {
    type: "article",
    id: `share_${token}`.slice(0, 64),
    title: `分享 ${report.domain} 的 JUYU 体检`,
    description: decisionConclusion(report, "research"),
    input_message_content: {
      message_text: shareCardText(report),
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
    },
    reply_markup: new InlineKeyboard()
      .url("🔍 免费检查我的域名", reportLink),
  };
}

export function inlineShareToken(query: string): string | null {
  return /^share_([A-Za-z0-9_-]+)$/.exec(query)?.[1] ?? null;
}

export function referralWelcomeText(report: DomainReport): string {
  return `👋 <b>朋友分享了一份 JUYU 域名体检</b>

🌐 <b>${escapeHtml(report.domain)}</b>

💡 <b>${escapeHtml(decisionConclusion(report, "research"))}</b>

✅ <b>已确认资料</b>
${shareSignalLines(report)}

资料覆盖　基础 ${evidenceCount(report)}
值得注意　${shareAttentionCount(report) ? `⚠️ ${shareAttentionCount(report)} 项` : "✅ 本次未发现明确警报"}

━━━━━━━━━━━━━━
🔍 <b>现在体检你的域名</b>

直接发送一个域名，例如：
<code>yourdomain.com</code>

先免费查看结论和可信信号，订阅后解锁针对买家、持有人或研究目的的 JUYU 建议。`;
}

export function referralWelcomeKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text("🔍 体检我的域名", "start_check");
}

export function recentReportsText(reports: StoredReport[]): string {
  if (!reports.length) return "🕘 <b>最近体检</b>\n\n还没有保存的报告。直接发送一个域名开始体检。";
  return `🕘 <b>最近体检</b>\n\n选择一份报告重新查看：`;
}

export function recentReportsKeyboard(reports: StoredReport[]): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  for (const item of reports) {
    keyboard.text(`${item.report.domain} · ${registrationShortLabel(item.report.rdap.status)}`, `history:${item.reportToken}`).row();
  }
  return keyboard.text("🔎 新体检", "start_check");
}

export function privacyKeyboard(config: Config): InlineKeyboard {
  const policyUrl = config.WEBHOOK_URL ? `${config.WEBHOOK_URL}/privacy` : "https://www.juyu.com/";
  return new InlineKeyboard()
    .url("📄 查看完整隐私说明", policyUrl)
    .row()
    .text("🗑 删除我的数据", "delete_data_request");
}

export const deleteDataConfirmText = `⚠️ <b>确认删除数据？</b>

这会删除与你的 Telegram 用户 ID 关联的体检报告、使用意图、来源和产品事件。操作无法恢复。`;

export function deleteDataConfirmKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text("确认永久删除", "delete_data_confirm").text("取消", "delete_data_cancel");
}

export function rateLimitText(scope: "minute" | "day", retryAfterSeconds: number): string {
  if (scope === "day") {
    const hours = Math.max(1, Math.ceil(retryAfterSeconds / 3600));
    return `⏳ 今天的免费体检次数已经用完，请约 ${hours} 小时后再试。`;
  }
  return `⏳ 操作有点快，请 ${Math.max(1, retryAfterSeconds)} 秒后再试。`;
}

export const verificationUnavailableText = `⚠️ 暂时无法连接 Telegram 验证订阅状态。

这不代表你没有订阅，请稍后再次点击「立即解锁」。`;

export function notSubscribedText(config: Config): string {
  return `还没有检测到订阅状态。\n\n请先订阅 <b>${escapeHtml(config.CHANNEL_NAME)}</b>，然后回来再次点击「立即解锁」。\n\n🔔 建议开启通知，不错过每日域名情报；通知状态不会作为解锁条件。`;
}

export function botShareLink(botUsername: string, domain: string): string {
  const payload = `share_${encodeDomainParam(domain)}`;
  return payload.length <= 64
    ? `https://t.me/${botUsername}?start=${encodeURIComponent(payload)}`
    : `https://t.me/${botUsername}?start=share`;
}

function referralLink(botUsername: string, token: string): string {
  return `https://t.me/${botUsername}?start=${encodeURIComponent(`ref_${token}`)}`;
}

export function juchaHandoffLink(
  config: Pick<Config, "JUCHA_URL" | "WEBHOOK_URL">,
  domain: string,
  intent: DomainIntent,
  reportToken: string,
): string {
  if (config.WEBHOOK_URL) {
    const url = new URL("/go/jucha", config.WEBHOOK_URL);
    url.searchParams.set("report", reportToken);
    url.searchParams.set("intent", intent);
    return url.toString();
  }
  return juchaDomainLink(config.JUCHA_URL, domain, intent);
}

export function juchaDomainLink(baseUrl: string, domain: string, intent: DomainIntent = "research"): string {
  const url = new URL(baseUrl);
  if (domain) {
    url.pathname = `/zonghe/${encodeURIComponent(domain)}`;
    url.search = "";
  }
  url.searchParams.set("utm_source", "telegram");
  url.searchParams.set("utm_medium", "bot");
  url.searchParams.set("utm_campaign", "juyu_domain_check");
  url.searchParams.set("utm_content", intent);
  return url.toString();
}

function actionAdvice(report: DomainReport, intent: DomainIntent): string {
  if (report.rdap.status === "unknown") {
    return "当前资料源无法确认注册状态。先由 JUYU 或对应注册服务完成复核，再决定购买、出售或开发，避免把“没有资料”误认为“可以注册”。";
  }
  if (intent === "owner") {
    return "这些公开信号可以用于初筛，但不能直接等同于成交价格。JUYU 可以进一步结合真实买家需求、同类成交与使用场景，协助你判断继续持有、开发或提交出售。";
  }
  if (intent === "buyer") {
    if (report.rdap.status === "available") {
      return "注册资料源暂未发现记录。先在注册商实时复核并检查商标；确认无误后，可交给 JUYU 协助注册或寻找更合适的替代域名。";
    }
    if (report.dns.resolves) {
      return "这个域名已注册且 DNS 正常解析，不能把到期日当成即将释放的承诺。如果你确实需要它，下一步应核对商标、收购可行性与替代方案，再交给 JUYU 协助接触持有人。";
    }
    return "这个域名已经注册，但公开资料不足以判断持有人是否愿意出售。下一步应先做历史与商标核查，再由 JUYU 评估收购或替代域名方案。";
  }
  return "把这些可验证资料作为候选比较依据，而不是最终估值。建议再比较 2–3 个域名；如准备购买、出售或建立品牌，可进入 JUYU 做进一步判断。";
}

function decisionConclusion(report: DomainReport, intent: DomainIntent): string {
  if (report.rdap.status === "unknown") {
    return "当前资料不足以确认注册状态，不能据此判断这个域名是否可注册或适合交易。";
  }
  if (report.rdap.status === "available") {
    return "权威注册资料暂未发现记录，但正式注册前仍需实时复核可用性与商标风险。";
  }
  if (intent === "buyer") {
    return report.dns.resolves
      ? "这是一个已经注册且 DNS 正常解析的域名，不能通过普通注册渠道直接取得。"
      : "这个域名已经注册，但现有公开资料不足以判断它是否正在使用或愿意出售。";
  }
  if (intent === "owner") {
    return report.dns.resolves
      ? "已确认这个域名的注册资料与 DNS 状态，但这些技术事实不能直接等同于出售价格。"
      : "已确认域名注册资料；商业价值仍需结合买家需求、使用场景与市场资料判断。";
  }
  return report.dns.resolves
    ? "已确认域名注册资料与 DNS 状态；商业价值仍需结合历史、商标与市场资料判断。"
    : "已确认域名注册资料，但现有资料不足以判断商业价值。";
}

function decisionEvidence(report: DomainReport): string[] {
  const items: string[] = [];
  if (report.rdap.status === "registered") {
    const age = report.ageYears === null ? "注册年龄未知" : `已注册 ${formatYears(report.ageYears)} 年`;
    const expiry = report.rdap.expiresAt ? `，资料显示到期日为 ${formatDate(report.rdap.expiresAt)}` : "";
    items.push(`${age}${expiry}`);
  } else if (report.rdap.status === "available") {
    items.push("权威注册资料源本次未发现注册记录");
  } else {
    items.push("注册资料源本次无法确认状态");
  }

  if (report.dns.checked) {
    const mail = report.dns.mx.length ? "，并配置邮件服务" : "";
    items.push(report.dns.resolves ? `DNS 正常解析${mail}` : "本次未发现有效 DNS 解析");
  }

  if (report.rdap.dnssec !== null) items.push(`DNSSEC：${report.rdap.dnssec ? "已启用" : "未启用"}`);
  return items.length ? items : ["本次没有取得足够的可验证资料"];
}

function decisionAttention(report: DomainReport): string[] {
  const items = [...report.alerts];
  if (report.rdap.dnssec === false) {
    items.push("注册资料显示 DNSSEC 未启用；这不代表网站一定不安全，但属于可进一步核对的 DNS 防护项");
  }
  return [...new Set(items)].length
    ? [...new Set(items)]
    : ["本次可用资料未发现明确警报；仍需按实际用途进行商标、内容与交易核查"];
}

function shareSignalLines(report: DomainReport): string {
  const items: string[] = [];
  if (report.rdap.status === "registered") {
    items.push(report.ageYears === null ? "注册状态：已注册" : `注册历史：${formatYears(report.ageYears)} 年`);
  } else if (report.rdap.status === "available") {
    items.push("注册资料：权威资料源暂未发现记录");
  } else {
    items.push("注册资料：当前仍需复核");
  }
  if (report.dns.checked) items.push(`DNS：${report.dns.resolves ? "正常解析" : "未发现有效解析"}`);

  if (report.rdap.expiresAt) items.push(`到期时间：${formatDate(report.rdap.expiresAt)}`);
  return items.slice(0, 3).map((item) => `• ${escapeHtml(item)}`).join("\n");
}

function shareAttentionCount(report: DomainReport): number {
  return decisionAttention(report).filter((item) => !item.startsWith("本次可用资料未发现明确警报")).length;
}


function registrationLabel(status: RegistrationStatus): string {
  if (status === "registered") return "已注册";
  if (status === "available") return "未发现注册记录";
  return "暂时无法确认";
}

function evidenceCount(report: DomainReport): string {
  return `${report.evidenceItems.filter((item) => item.available).length}/${report.evidenceItems.length} 项`;
}


function registrationStatusLine(status: RegistrationStatus): string {
  if (status === "registered") return "✅ 已确认注册";
  if (status === "available") return "○ 资料源未发现记录";
  return "⚠️ 暂时无法确认";
}

function registrationShortLabel(status: RegistrationStatus): string {
  if (status === "registered") return "已注册";
  if (status === "available") return "未发现记录";
  return "待确认";
}

function dnsStatusLine(report: DomainReport): string {
  if (!report.dns.checked) return "⚠️ 本次未取得";
  return report.dns.resolves ? "✅ 解析正常" : "○ 未发现解析";
}

function registrationSource(report: DomainReport): string {
  const name = escapeHtml(report.rdap.source.name);
  return report.rdap.source.url
    ? `<a href="${escapeHtml(report.rdap.source.url)}">${name}</a>`
    : name;
}

function formatValues(values: string[], limit = 4): string {
  if (!values.length) return "未发现";
  const visible = values.slice(0, limit).map(escapeHtml);
  const remaining = values.length - visible.length;
  return `${visible.join("、")}${remaining > 0 ? `（另有 ${remaining} 条）` : ""}`;
}

function padIndex(index: number): string {
  return String(index + 1).padStart(2, "0");
}

function formatYears(years: number): string {
  return years < 1 ? Math.max(0.1, years).toFixed(1) : years.toFixed(1);
}

function formatDate(date: Date | null): string {
  if (!date) return "未知";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
