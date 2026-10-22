"use server";

import { redirect } from "next/navigation";
import {
  clearDashboardSession,
  createDashboardSession,
  dashboardAuthConfigured,
  requireDashboardSession,
  verifyPassword,
  checkDashboardLoginLimit,
} from "@/lib/auth";
import { parsePollFormData, sourcePayload, type PollActionState } from "@/lib/poll";
import { sendTelegramPoll } from "@/lib/telegram-publisher";
import { parseLeadUpdate, type LeadActionState } from "@/lib/lead-follow-up";
import { saveLeadFollowUp } from "@/lib/lead-follow-up-store";
import { revalidatePath } from "next/cache";

export async function updateLeadFollowUp(_previous: LeadActionState, formData: FormData): Promise<LeadActionState> {
  await requireDashboardSession();
  const update = parseLeadUpdate(formData);
  if (!update) return { status: "error", message: "资料不完整或格式有误，备注最多 2000 字。" };
  const outcome = await saveLeadFollowUp(update);
  if (outcome === "conflict") return { status: "error", message: "这条线索已被其他页面更新。请先刷新，核对最新资料后再保存。" };
  if (outcome === "not_found") return { status: "error", message: "线索不存在或不属于当前数据库，未作修改。" };
  if (outcome !== "saved") return { status: "error", message: "无法确认是否保存。请先复制当前备注，再刷新核对最新记录，避免重复操作。" };
  revalidatePath("/leads");
  return { status: "saved", message: "已保存跟进资料。" };
}

export async function login(formData: FormData): Promise<void> {
  if (!dashboardAuthConfigured()) redirect("/login?error=configuration");
  const limit = await checkDashboardLoginLimit();
  if (limit !== "allowed") redirect(`/login?error=${limit}`);
  const password = String(formData.get("password") ?? "");
  if (!verifyPassword(password)) redirect("/login?error=invalid");
  try { await createDashboardSession(); } catch { redirect("/login?error=unavailable"); }
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
