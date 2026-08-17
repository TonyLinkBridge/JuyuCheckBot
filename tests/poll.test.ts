import { describe, expect, it } from "vitest";
import { botDeepLink, normalizeCampaign, parsePollFormData, sourcePayload } from "../dashboard/lib/poll.js";

function validForm(target: "test" | "production" = "test"): FormData {
  const form = new FormData();
  form.set("target", target);
  form.set("question", "你买过期域名前，会检查历史吗？");
  form.append("option", "每次都会");
  form.append("option", "很少检查");
  form.set("campaign", "Morning Brief 20260817");
  form.set("buttonText", "🔍 免费检查我的域名");
  if (target === "production") form.set("confirmProduction", "yes");
  return form;
}

describe("Poll campaign attribution", () => {
  it("normalizes campaign identifiers to the Bot source format", () => {
    expect(normalizeCampaign(" Morning Brief / 2026-08-17 ")).toBe("morning_brief_2026-08-17");
    expect(sourcePayload("Morning Brief 20260817")).toBe("src_morning_brief_20260817");
    expect(botDeepLink("@JuyuCheckBot", "Morning Brief 20260817")).toBe(
      "https://t.me/JuyuCheckBot?start=src_morning_brief_20260817",
    );
  });

  it("accepts a valid test poll", () => {
    const result = parsePollFormData(validForm());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.draft.target).toBe("test");
      expect(result.draft.options).toHaveLength(2);
      expect(result.draft.campaign).toBe("morning_brief_20260817");
    }
  });

  it("requires an explicit confirmation for production", () => {
    const form = validForm("production");
    form.delete("confirmProduction");
    expect(parsePollFormData(form)).toEqual({
      success: false,
      message: "发布到正式频道前，请勾选确认。",
    });
  });

  it("rejects duplicate or incomplete options", () => {
    const form = validForm();
    form.delete("option");
    form.append("option", "一样");
    form.append("option", "一样");
    expect(parsePollFormData(form)).toEqual({ success: false, message: "Poll 选项不能重复。" });
  });
});
