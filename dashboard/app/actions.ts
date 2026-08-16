"use server";

import { redirect } from "next/navigation";
import {
  clearDashboardSession,
  createDashboardSession,
  dashboardAuthConfigured,
  verifyPassword,
} from "@/lib/auth";

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
