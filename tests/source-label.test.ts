import { describe, expect, it } from "vitest";
import { sourceLabel as dashboardSourceLabel, sourceShortLabel as dashboardSourceShortLabel } from "../dashboard/lib/source-label.js";
import { sourceLabel, sourceShortLabel } from "../src/source-label.js";

describe("source labels", () => {
  it.each([
    ["direct", "直接打开 Telegram Bot"],
    ["channel", "JUYU Telegram 频道"],
    ["juyucom", "JUYU 官网"],
    ["share", "报告分享入口"],
    ["referral", "朋友分享链接"],
    ["juyu_check_bot", "JUYU 域名体检 Bot"],
    ["morningbrief_20260817", "Telegram 频道活动：morningbrief_20260817"],
    ["kol-tony", "活动来源：kol-tony"],
  ])("turns %s into %s", (source, expected) => {
    expect(sourceLabel(source)).toBe(expected);
  });

  it("uses compact labels for charts", () => {
    expect(sourceShortLabel("direct")).toBe("直接打开");
    expect(sourceShortLabel("morningbrief_20260817")).toBe("频道活动");
    expect(sourceShortLabel("kol-tony")).toBe("kol-tony");
  });

  it("keeps dashboard labels aligned with the Bot backend", () => {
    for (const source of ["direct", "channel", "referral", "morningbrief_20260817", "kol-tony"]) {
      expect(dashboardSourceLabel(source)).toBe(sourceLabel(source));
      expect(dashboardSourceShortLabel(source)).toBe(sourceShortLabel(source));
    }
  });
});
