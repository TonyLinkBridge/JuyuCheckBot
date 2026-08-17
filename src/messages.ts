import { InlineKeyboard } from "grammy";
import type { StoredReport } from "./backend.js";
import type { Config } from "./config.js";
import { encodeDomainParam } from "./domain/normalize.js";
import type { DomainIntent, DomainReport, RegistrationStatus } from "./domain/types.js";

export const welcomeText = `🌐 <b>JUYU 域名体检</b>

一个域名值得继续查、准备买卖，
还是需要 JUYU 协助？

直接发送域名，免费查看：
✓ 注册状态、域龄与 DNS 概况
✓ 一项可验证的公开网站信号
✓ 基础警报与下一步方向

完整历史、风险、备案与 SEO 查询会引导到聚查；
明确的购买或出售需求会进入 JUYU 聚域助手。

直接发送一个域名，例如：
<code>example.com</code>`;

export function welcomeKeyboard(config: Config): InlineKeyboard {
  return new InlineKeyboard()
    .text("🔍 开始域名体检", "start_check")
    .row()
    .text("🕘 最近体检", "recent_reports")
    .text("🔐 隐私", "privacy")
    .row()
    .url("📡 JUYU 情报局", config.CHANNEL_URL);
}

export const helpText = `🔍 <b>如何使用 JUYU 域名体检</b>

直接发送域名或完整网址，例如：
<code>example.com</code>

免费 Preview 会先显示注册状态、域龄、DNS、一个公开信号和快速结论。选择目的后，订阅 JUYU 情报局即可解锁进阶摘要；需要完整历史、风险、备案或 SEO 资料时进入聚查，准备购买或出售时进入 JUYU 聚域助手。

常用命令：
/recent 最近体检
/privacy 隐私与数据删除

<i>结果仅供初步筛查，不替代商标、法律、安全、估值或交易尽调。</i>`;

export function checkingText(domain: string): string {
  return `🔍 正在查询 <b>${escapeHtml(domain)}</b> 的权威资料与第三方公开信号…`;
}

export function previewReportText(report: DomainReport): string {
  return `✅ <b>JUYU DOMAIN CHECK</b>

🌐 <b>${escapeHtml(report.domain)}</b>

注册资料　${registrationStatusLine(report.rdap.status)}
域名年龄　${report.ageYears === null ? "○ 暂未取得" : `<b>${formatYears(report.ageYears)} 年</b>`}
DNS　　　${dnsStatusLine(report)}
网站信号　${previewSignalLine(report)}
值得注意　${shareAttentionCount(report) ? `⚠️ ${shareAttentionCount(report)} 项` : "✅ 本次未发现明确警报"}

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

完整历史、备案、黑名单、平台风险、SEO 与价格资料，需前往聚查继续查询。

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
  const evidenceItems = decisionEvidence(report).slice(0, 3);
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
✅ <b>为什么这样判断</b>

${evidence}

⚠️ <b>值得注意</b>

${attention}${remainingAttention ? `\n• 另有 ${remainingAttention} 项建议到聚查继续核验` : ""}

━━━━━━━━━━━━━━
🎯 <b>JUYU 建议</b>

${escapeHtml(actionAdvice(report, intent))}

━━━━━━━━━━━━━━
🔎 <b>完整查询在聚查</b>

网站历史 · 历史 WHOIS · ICP 备案 · 黑名单
平台风险 · SEO 数据 · 历史价格 · 批量导出

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
📋 <b>DATA｜可验证数据</b>
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
• Registry NS：${formatValues(report.rdap.nameServers)}
• DNS NS：${formatValues(report.dns.nameServers)}
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
🌍 <b>WEB INTELLIGENCE｜第三方真实指标</b>
${externalIntelligenceText(report)}

━━━━━━━━━━━━━━
🔎 <b>STRUCTURE｜名称结构事实</b>
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
  const keyboard = new InlineKeyboard();

  if (intent === "owner") {
    keyboard.text("💰 提交 JUYU 出售 / 深度评估", `lead:owner:${token}`);
  } else if (intent === "buyer") {
    keyboard
      .text(
        report.rdap.status === "available" ? "🎯 委托 JUYU 协助注册" : "🤝 委托 JUYU 协助收购",
        `lead:buyer:${token}`,
      );
  } else {
    keyboard.url("🔓 去聚查查看完整尽调", juchaHandoffLink(config, report.domain, intent, token));
  }
  if (intent !== "research") {
    keyboard.row().url("🔎 去聚查查看完整资料", juchaHandoffLink(config, report.domain, intent, token));
  }
  keyboard.row().text("📤 生成分享卡", `share:${intent}:${token}`);
  keyboard.row().text("🔄 重新实时检查", `refresh:${token}`);
  keyboard.row().text("🔎 继续体检", "check_another");
  return keyboard;
}

export function technicalReportKeyboard(token: string): InlineKeyboard {
  return new InlineKeyboard()
    .url("®️ WIPO 官方商标查询", "https://branddb.wipo.int/")
    .row()
    .text("🔄 重新实时检查", `refresh:${token}`)
    .row()
    .text("🔎 继续体检", "check_another");
}

export function shareCardText(report: DomainReport): string {
  return `📤 <b>JUYU DOMAIN CHECK</b>

🌐 <b>${escapeHtml(report.domain)}</b>

💡 <b>${escapeHtml(decisionConclusion(report, "research"))}</b>

━━━━━━━━━━━━━━
✅ <b>可验证信号</b>
${shareSignalLines(report)}

资料覆盖　基础 ${evidenceCount(report)} · 第三方 ${externalEvidenceCount(report)}
值得注意　${shareAttentionCount(report) ? `⚠️ ${shareAttentionCount(report)} 项` : "✅ 本次未发现明确警报"}

━━━━━━━━━━━━━━
👇 <b>你也可以免费查一个域名</b>

<i>数据注明来源 · 不做自创评分
免费域名体检 · Powered by JUYU 聚域</i>`;
}

export function shareCardKeyboard(config: Config, report: DomainReport, token: string): InlineKeyboard {
  const reportLink = referralLink(config.BOT_USERNAME, token);
  const shareText = `我刚用 JUYU 查了 ${report.domain}：\n\n${decisionConclusion(report, "research")}\n\n资料来源和缺失项目都会明确显示，不使用自创评分。你也可以免费查一个域名 👇`;
  return new InlineKeyboard()
    .url(
      "📤 分享这份体检",
      `https://t.me/share/url?url=${encodeURIComponent(reportLink)}&text=${encodeURIComponent(shareText)}`,
    )
    .row()
    .text("🔎 继续体检", "check_another");
}

