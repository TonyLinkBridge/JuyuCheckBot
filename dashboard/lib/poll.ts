export type PollTarget = "test" | "production";

export type PollDraft = {
  target: PollTarget;
  question: string;
  options: string[];
  campaign: string;
  buttonText: string;
};

export type PollActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  messageUrl?: string;
  source?: string;
  target?: PollTarget;
};

export type PollValidationResult =
  | { success: true; draft: PollDraft }
  | { success: false; message: string };

const campaignPattern = /^[a-z0-9][a-z0-9_-]*$/;

export function parsePollFormData(formData: FormData): PollValidationResult {
  const target = String(formData.get("target") ?? "");
  const question = String(formData.get("question") ?? "").trim();
  const campaign = normalizeCampaign(String(formData.get("campaign") ?? ""));
  const buttonText = String(formData.get("buttonText") ?? "").trim();
  const options = formData
    .getAll("option")
    .map((value) => String(value).trim())
    .filter(Boolean);

  if (target !== "test" && target !== "production") {
    return { success: false, message: "请选择测试频道或正式频道。" };
  }
  if (!question || question.length > 300) {
    return { success: false, message: "Poll 问题需要填写，并且不能超过 300 个字符。" };
  }
  if (options.length < 2 || options.length > 12) {
    return { success: false, message: "Poll 需要 2–12 个有效选项。" };
  }
  if (options.some((option) => option.length > 100)) {
    return { success: false, message: "每个选项不能超过 100 个字符。" };
  }
  if (new Set(options.map((option) => option.toLocaleLowerCase())).size !== options.length) {
    return { success: false, message: "Poll 选项不能重复。" };
  }
  if (!campaign || campaign.length > 32 || !campaignPattern.test(campaign)) {
    return { success: false, message: "来源代号只能使用小写字母、数字、_ 或 -，最多 32 个字符。" };
  }
  if (!buttonText || buttonText.length > 64) {
    return { success: false, message: "按钮文字需要填写，并且不能超过 64 个字符。" };
  }
  if (target === "production" && formData.get("confirmProduction") !== "yes") {
    return { success: false, message: "发布到正式频道前，请勾选确认。" };
  }

  return {
    success: true,
    draft: { target, question, options, campaign, buttonText },
  };
}

export function normalizeCampaign(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_-]/g, "")
    .replace(/_+/g, "_")
    .replace(/^[^a-z0-9]+/, "")
    .slice(0, 32);
}

export function sourcePayload(campaign: string): string {
  return `src_${normalizeCampaign(campaign)}`;
}

export function botDeepLink(botUsername: string, campaign: string): string {
  const username = botUsername.replace(/^@/, "");
  return `https://t.me/${username}?start=${encodeURIComponent(sourcePayload(campaign))}`;
}
