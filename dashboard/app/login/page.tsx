import { Activity, ArrowRight, LockKeyhole } from "lucide-react";
import { login } from "@/app/actions";
import { dashboardAuthConfigured, hasDashboardSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await hasDashboardSession()) redirect("/");
  const { error } = await searchParams;
  const configured = dashboardAuthConfigured();

  return (
    <main className="login-shell">
      <section className="login-panel">
        <div className="brand-mark brand-mark-large">J</div>
        <div>
          <p className="eyebrow">JUYU INTERNAL</p>
          <h1>Growth Intelligence</h1>
          <p className="login-copy">域名工具的增长、转化与数据质量控制台。</p>
        </div>

        <form action={login} className="login-form">
          <label htmlFor="password">访问密码</label>
          <div className="password-field">
            <LockKeyhole size={16} aria-hidden="true" />
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="输入 Dashboard 密码"
              required
              minLength={12}
              disabled={!configured}
            />
          </div>
          {error === "invalid" ? <p className="form-error">密码不正确，请重试。</p> : null}
          {(!configured || error === "configuration") ? (
            <p className="form-error">Dashboard 尚未配置访问密码。</p>
          ) : null}
          <button type="submit" disabled={!configured}>
            进入控制台 <ArrowRight size={15} aria-hidden="true" />
          </button>
        </form>

        <div className="login-footnote">
          <Activity size={14} aria-hidden="true" />
          Private analytics · Server-side data access
        </div>
      </section>
      <div className="login-orbit" aria-hidden="true" />
    </main>
  );
}
