# JUYU Growth Intelligence

JUYU 域名体检的内部增长控制台。

后台使用独立页面组织工作：`/inbox` 跟进收件箱、`/users` 用户管理、`/funnel` 转化漏斗、`/sources` 来源分析、`/quality` 数据质量、`/activity` 活动记录、`/settings` 系统状态。`/polls` 提供受保护的 Telegram Poll 发布器，可先发测试频道，再确认发布到正式频道，并自动生成 `src_` 来源链接。

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

前两项连接 `@JuyuCheckBot`，`COMMERCE_` 两项连接独立的 `@JuyuDomainBot` Supabase。`TELEGRAM_BOT_TOKEN` 使用 `@JuyuCheckBot` 的 BotFather Token，只允许存在于 Dashboard 的服务器环境。两个 Chat ID 可以使用公开频道用户名（例如 `@JUYU007`）或 `-100...` 数字 ID。Dashboard 不会把 Token 或数据库密钥传给浏览器；登录后的管理员页面会显示 Telegram 用户 ID，供内部跟进使用。

## Deploy

在 Vercel 从同一个 GitHub 仓库建立第二个 Project，将 Root Directory 设置为 `dashboard`，Framework 使用 Next.js。
