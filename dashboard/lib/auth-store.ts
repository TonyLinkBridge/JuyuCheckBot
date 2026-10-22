import "server-only";
import { createHash } from "node:crypto";

function tokenHash(token: string): string { return createHash("sha256").update(token).digest("hex"); }
async function request(path: string, method = "GET", body?: object): Promise<Response | null> {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  try {
    return await fetch(`${url}/rest/v1/${path}`, { method,
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}), cache: "no-store", signal: AbortSignal.timeout(5000) });
  } catch { return null; }
}
export async function reserveLoginAttempt(bucket: string): Promise<"allowed" | "limited" | "unavailable"> {
  const response = await request("rpc/reserve_dashboard_login", "POST", { p_bucket_key: bucket });
  if (!response?.ok) return "unavailable";
  try {
    const rows = await response.json();
    return rows?.[0]?.allowed === true ? "allowed" : rows?.[0]?.allowed === false ? "limited" : "unavailable";
  } catch { return "unavailable"; }
}
export async function resetLoginAttempts(bucket: string): Promise<void> {
  await request(`dashboard_login_limits?bucket_key=eq.${encodeURIComponent(bucket)}`, "DELETE");
}
export async function saveSession(token: string): Promise<boolean> {
  return Boolean((await request("dashboard_auth_sessions", "POST", {
    token_hash: tokenHash(token), expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
  }))?.ok);
}
export async function sessionExists(token: string): Promise<boolean> {
  const response = await request(`dashboard_auth_sessions?token_hash=eq.${tokenHash(token)}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=token_hash&limit=1`);
  if (!response?.ok) return false;
  try { const rows = await response.json(); return Array.isArray(rows) && rows.length === 1; } catch { return false; }
}
export async function revokeSession(token: string): Promise<boolean> {
  return Boolean((await request(`dashboard_auth_sessions?token_hash=eq.${tokenHash(token)}`, "DELETE"))?.ok);
}
