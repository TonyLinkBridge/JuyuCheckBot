import { InlineKeyboard } from "grammy";
import type { StoredReport } from "./backend.js";
import type { Config } from "./config.js";
import { encodeDomainParam } from "./domain/normalize.js";
import type { DomainIntent, DomainReport, RegistrationStatus } from "./domain/types.js";

export const welcomeText = `🌐 <b>JUYU 域名体检</b>

用数据与品牌视角，
快速看懂一个域名。

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

免费 Preview 会显示注册状态、DNS、资料来源、数据完整度和基础警报。选择你的目的后，订阅 JUYU 情报局即可解锁完整可验证资料、名称结构事实与行动建议。

常用命令：
/recent 最近体检
/privacy 隐私与数据删除

<i>结果仅供初步筛查，不替代商标、法律、安全、估值或交易尽调。</i>`;

export function checkingText(domain: string): string {
  return `🔍 正在分析 <b>${escapeHtml(domain)}</b>…`;
}

export function previewReportText(report: DomainReport): string {
  return `✅ <b>JUYU DOMAIN CHECK</b>

🌐 <b>${escapeHtml(report.domain)}</b>

注册资料　${registrationStatusLine(report.rdap.status)}
DNS　　　${dnsStatusLine(report)}
资料取得　<b>${evidenceCount(report)}</b>
基础警报　${report.alerts.length ? `⚠️ ${report.alerts.length} 项` : "✅ 本次未发现"}
资料来源　${registrationSource(report)}

━━━━━━━━━━━━━━
<b>检查结论</b>
${escapeHtml(report.summary)}

<i>这里只显示可验证资料与明确规则，不提供自创域名评分或估值。</i>`;
}

export const intentPromptText = `为了给你更准确的行动建议：
<b>你和这个域名是什么关系？</b>`;

export function intentKeyboard(token: string): InlineKeyboard {
  return new InlineKeyboard()
    .text("💼 我拥有这个域名", `intent:owner:${token}`)
    .row()
    .text("🎯 我想购买这个域名", `intent:buyer:${token}`)
    .row()
    .text("🔍 只是研究看看", `intent:research:${token}`);
}

