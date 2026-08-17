# JUYU Growth Intelligence

JUYU 域名体检的内部增长控制台。

包含新用户激活、订阅解锁、推荐增长、商业 Leads、来源质量和体检数据健康监控。质量区显示注册状态确认率与私有注册局回退率，不再显示 JUYU 自创结构分。Referral Funnel 会追踪分享生成、推荐打开、推荐新用户、域名提交与报告解锁，并显示 K-factor 和表现最佳的分享域名。Lead Conversion 会区分购买、出售与注册意向，追踪进入 `@JuyuDomainBot` 的用户，并按来源显示转化率。`/polls` 提供受保护的 Telegram Poll 发布器，可先发测试频道，再确认发布到正式频道，并自动生成 `src_` 来源链接。

## Environment

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
COMMERCE_SUPABASE_URL
COMMERCE_SUPABASE_SECRET_KEY
DASHBOARD_PASSWORD
TELEGRAM_BOT_TOKEN
POLL_TEST_CHAT_ID
POLL_PRODUCTION_CHAT_ID
```

前两项连接 `@JuyuCheckBot`，`COMMERCE_` 两项连接独立的 `@JuyuDomainBot` Supabase。`TELEGRAM_BOT_TOKEN` 使用 `@JuyuCheckBot` 的 BotFather Token，只允许存在于 Dashboard 的服务器环境。两个 Chat ID 可以使用公开频道用户名（例如 `@JUYU007`）或 `-100...` 数字 ID。Dashboard 不会把 Token、数据库密钥、Telegram 用户 ID、用户名或联系方式传给浏览器。

## Deploy

在 Vercel 从同一个 GitHub 仓库建立第二个 Project，将 Root Directory 设置为 `dashboard`，Framework 使用 Next.js。
