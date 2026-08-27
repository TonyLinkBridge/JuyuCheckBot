import { InlineKeyboard } from "grammy";
import type { CommerceLead, CommercePrompt, CommerceSession, CommerceTransition } from "./types.js";

type PromptTransition = Extract<CommerceTransition, { kind: "prompt" }>;

export function commercePromptText(transition: PromptTransition): string {
  const domain = transition.session.data.domain ? escapeHtml(transition.session.data.domain) : null;
  switch (transition.prompt) {
    case "buy_domain":
      return "🤝 <b>委托购买域名</b>\n\n请发送你希望购买的域名。\n例如：<code>example.com</code>";
    case "buy_budget":
      return `🤝 <b>委托购买 ${domain}</b>\n\n域名已经自动带入。\n\n💰 你的预算范围是？`;
    case "buy_purpose":
      return `🎯 <b>${domain} 主要用于什么？</b>\n\n这能帮助 JUYU 更准确地理解你的收购需求。`;
    case "buy_contact":
      return contactPrompt("委托购买", domain);
    case "sell_domain":
      return "💰 <b>提交出售域名</b>\n\n请发送你准备出售的域名。\n例如：<code>example.com</code>";
    case "sell_price":
      return `💰 <b>出售 ${domain}</b>\n\n域名已经自动带入。\n\n你的期望售价是多少？\n例如：<code>CNY 30,000</code>、<code>USD 5,000</code>；也可以直接选择待报价。`;
    case "sell_negotiable":
      return "是否接受议价？";
    case "sell_listed":
      return "目前是否已经在其他平台挂牌出售？";
    case "sell_contact":
      return contactPrompt("提交出售", domain);
    case "register_domain":
      return "🎯 <b>协助注册域名</b>\n\n请发送你准备注册的域名。\n例如：<code>example.cn</code>";
    case "register_contact":
      return `🎯 <b>协助注册 ${domain}</b>\n\n域名已经自动带入。注册状态可能随时变化，JUYU 会在处理前再次核实。\n\n${contactInstruction()}`;
    case "contact_message":
      return `💬 <b>联系 JUYU</b>\n\n请直接发送你的需求，并在内容中留下方便联系你的方式。\n\n${contactInstruction()}`;
  }
}

export function commercePromptKeyboard(prompt: CommercePrompt): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  switch (prompt) {
    case "buy_budget":
      keyboard
        .text("低于 ¥5,000", "commerce:choice:budget:under_5k")
        .row()
        .text("¥5,000–20,000", "commerce:choice:budget:5k_20k")
        .row()
        .text("¥20,000–100,000", "commerce:choice:budget:20k_100k")
        .row()
        .text("¥100,000–500,000", "commerce:choice:budget:100k_500k")
        .row()
        .text("¥500,000 以上", "commerce:choice:budget:over_500k")
        .row()
        .text("暂时不确定", "commerce:choice:budget:unsure");
      break;
    case "buy_purpose":
      keyboard
        .text("🏢 品牌 / 企业", "commerce:choice:purpose:brand")
        .row()
        .text("🚀 创业项目", "commerce:choice:purpose:startup")
        .row()
        .text("📈 域名投资", "commerce:choice:purpose:investment")
        .row()
        .text("🌐 SEO / 建站", "commerce:choice:purpose:website")
        .row()
        .text("其他", "commerce:choice:purpose:other");
      break;
    case "sell_price":
      keyboard
        .text("待报价 / 面议", "commerce:choice:price:quote")
        .row()
        .text("暂时不确定", "commerce:choice:price:unsure");
      break;
    case "sell_negotiable":
      keyboard
        .text("✅ 接受", "commerce:choice:negotiable:yes")
        .text("❌ 不接受", "commerce:choice:negotiable:no")
        .row()
        .text("看报价再决定", "commerce:choice:negotiable:maybe");
      break;
    case "sell_listed":
      keyboard.text("是", "commerce:choice:listed:yes").text("否", "commerce:choice:listed:no");
      break;
  }
  return keyboard.row().text("取消", "commerce:cancel");
}

export function commerceResumeText(session: CommerceSession): string {
  const domain = session.data.domain ? ` ${escapeHtml(session.data.domain)}` : "";
  const label = session.flow === "buy"
    ? `委托购买${domain}`
    : session.flow === "sell"
      ? `出售${domain}`
      : session.flow === "register"
        ? `协助注册${domain}`
        : "联系 JUYU";
  return `📝 <b>你有一项未完成的操作</b>\n\n${label}\n\n可以继续上次步骤，或取消后重新开始。`;
}

export function commerceResumeKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text("▶️ 继续", "commerce:resume").text("取消", "commerce:cancel");
}

export function commerceCompleteText(leadId: number, lead: CommerceLead): string {
  const title = lead.data.service === "register"
    ? "域名注册协助需求已收到"
    : lead.leadType === "buy"
      ? "委托购买需求已收到"
      : lead.leadType === "sell"
        ? "出售需求已收到"
        : "咨询信息已收到";
  const domain = lead.data.domain ? `\n域名：<code>${escapeHtml(lead.data.domain)}</code>` : "";
  return `✅ <b>${title}</b>\n\nLead 编号：<code>#${leadId}</code>${domain}\n\nJUYU 团队会根据你提交的资料进一步联系。`;
}

export function commerceAdminText(
  leadId: number,
  user: { id: number; username?: string },
  lead: CommerceLead,
): string {
  const type = lead.data.service === "register"
    ? "🎯 协助注册"
    : lead.leadType === "buy"
      ? "🤝 委托购买"
      : lead.leadType === "sell"
        ? "💰 出售域名"
        : "💬 联系 JUYU";
  const labels: Record<string, string> = {
    domain: "域名",
    budget: "预算",
    purpose: "用途",
    price: "期望售价",
    negotiable: "议价",
    listed: "其他平台挂牌",
    contact: "联系方式",
    message: "用户留言",
    source: "来源",
    service: "服务类型",
    report_token: "报告编号",
  };
  const lines = [
    `<b>JUYU 新 Lead #${leadId}</b>`,
    `类型：${type}`,
    `Telegram：${user.username ? `@${escapeHtml(user.username)}` : user.id}`,
    `用户 ID：<code>${user.id}</code>`,
    "",
  ];
  for (const [key, value] of Object.entries(lead.data)) {
    if (value === undefined || value === "") continue;
    lines.push(`${labels[key] ?? escapeHtml(key)}：${escapeHtml(String(value))}`);
  }
  return lines.join("\n");
}

export function commerceInvalidText(reason: "invalid_domain" | "invalid_choice" | "empty_text"): string {
  if (reason === "invalid_domain") return "⚠️ 这个域名格式看起来不正确，请重新发送，例如：<code>example.com</code>";
  if (reason === "empty_text") return "⚠️ 请发送有效内容后再继续。";
  return "⚠️ 这个按钮已经过期，请继续当前步骤或取消后重新开始。";
}

function contactPrompt(action: string, domain: string | null): string {
  return `📩 <b>${action} ${domain}</b>\n\n最后一步：${contactInstruction()}`;
}

function contactInstruction(): string {
  return "请留下方便 JUYU 团队联系你的方式，例如 Telegram、微信、WhatsApp 或 Email。";
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
