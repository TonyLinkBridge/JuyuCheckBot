import { describe, expect, it } from "vitest";
import {
  advanceCommerceChoice,
  advanceCommerceText,
  resumeCommerceFlow,
  startCommerceFlow,
} from "../src/commerce/flow.js";

describe("unified commerce flow", () => {
  it("keeps a checked domain and report context through a buyer Lead", () => {
    const started = startCommerceFlow("buy", {
      domain: "example.com",
      source: "channel",
      reportToken: "report_123",
    });
    expect(started).toMatchObject({ kind: "prompt", prompt: "buy_budget" });
    if (started.kind !== "prompt") throw new Error("expected prompt");

    const budget = advanceCommerceChoice(started.session, "budget:20k_100k");
    expect(budget).toMatchObject({ kind: "prompt", prompt: "buy_purpose" });
    if (budget.kind !== "prompt") throw new Error("expected prompt");

    const purpose = advanceCommerceChoice(budget.session, "purpose:brand");
    expect(purpose).toMatchObject({ kind: "prompt", prompt: "buy_contact" });
    if (purpose.kind !== "prompt") throw new Error("expected prompt");

    const completed = advanceCommerceText(purpose.session, "微信：juyu-buyer");
    expect(completed).toEqual({
      kind: "complete",
      lead: {
        leadType: "buy",
        data: {
          domain: "example.com",
          source: "channel",
          report_token: "report_123",
          budget: "CNY 20,000–100,000",
          purpose: "品牌 / 企业",
          contact: "微信：juyu-buyer",
        },
      },
    });
  });

  it("turns an available domain into a registration Lead after one contact answer", () => {
    const started = startCommerceFlow("register", {
      domain: "newbrand.cn",
      source: "juyu_check_bot",
      reportToken: "report_register",
    });
    expect(started).toMatchObject({ kind: "prompt", prompt: "register_contact" });
    if (started.kind !== "prompt") throw new Error("expected prompt");

    expect(advanceCommerceText(started.session, "Telegram @newbrand")).toEqual({
      kind: "complete",
      lead: {
        leadType: "buy",
        data: {
          domain: "newbrand.cn",
          source: "juyu_check_bot",
          report_token: "report_register",
          service: "register",
          purpose: "域名注册",
          budget: "注册服务",
          contact: "Telegram @newbrand",
        },
      },
    });
  });

  it("supports a seller who wants JUYU to quote instead of typing a price", () => {
    const started = startCommerceFlow("sell", {
      domain: "5so.cc",
      source: "direct",
      reportToken: "report_sell",
    });
    expect(started).toMatchObject({ kind: "prompt", prompt: "sell_price" });
    if (started.kind !== "prompt") throw new Error("expected prompt");

    const priced = advanceCommerceChoice(started.session, "price:quote");
    expect(priced).toMatchObject({ kind: "prompt", prompt: "sell_negotiable" });
    if (priced.kind !== "prompt") throw new Error("expected prompt");

    const negotiable = advanceCommerceChoice(priced.session, "negotiable:maybe");
    expect(negotiable).toMatchObject({ kind: "prompt", prompt: "sell_listed" });
    if (negotiable.kind !== "prompt") throw new Error("expected prompt");

    const listed = advanceCommerceChoice(negotiable.session, "listed:no");
    expect(listed).toMatchObject({ kind: "prompt", prompt: "sell_contact" });
    if (listed.kind !== "prompt") throw new Error("expected prompt");

    expect(advanceCommerceText(listed.session, "WhatsApp +60 12-345 6789")).toMatchObject({
      kind: "complete",
      lead: {
        leadType: "sell",
        data: {
          domain: "5so.cc",
          price: "待报价 / 面议",
          negotiable: "看报价再决定",
          listed: "否",
          contact: "WhatsApp +60 12-345 6789",
        },
      },
    });
  });

  it("asks for a domain when a direct buy command has no domain", () => {
    const started = startCommerceFlow("buy", { source: "direct" });
    expect(started).toMatchObject({ kind: "prompt", prompt: "buy_domain" });
    if (started.kind !== "prompt") throw new Error("expected prompt");

    const invalid = advanceCommerceText(started.session, "not a domain");
    expect(invalid).toMatchObject({ kind: "invalid", reason: "invalid_domain" });

    const accepted = advanceCommerceText(started.session, "https://brand-example.com/path");
    expect(accepted).toMatchObject({
      kind: "prompt",
      prompt: "buy_budget",
      session: { data: { domain: "brand-example.com", source: "direct" } },
    });
  });

  it("creates a contact Lead and limits stored free text", () => {
    const started = startCommerceFlow("contact", { source: "channel" });
    if (started.kind !== "prompt") throw new Error("expected prompt");
    const completed = advanceCommerceText(started.session, "需".repeat(1700));
    expect(completed).toMatchObject({ kind: "complete", lead: { leadType: "contact" } });
    if (completed.kind !== "complete") throw new Error("expected complete");
    expect(completed.lead.data.message).toHaveLength(1500);
    expect(completed.lead.data.source).toBe("channel");
  });

  it("rejects a callback that does not match the current step", () => {
    const started = startCommerceFlow("buy", { domain: "example.com", source: "direct" });
    if (started.kind !== "prompt") throw new Error("expected prompt");
    expect(advanceCommerceChoice(started.session, "listed:yes")).toMatchObject({
      kind: "invalid",
      reason: "invalid_choice",
      session: started.session,
    });
  });

  it("restores the exact prompt for an unfinished flow", () => {
    const started = startCommerceFlow("sell", { domain: "asset.cn", source: "direct" });
    if (started.kind !== "prompt") throw new Error("expected prompt");
    const priced = advanceCommerceChoice(started.session, "price:quote");
    if (priced.kind !== "prompt") throw new Error("expected prompt");

    expect(resumeCommerceFlow(priced.session)).toEqual({
      kind: "prompt",
      prompt: "sell_negotiable",
      session: priced.session,
    });
  });
});
