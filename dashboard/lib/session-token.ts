import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const sessionLifetimeMs = 7 * 86_400_000;
function signature(payload: string, password: string): string {
  return createHmac("sha256", password).update(`juyu-dashboard-session-v2:${payload}`).digest("base64url");
}
export function issueSessionToken(password: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ nonce: randomBytes(24).toString("base64url"), expiresAt: now + sessionLifetimeMs })).toString("base64url");
  return `${payload}.${signature(payload, password)}`;
}
export function verifySessionToken(token: string, password: string, now = Date.now()): boolean {
  try {
    if (token.length > 512) return false;
    const [payload, signed, extra] = token.split(".");
    if (!payload || !signed || extra !== undefined) return false;
    const actual = Buffer.from(signed);
    const expected = Buffer.from(signature(payload, password));
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return false;
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return typeof session.nonce === "string" && session.nonce.length === 32 && Number.isFinite(session.expiresAt)
      && session.expiresAt > now && session.expiresAt <= now + sessionLifetimeMs;
  } catch { return false; }
}