export function gateText(config: Config): string {
  return `🔒 <b>解锁完整 JUYU 域名体检</b>

完整报告包含：
✓ 注册状态、注册商、域龄与到期日
✓ RDAP / 对应注册局资料来源
✓ DNS、Nameserver、MX 与 DNSSEC
✓ 名称结构事实与基础警报
✓ 根据你的目的生成行动建议

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
  const registrar = report.rdap.registrar ? escapeHtml(report.rdap.registrar) : "未公开 / 未获取";
  const age = report.ageYears === null ? "未知" : `${formatYears(report.ageYears)} 年`;
  const dnssec = report.rdap.dnssec === null ? "未知" : report.rdap.dnssec ? "已启用" : "未启用";
  const nsCount = new Set([...report.rdap.nameServers, ...report.dns.nameServers]).size;
  const evidenceLines = report.evidenceItems
    .map((item) => `${item.available ? "✓" : "○"} ${escapeHtml(item.label)}`)
    .join("　");
  const structureLines = report.observations.map((item) => `• ${escapeHtml(item)}`).join("\n");
  const alerts = report.alerts.length
    ? report.alerts.map((item, index) => `${padIndex(index)} ${escapeHtml(item)}`).join("\n")
    : "本次基础检查未发现明显警报";

  return `🔓 <b>完整 JUYU 域名体检</b>

🌐 <b>${escapeHtml(report.domain)}</b>
资料取得：<b>${evidenceCount(report)}</b>
资料来源：${registrationSource(report)}

━━━━━━━━━━━━━━
📋 <b>DATA｜可验证数据</b>
• 注册状态：${registrationLabel(report.rdap.status)}
• 注册商：${registrar}
• 注册日期：${formatDate(report.rdap.createdAt)}
• 域名年龄：${age}
• 到期日期：${formatDate(report.rdap.expiresAt)}
• DNS 解析：${report.dns.checked === false ? "数据暂不可用" : report.dns.resolves ? "正常" : "未发现有效解析"}
• Nameserver：${nsCount || "未发现"}
• MX：${report.dns.mx.length ? `${report.dns.mx.length} 条` : "未发现"}
• DNSSEC：${dnssec}

<b>已取得项目</b>
${evidenceLines}

━━━━━━━━━━━━━━
🔎 <b>STRUCTURE｜名称结构事实</b>
${structureLines}

<b>基础警报</b>
${alerts}

<b>检查结论</b>
${escapeHtml(report.summary)}

━━━━━━━━━━━━━━
🎯 <b>ACTION｜建议行动</b>
${escapeHtml(actionAdvice(report, intent))}

<i>${escapeHtml(report.reportVersion)} · 数据取得 ${evidenceCount(report)}
体检时间：${formatDateTime(report.checkedAt)}
本报告不提供自创评分，也不构成估值、商标、法律、安全或交易意见。注册可用性以对应注册服务的实时结果为准。</i>`;
}

export function fullReportKeyboard(
  config: Config,
  report: DomainReport,
  intent: DomainIntent,
  token: string,
): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  keyboard.text("📤 生成分享卡", `share:${intent}:${token}`);

  if (intent === "owner") {
    keyboard
      .row()
      .text("💰 提交 JUYU 出售 / 深度评估", `lead:owner:${token}`);
  } else if (intent === "buyer") {
    keyboard
      .row()
      .text(
        report.rdap.status === "available" ? "🎯 委托 JUYU 协助注册" : "🤝 委托 JUYU 协助收购",
        `lead:buyer:${token}`,
      );
  } else {
    keyboard.row().url("🌐 查看 JUYU 官方服务", "https://www.juyu.com/");
  }
  keyboard.row().text("🔎 继续体检", "check_another");
  return keyboard;
}

export function shareCardText(report: DomainReport): string {
  return `📤 <b>JUYU DOMAIN CHECK</b>

🌐 <b>${escapeHtml(report.domain)}</b>

注册资料　${registrationStatusLine(report.rdap.status)}
DNS　　　${dnsStatusLine(report)}
资料取得　<b>${evidenceCount(report)}</b>
基础警报　${report.alerts.length ? `⚠️ ${report.alerts.length} 项` : "✅ 本次未发现"}
来源　　　${registrationSource(report)}

<b>${escapeHtml(report.summary)}</b>

👇 <b>你也可以免费查一个域名</b>

<i>免费域名体检 · Powered by JUYU 聚域</i>`;
}

export function shareCardKeyboard(config: Config, report: DomainReport, token: string): InlineKeyboard {
  const reportLink = referralLink(config.BOT_USERNAME, token);
  const shareText = `我刚用 JUYU 查了 ${report.domain} 的注册资料、DNS 与基础警报。\n\n资料来源和缺失项目都会明确显示，你也可以免费查一个域名 👇`;
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
注册资料　${registrationStatusLine(report.rdap.status)}
DNS　　　${dnsStatusLine(report)}
资料取得　<b>${evidenceCount(report)}</b>
基础警报　${report.alerts.length ? `⚠️ ${report.alerts.length} 项` : "✅ 本次未发现"}

<b>${escapeHtml(report.summary)}</b>

━━━━━━━━━━━━━━
🔍 <b>现在体检你的域名</b>

直接发送一个域名，例如：
<code>yourdomain.com</code>

先免费查看注册资料、DNS、资料来源与基础警报。`;
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

function actionAdvice(report: DomainReport, intent: DomainIntent): string {
  if (report.rdap.status === "unknown") {
    return "VERIFY：当前资料源无法确认注册状态，请先到对应注册服务复核，再决定购买、出售或开发。";
  }
  if (intent === "owner") {
    return "REVIEW：核对注册资料与实际使用情况，再决定继续持有、开发或提交出售评估。";
  }
  if (intent === "buyer") {
    if (report.rdap.status === "available") return "REGISTER：先核实注册可用性与商标风险，再完成注册。";
    return "DUE DILIGENCE：先做历史、商标与可比成交尽调，再根据卖方报价决定是否委托收购。";
  }
  return "COMPARE：将它与 2–3 个候选域名一起比较，再结合品牌语义与预算判断。";
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
