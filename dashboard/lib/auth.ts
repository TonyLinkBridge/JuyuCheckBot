import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const sessionCookie = "juyu_growth_session";
const sessionPurpose = "juyu-growth-dashboard-v1";

function configuredPassword(): string | null {
  const password = process.env.DASHBOARD_PASSWORD?.trim();
  return password && password.length >= 12 ? password : null;
}

function sessionValue(password: string): string {
  return createHmac("sha256", password).update(sessionPurpose).digest("base64url");
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

export async function createDashboardSession(): Promise<void> {
  const password = configuredPassword();
  if (!password) throw new Error("Dashboard authentication is not configured");
  const store = await cookies();
  store.set(sessionCookie, sessionValue(password), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });
}

export async function clearDashboardSession(): Promise<void> {
  const store = await cookies();
  store.delete(sessionCookie);
}

export async function hasDashboardSession(): Promise<boolean> {
  const password = configuredPassword();
  if (!password) return false;
  const store = await cookies();
  const actual = store.get(sessionCookie)?.value;
  return Boolean(actual && safeEqual(actual, sessionValue(password)));
}

export async function requireDashboardSession(): Promise<void> {
  if (!(await hasDashboardSession())) redirect("/login");
}