export function referralWelcomeText(report: DomainReport): string {
  return `👋 <b>朋友分享了一份 JUYU 域名体检</b>

🌐 <b>${escapeHtml(report.domain)}</b>

💡 <b>${escapeHtml(decisionConclusion(report, "research"))}</b>

✅ <b>可验证信号</b>
${shareSignalLines(report)}

资料覆盖　基础 ${evidenceCount(report)} · 第三方 ${externalEvidenceCount(report)}
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

export function commerceLink(botUsername: string, action: string, domain: string): string {
  const payload = `${action}_${encodeDomainParam(domain)}`;
  return payload.length <= 64
    ? `https://t.me/${botUsername}?start=${encodeURIComponent(payload)}`
    : `https://t.me/${botUsername}`;
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
  if (domain) url.searchParams.set("domain", domain);
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
    if (hasActiveWebsiteSignals(report)) {
      return "这个域名正在持续使用，不能把到期日当成即将释放的承诺。如果你确实需要它，下一步应核对商标、收购可行性与替代方案，再交给 JUYU 协助接触持有人。";
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
    return hasActiveWebsiteSignals(report)
      ? "这是一个已经注册且持续使用的域名，不是普通注册渠道可以直接取得的候选。"
      : "这个域名已经注册，但现有公开资料不足以判断它是否正在积极使用或愿意出售。";
  }
  if (intent === "owner") {
    return hasActiveWebsiteSignals(report)
      ? "这个域名具备持续使用和第三方网站信号，但这些信号不能直接等同于出售价格。"
      : "已确认域名注册资料；目前公开网站信号有限，商业价值仍需结合买家需求和使用场景判断。";
  }
  return hasActiveWebsiteSignals(report)
    ? "这是一个已注册并持续使用的成熟网站型域名，公开资料可以验证其网站与链接信号。"
    : "已确认域名注册资料，但现有网站和市场资料有限，暂时不适合下商业价值结论。";
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

  const tranco = report.intelligence.tranco;
  if (tranco.status === "available" && tranco.rank !== null) {
    items.push(`Tranco 全球排名 #${formatInteger(tranco.rank)}${tranco.rankedAt ? `（${tranco.rankedAt}）` : ""}`);
  }
  const ahrefs = report.intelligence.ahrefs;
  if (ahrefs.status === "available" && ahrefs.domainRating !== null) {
    items.push(`Domain Rating by Ahrefs：${formatDecimal(ahrefs.domainRating)} / 100`);
  }
  const crux = report.intelligence.crux;
  if (crux.status === "available") {
    const values = [
      crux.lcpP75Ms === null ? null : `LCP ${formatInteger(crux.lcpP75Ms)} ms`,
      crux.inpP75Ms === null ? null : `INP ${formatInteger(crux.inpP75Ms)} ms`,
      crux.clsP75 === null ? null : `CLS ${crux.clsP75.toFixed(3)}`,
    ].filter((value): value is string => value !== null);
    if (values.length) items.push(`Google 真实用户 p75：${values.join("、")}`);
  }
  return items.length ? items : ["本次没有取得足够的可验证资料"];
}

