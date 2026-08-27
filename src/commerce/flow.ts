import { normalizeDomain } from "../domain/normalize.js";
import type {
  CommerceAction,
  CommerceChoice,
  CommerceData,
  CommerceSession,
  CommerceStartContext,
  CommerceTransition,
} from "./types.js";

const budgets = {
  under_5k: "低于 CNY 5,000",
  "5k_20k": "CNY 5,000–20,000",
  "20k_100k": "CNY 20,000–100,000",
  "100k_500k": "CNY 100,000–500,000",
  over_500k: "CNY 500,000 以上",
  unsure: "暂时不确定",
} as const;

const purposes = {
  brand: "品牌 / 企业",
  startup: "创业项目",
  investment: "域名投资",
  website: "SEO / 建站",
  other: "其他",
} as const;

const negotiable = { yes: "接受", no: "不接受", maybe: "看报价再决定" } as const;
const listed = { yes: "是", no: "否" } as const;

export function startCommerceFlow(action: CommerceAction, context: CommerceStartContext): CommerceTransition {
  const data: CommerceData = {
    source: context.source,
    ...(context.reportToken ? { report_token: context.reportToken } : {}),
  };
  if (context.domain) data.domain = normalizeDomain(context.domain).ascii;

  if (action === "contact") return prompt("contact_message", action, "message", data);
  if (!data.domain) {
    const promptKey = action === "buy" ? "buy_domain" : action === "sell" ? "sell_domain" : "register_domain";
    return prompt(promptKey, action, "domain", data);
  }
  return nextAfterDomain(action, data);
}

export function advanceCommerceText(session: CommerceSession, rawText: string): CommerceTransition {
  const text = rawText.trim();
  if (!text) return invalid("empty_text", session);

  if (session.step === "domain") {
    try {
      return nextAfterDomain(session.flow, { ...session.data, domain: normalizeDomain(text).ascii });
    } catch {
      return invalid("invalid_domain", session);
    }
  }

  if (session.flow === "sell" && session.step === "price") {
    return prompt("sell_negotiable", "sell", "negotiable", { ...session.data, price: text.slice(0, 100) });
  }

  if (session.step === "contact") {
    const data = { ...session.data, contact: text.slice(0, 500) };
    return { kind: "complete", lead: { leadType: session.flow === "sell" ? "sell" : "buy", data } };
  }

  if (session.flow === "contact" && session.step === "message") {
    return {
      kind: "complete",
      lead: { leadType: "contact", data: { ...session.data, message: text.slice(0, 1500) } },
    };
  }

  return invalid("invalid_choice", session);
}

export function advanceCommerceChoice(session: CommerceSession, choice: CommerceChoice | string): CommerceTransition {
  if (session.flow === "buy" && session.step === "budget" && choice.startsWith("budget:")) {
    const key = choice.slice("budget:".length) as keyof typeof budgets;
    const value = budgets[key];
    if (value) return prompt("buy_purpose", "buy", "purpose", { ...session.data, budget: value });
  }

  if (session.flow === "buy" && session.step === "purpose" && choice.startsWith("purpose:")) {
    const key = choice.slice("purpose:".length) as keyof typeof purposes;
    const value = purposes[key];
    if (value) return prompt("buy_contact", "buy", "contact", { ...session.data, purpose: value });
  }

  if (session.flow === "sell" && session.step === "price" && choice.startsWith("price:")) {
    const value = choice === "price:quote" ? "待报价 / 面议" : choice === "price:unsure" ? "暂时不确定" : null;
    if (value) return prompt("sell_negotiable", "sell", "negotiable", { ...session.data, price: value });
  }

  if (session.flow === "sell" && session.step === "negotiable" && choice.startsWith("negotiable:")) {
    const key = choice.slice("negotiable:".length) as keyof typeof negotiable;
    const value = negotiable[key];
    if (value) return prompt("sell_listed", "sell", "listed", { ...session.data, negotiable: value });
  }

  if (session.flow === "sell" && session.step === "listed" && choice.startsWith("listed:")) {
    const key = choice.slice("listed:".length) as keyof typeof listed;
    const value = listed[key];
    if (value) return prompt("sell_contact", "sell", "contact", { ...session.data, listed: value });
  }

  return invalid("invalid_choice", session);
}

export function resumeCommerceFlow(session: CommerceSession): CommerceTransition {
  const promptKey = resumePrompt(session);
  return promptKey ? { kind: "prompt", prompt: promptKey, session } : invalid("invalid_choice", session);
}

function nextAfterDomain(action: CommerceAction, data: CommerceData): CommerceTransition {
  if (action === "buy") return prompt("buy_budget", action, "budget", data);
  if (action === "sell") return prompt("sell_price", action, "price", data);
  if (action === "register") {
    return prompt("register_contact", action, "contact", {
      ...data,
      service: "register",
      purpose: "域名注册",
      budget: "注册服务",
    });
  }
  return prompt("contact_message", action, "message", data);
}

function prompt(
  promptKey: Extract<CommerceTransition, { kind: "prompt" }>["prompt"],
  flow: CommerceAction,
  step: CommerceSession["step"],
  data: CommerceData,
): CommerceTransition {
  return { kind: "prompt", prompt: promptKey, session: { flow, step, data } };
}

function invalid(reason: Extract<CommerceTransition, { kind: "invalid" }>["reason"], session: CommerceSession): CommerceTransition {
  return { kind: "invalid", reason, session };
}

function resumePrompt(session: CommerceSession): Extract<CommerceTransition, { kind: "prompt" }>["prompt"] | null {
  if (session.step === "domain") {
    return session.flow === "buy" ? "buy_domain" : session.flow === "sell" ? "sell_domain" : "register_domain";
  }
  if (session.flow === "buy") {
    if (session.step === "budget") return "buy_budget";
    if (session.step === "purpose") return "buy_purpose";
    if (session.step === "contact") return "buy_contact";
  }
  if (session.flow === "sell") {
    if (session.step === "price") return "sell_price";
    if (session.step === "negotiable") return "sell_negotiable";
    if (session.step === "listed") return "sell_listed";
    if (session.step === "contact") return "sell_contact";
  }
  if (session.flow === "register" && session.step === "contact") return "register_contact";
  if (session.flow === "contact" && session.step === "message") return "contact_message";
  return null;
}
