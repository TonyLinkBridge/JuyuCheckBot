"use server";

import { redirect } from "next/navigation";
import {
  clearDashboardSession,
  createDashboardSession,
  dashboardAuthConfigured,
  requireDashboardSession,
  verifyPassword,
} from "@/lib/auth";
import { parsePollFormData, sourcePayload, type PollActionState } from "@/lib/poll";
import { sendTelegramPoll } from "@/lib/telegram-publisher";

export async function login(formData: FormData): Promise<void> {
  if (!dashboardAuthConfigured()) redirect("/login?error=configuration");
  const password = String(formData.get("password") ?? "");
  if (!verifyPassword(password)) redirect("/login?error=invalid");
  await createDashboardSession();
  redirect("/");
}

export async function logout(): Promise<void> {
  await clearDashboardSession();
  redirect("/login");
}

export async function publishPoll(
  _previousState: PollActionState,
  formData: FormData,
): Promise<PollActionState> {
  await requireDashboardSession();
  const parsed = parsePollFormData(formData);
  if (!parsed.success) return { status: "error", message: parsed.message };

  try {
    const result = await sendTelegramPoll(parsed.draft);
    return {
      status: "success",
      message: result.target === "test" ? "测试 Poll 已发送。" : "Poll 已发布到正式频道。",
      messageUrl: result.messageUrl,
      source: sourcePayload(parsed.draft.campaign),
      target: result.target,
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Poll 发布失败，请稍后重试。",
    };
  }
}
