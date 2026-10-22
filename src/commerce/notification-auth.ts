import { createHmac, timingSafeEqual } from "node:crypto";

export function notificationWorkerToken(webhookSecret: string): string {
  return createHmac("sha256", webhookSecret).update("juyu-lead-notifications-v1").digest("hex");
}

export function notificationWorkerAuthorized(header: string | undefined, secret: string | undefined): boolean {
  if (!secret || !header?.startsWith("Bearer ")) return false;
  const actual = Buffer.from(header.slice(7));
  const expected = Buffer.from(notificationWorkerToken(secret));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
