# JUYU Growth Intelligence

JUYU 域名体检的内部增长控制台。

包含新用户激活、订阅解锁、推荐增长、商业 Leads、来源质量和体检数据健康监控。Referral Funnel 会追踪分享生成、推荐打开、推荐新用户、域名提交与报告解锁，并显示 K-factor 和表现最佳的分享域名。Lead Conversion 会区分购买、出售与注册意向，追踪进入 `@JuyuDomainBot` 的用户，并按来源显示转化率。

## Environment

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
DASHBOARD_PASSWORD
```

`SUPABASE_SERVICE_ROLE_KEY` 只允许存在于服务器环境。Dashboard 不会把 Telegram 用户 ID 或 Service Role 传给浏览器。

## Deploy

在 Vercel 从同一个 GitHub 仓库建立第二个 Project，将 Root Directory 设置为 `dashboard`，Framework 使用 Next.js。
