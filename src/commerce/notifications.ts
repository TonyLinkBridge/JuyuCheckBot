import type { Api } from "grammy";
import type { Backend, LeadNotificationJob } from "../backend.js";
import type { Config } from "../config.js";
import { commerceAdminText } from "./messages.js";

export async function dispatchLeadNotifications(
  backend: Backend, api: Api, config: Config, leadId?: number,
): Promise<{ claimed: number; sent: number }> {
  const jobs = await backend.claimLeadNotifications(3, leadId);
  const outcomes = await Promise.all(jobs.map(async (job) => {
    let sent = false;
    try {
      if (!config.ADMIN_CHAT_ID) throw new Error("Administrator not configured");
      await api.sendMessage(config.ADMIN_CHAT_ID, commerceAdminText(job.leadId,
        { id: job.telegramUserId, username: job.username }, job.lead),
        { parse_mode: "HTML", link_preview_options: { is_disabled: true } });
      sent = true;
    } catch {
      console.error(`Lead #${job.leadId} notification pending retry`);
    }
    const saved = await backend.finishLeadNotification(job, sent);
    await recordNotification(backend, job, sent && saved);
    return sent && saved;
  }));
  return { claimed: jobs.length, sent: outcomes.filter(Boolean).length };
}

async function recordNotification(backend: Backend, job: LeadNotificationJob, sent: boolean): Promise<void> {
  await backend.track({
    eventName: sent ? "lead_notification_sent" : "lead_notification_failed",
    telegramUserId: job.telegramUserId, source: job.lead.data.source,
    domain: job.lead.data.domain, reportToken: job.lead.data.report_token,
    intent: job.lead.leadType === "sell" ? "owner" : job.lead.leadType === "buy" ? "buyer" : undefined,
    metadata: { leadId: job.leadId, attempts: job.attempts },
  });
}
