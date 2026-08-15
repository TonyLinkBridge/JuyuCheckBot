# 🔍 JUYU 域名体检

`JUYU Domain Check` 是一个独立的 Telegram Growth Bot。它不是客服菜单：用户发送域名后立即获得 Score Preview，选择使用意图，订阅 **JUYU 聚域｜域名情报局** 后解锁完整报告，再通过分享和按意图变化的商业深链形成增长闭环。

正式 Bot 用户名：`@JuyuCheckBot`。

## 用户流程

```text
新用户 → 发送域名 → Score Preview → 选择意图 → 订阅频道 → 完整报告
                    总分 / 等级       拥有 / 购买 / 研究       ├→ 分享 → 新用户
                                                          └→ 动态 CTA → Lead
```

当前 MVP 已实现：

- 极简 `/start` 首屏和域名输入识别（支持 URL、子域名、中文 IDN）
- 免费 RDAP 注册信息与原生 DNS 检查，不使用演示数据
- 版本化 `JUYU-1.0` 六维评分、等级、置信度、数据覆盖和基础风险提醒
- Preview → 意图 → Growth Gate → `DATA / JUYU ANALYSIS / ACTION` 报告
- `getChatMember` 频道订阅验证和完整报告 Growth Gate
- 可传播的 Telegram 深链，以及带域名参数的 Commerce Bot 买/卖/注册导流
- Long Polling 本地运行、Webhook 生产运行、健康检查和 Docker 部署
- 未连接 Supabase 时，临时报告只在进程内保留 30 分钟
- 可选 Supabase REST 后端、Growth Event、报告表和来源归因已预留

## 本地启动

要求 Node.js 20 或更高版本。

```bash
npm install
cp .env.example .env
# 编辑 .env，至少填写 BOT_TOKEN
npm run dev
```

没有填写 `WEBHOOK_URL` 时使用 long polling。填写后会自动注册 webhook，健康检查地址为 `/health`。

## Telegram 上线设置

1. 已创建正式 Bot：`@JuyuCheckBot`。在 `@BotFather` 获取 Token，并只写入本地或部署平台的 `BOT_TOKEN` 环境变量。
2. 将 `@JuyuCheckBot` 加为 `@JUYU007` 的频道管理员。Telegram 要求 Bot 具备相应访问权限，才能可靠调用 `getChatMember` 验证其他用户的订阅状态。
3. 用 `/setdescription` 设置：

   > 输入一个域名，快速查看注册信息、结构、历史、DNS 与基础风险。免费域名体检，由 JUYU 聚域提供。

4. 用 `/setabouttext` 设置：

   > 🔍 免费域名体检｜JUYU Domain Check

5. 用 `/setuserpic` 上传独立的放大镜 / 雷达风格头像，避免与 Commerce Bot 混淆。
6. 将 `.env.example` 中的频道、Bot 用户名与公网 Webhook 地址改成真实值。

命令菜单会在进程启动时自动设置：`/start`、`/check`、`/help`。

## Commerce Bot 深链约定

本 Bot 会跳转到 `@JuyuDomainBot` 并传入以下 `/start` 参数：

- `buy_abc-com`：委托购买 `abc.com`
- `sell_abc-com`：出售 `abc.com`
- `register_abc-com`：委托注册未发现注册记录的域名
- `check_abc-com`：进一步人工核查

连字符会编码为双连字符，例如 `my-domain.com` → `my--domain-com`。Commerce Bot 应复用 `encodeDomainParam` / `decodeDomainParam` 的规则，避免域名解析歧义。

## Domain Score 边界

`JUYU-1.0` 包含品牌力、记忆度、商业潜力、后缀匹配、全球化能力与市场信号。当前仍是透明的初筛启发式规则，数据来自 RDAP、DNS 与域名结构；商业潜力和市场信号尚未包含成交数据库。它不是域名估值，也不代表商标可用性、历史内容安全、SEO 信誉或交易合法性。任何权重变更都应发布新的 Score Version。

## 可选 Supabase 后端

Bot 默认使用内存模式，不需要 Supabase。准备连接时：

1. 在 Supabase SQL Editor 执行 `supabase/schema.sql`。
2. 在服务器环境变量填写 `SUPABASE_URL` 与 `SUPABASE_SERVICE_ROLE_KEY`。
3. 重启 Bot；启动日志出现 `Backend mode: Supabase` 即表示已启用。

Service Role Key 只能存在于后端。不要写入 Mini App、网页前端、Telegram 消息或 Git。启用持久化前请完善 `docs/privacy.md` 并发布隐私政策 URL。

## 验证

```bash
npm run typecheck
npm test
npm run build
```