function decisionAttention(report: DomainReport): string[] {
  const items = [...report.alerts];
  const crux = report.intelligence.crux;
  if (crux.status === "available") {
    if (crux.lcpP75Ms !== null && crux.lcpP75Ms > 2500) {
      items.push(`Google LCP ${formatInteger(crux.lcpP75Ms)} ms，页面主要内容加载速度需要改善`);
    }
    if (crux.inpP75Ms !== null && crux.inpP75Ms > 200) {
      items.push(`Google INP ${formatInteger(crux.inpP75Ms)} ms，互动响应速度需要改善`);
    }
    if (crux.clsP75 !== null && crux.clsP75 > 0.1) {
      items.push(`Google CLS ${crux.clsP75.toFixed(3)}，页面视觉稳定性需要改善`);
    }
  }
  if (report.rdap.dnssec === false) {
    items.push("注册资料显示 DNSSEC 未启用；这不代表网站一定不安全，但属于可进一步核对的 DNS 防护项");
  }
  if (report.intelligence.wayback.status !== "available") {
    items.push("网站历史快照本次未取得，不能据此判断这个域名没有历史内容");
  }
  return [...new Set(items)].length
    ? [...new Set(items)]
    : ["本次可用资料未发现明确警报；仍需按实际用途进行商标、内容与交易核查"];
}

function hasActiveWebsiteSignals(report: DomainReport): boolean {
  return report.dns.resolves && (
    report.intelligence.tranco.status === "available" ||
    report.intelligence.crux.status === "available" ||
    (report.intelligence.ahrefs.status === "available" && (report.intelligence.ahrefs.domainRating ?? 0) >= 20)
  );
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

  const tranco = report.intelligence.tranco;
  if (tranco.status === "available" && tranco.rank !== null) {
    items.push(`Tranco 全球排名：#${formatInteger(tranco.rank)}`);
  }
  const ahrefs = report.intelligence.ahrefs;
  if (ahrefs.status === "available" && ahrefs.domainRating !== null) {
    items.push(`Domain Rating by Ahrefs：${formatDecimal(ahrefs.domainRating)} / 100`);
  }
  const crux = report.intelligence.crux;
  if (crux.status === "available") {
    const ratings = [
      crux.lcpP75Ms === null ? null : `LCP ${metricRating(crux.lcpP75Ms, 2500, 4000)}`,
      crux.inpP75Ms === null ? null : `INP ${metricRating(crux.inpP75Ms, 200, 500)}`,
      crux.clsP75 === null ? null : `CLS ${metricRating(crux.clsP75, 0.1, 0.25)}`,
    ].filter((value): value is string => value !== null);
    if (ratings.length) items.push(`Google CrUX：${ratings.join(" · ")}`);
  }
  return items.slice(0, 3).map((item) => `• ${escapeHtml(item)}`).join("\n");
}

function previewSignalLine(report: DomainReport): string {
  const tranco = report.intelligence.tranco;
  if (tranco.status === "available" && tranco.rank !== null) {
    return escapeHtml(`Tranco #${formatInteger(tranco.rank)}`);
  }
  const ahrefs = report.intelligence.ahrefs;
  if (ahrefs.status === "available" && ahrefs.domainRating !== null) {
    return escapeHtml(`Ahrefs DR ${formatDecimal(ahrefs.domainRating)}`);
  }
  if (report.intelligence.crux.status === "available") return "Google CrUX 已收录";
  return "本次未取得公开网站信号";
}

