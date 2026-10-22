import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { issueSessionToken, verifySessionToken } from "@/lib/session-token";
import { reserveLoginAttempt, resetLoginAttempts, saveSession, sessionExists, revokeSession } from "@/lib/auth-store";

const sessionCookie = "juyu_growth_session";

function configuredPassword(): string | null {
  const password = process.env.DASHBOARD_PASSWORD?.trim();
  return password && password.length >= 12 ? password : null;
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function dashboardAuthConfigured(): boolean {
  return configuredPassword() !== null;
}

export function verifyPassword(candidate: string): boolean {
  const password = configuredPassword();
  return password !== null && safeEqual(candidate, password);
}

async function loginBucket(): Promise<string> {
  const incoming = await headers();
  // Vercel overwrites x-forwarded-for. Local development uses one fixed bucket.
  const address = process.env.VERCEL === "1" ? incoming.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown" : "local";
  return createHmac("sha256", configuredPassword() ?? "unconfigured").update(`login:${address}`).digest("hex");
}
export async function checkDashboardLoginLimit(): Promise<"allowed" | "limited" | "unavailable"> {
  return reserveLoginAttempt(await loginBucket());
}

export async function createDashboardSession(): Promise<void> {
  const password = configuredPassword();
  if (!password) throw new Error("Dashboard authentication is not configured");
  const token = issueSessionToken(password);
  if (!await saveSession(token)) throw new Error("Dashboard session could not be saved");
  await resetLoginAttempts(await loginBucket());
  const store = await cookies();
  store.set(sessionCookie, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });
}

export async function clearDashboardSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(sessionCookie)?.value;
  if (token && !await revokeSession(token)) throw new Error("Session revocation unavailable; please retry logout");
  store.delete(sessionCookie);
}

export async function hasDashboardSession(): Promise<boolean> {
  const password = configuredPassword();
  if (!password) return false;
  const store = await cookies();
  const actual = store.get(sessionCookie)?.value;
  return Boolean(actual && verifySessionToken(actual, password) && await sessionExists(actual));
}

export async function requireDashboardSession(): Promise<void> {
  if (!(await hasDashboardSession())) redirect("/login");
}
