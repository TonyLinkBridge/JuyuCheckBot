# JUYU Growth Intelligence

JUYU 域名体检的内部增长控制台。

## Environment

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
DASHBOARD_PASSWORD
```

`SUPABASE_SERVICE_ROLE_KEY` 只允许存在于服务器环境。Dashboard 不会把 Telegram 用户 ID 或 Service Role 传给浏览器。

## Deploy

在 Vercel 从同一个 GitHub 仓库建立第二个 Project，将 Root Directory 设置为 `dashboard`，Framework 使用 Next.js。