function shareAttentionCount(report: DomainReport): number {
  return decisionAttention(report).filter((item) => !item.startsWith("本次可用资料未发现明确警报")).length;
}

function metricRating(value: number, good: number, poor: number): string {
  return value <= good ? "良好" : value <= poor ? "需要改善" : "较差";
}

function registrationLabel(status: RegistrationStatus): string {
  if (status === "registered") return "已注册";
  if (status === "available") return "未发现注册记录";
  return "暂时无法确认";
}

function evidenceCount(report: DomainReport): string {
  return `${report.evidenceItems.filter((item) => item.available).length}/${report.evidenceItems.length} 项`;
}

function externalEvidenceCount(report: DomainReport): string {
  const sources = [
    report.intelligence.tranco,
    report.intelligence.crux,
    report.intelligence.ahrefs,
    report.intelligence.wayback,
  ];
  return `${sources.filter((item) => item.status === "available").length}/${sources.length} 项`;
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

function externalIntelligenceText(report: DomainReport): string {
  const tranco = report.intelligence.tranco.status === "available" && report.intelligence.tranco.rank !== null
    ? `• Tranco 全球排名：<b>#${formatInteger(report.intelligence.tranco.rank)}</b>${report.intelligence.tranco.rankedAt ? `（${escapeHtml(report.intelligence.tranco.rankedAt)}）` : ""}\n  <a href="https://tranco-list.eu/">来源：Tranco</a>`
    : `• Tranco 全球排名：${externalStatusLabel(report.intelligence.tranco.status, "未进入最近的 Top 1,000,000")}`;

  const crux = report.intelligence.crux;
  const cruxLine = crux.status === "available"
    ? `• Chrome UX Report（Google 真实用户 p75）\n  LCP：${formatCruxValue(crux.lcpP75Ms, "ms", 2500, 4000)}\n  INP：${formatCruxValue(crux.inpP75Ms, "ms", 200, 500)}\n  CLS：${formatCruxValue(crux.clsP75, "", 0.1, 0.25)}${crux.periodStart && crux.periodEnd ? `\n  数据期：${escapeHtml(crux.periodStart)} 至 ${escapeHtml(crux.periodEnd)}` : ""}\n  <a href="https://developer.chrome.com/docs/crux/">来源：Chrome UX Report</a>`
    : `• Chrome UX Report：${externalStatusLabel(crux.status, "未达到 Google 的公开数据门槛")}`;

  const ahrefs = report.intelligence.ahrefs.status === "available" && report.intelligence.ahrefs.domainRating !== null
    ? `• Domain Rating by <a href="https://ahrefs.com/">Ahrefs</a>：<b>${formatDecimal(report.intelligence.ahrefs.domainRating)}</b> / 100`
    : `• Ahrefs Domain Rating (DR)：${externalStatusLabel(report.intelligence.ahrefs.status, "未发现资料")}`;

  const wayback = report.intelligence.wayback;
  const waybackLine = wayback.status === "available"
    ? `• Internet Archive 网站历史\n  最早快照：${linkedDate(wayback.firstCaptureAt, wayback.firstCaptureUrl)}\n  最近快照：${linkedDate(wayback.latestCaptureAt, wayback.latestCaptureUrl)}`
    : `• Internet Archive 网站历史：${externalStatusLabel(wayback.status, "未发现公开快照")}`;

  return [tranco, cruxLine, ahrefs, waybackLine].join("\n");
}

function externalStatusLabel(status: DomainReport["intelligence"]["tranco"]["status"], notFound: string): string {
  if (status === "not_found") return notFound;
  if (status === "not_configured") return "尚未启用免费 API Key";
  return "本次资料源暂不可用";
}

function formatCruxValue(value: number | null, unit: "ms" | "", good: number, poor: number): string {
  if (value === null) return "该指标无资料";
  const display = unit === "ms" ? `${formatInteger(value)} ms` : value.toFixed(3);
  const label = value <= good ? "良好" : value <= poor ? "需要改善" : "较差";
  return `${display}（${label}）`;
}

function linkedDate(date: Date | null, url: string | null): string {
  const label = formatDate(date);
  return url ? `<a href="${escapeHtml(url)}">${label}</a>` : label;
}

function formatInteger(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function formatDecimal(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
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
