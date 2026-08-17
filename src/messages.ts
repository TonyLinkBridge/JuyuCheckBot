import { InlineKeyboard } from "grammy";
import type { StoredReport } from "./backend.js";
import type { Config } from "./config.js";
import { encodeDomainParam } from "./domain/normalize.js";
import type { DomainIntent, DomainReport, RegistrationStatus } from "./domain/types.js";

export const welcomeText = `🌐 <b>JUYU 域名体检</b>

买下、续费或使用域名前，
先查清注册资料、DNS 与基础警报。

每项结果说明来源，不做自创评分。

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

免费 Preview 会显示注册状态、DNS、资料来源、资料完整度和基础警报。选择你的目的后，订阅 JUYU 情报局即可解锁完整可验证资料、具体 DNS 记录、查询时间、名称结构事实与行动建议。

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
取得时间　${formatDateTime(report.rdap.source.checkedAt)}

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
    .text("🔍 只是研究看看", `intent:research:${token}`)
    .row()
    .text("🔄 忽略缓存｜重新检查", `refresh:${token}`);
}

export function gateText(config: Config): string {
  return `🔒 <b>解锁完整 JUYU 域名体检</b>

完整报告包含：
✓ 注册状态、注册商、域龄与到期日
✓ RDAP / 对应注册局资料来源
✓ DNS、Nameserver、MX 与 DNSSEC
✓ Tranco 全球排名与 Wayback 网站历史
✓ Chrome UX Report 与 Ahrefs DR（有资料时）
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

<b>商标与成交边界</b>
• WIPO 商标：需到官方数据库人工查询（不自动抓取）
• 成交/价格：本次没有已核验案例时，不显示价格区间

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
  keyboard.row().url("®️ WIPO 官方商标查询", "https://branddb.wipo.int/");
  keyboard.row().text("🔄 重新实时检查", `refresh:${token}`);
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
