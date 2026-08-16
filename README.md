# 🔍 JUYU 域名体检

`JUYU Domain Check` 是一个独立的 Telegram Growth Bot。它不是客服菜单：用户发送域名后立即获得 Score Preview，选择使用意图，订阅 **JUYU 聚域｜域名情报局** 后解锁完整报告，再通过可追踪分享和按意图变化的商业深链形成增长闭环。

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
- 版本化 `JUYU-1.3` 五维结构评分、证据等级、独立风险、数据覆盖和基础活跃度参考
- Preview → 意图 → Growth Gate → `DATA / JUYU ANALYSIS / ACTION` 报告
- `getChatMember` 频道订阅验证和完整报告 Growth Gate
- 可传播的 Telegram 深链，以及带域名参数的 Commerce Bot 买/卖/注册导流
- Long Polling 本地运行、Vercel/Express Webhook 生产运行、健康检查和 Docker 部署
- Supabase REST 后端持久保存并按用户安全读回报告，支持 Vercel 跨实例解锁
- 新用户识别、首次/最近来源、推荐打开、分享卡和完整 Growth Event 漏斗
- `/recent` 最近报告、15 分钟域名结果缓存和安全分享推荐深链
- Referral Growth Loop：朋友结果作为社交证明、推荐用户专属首屏、跨 Serverless 实例来源归因
- Lead Conversion Loop：购买、出售与注册 CTA 先记录商业意向，再一键跳转带域名参数的 `@JuyuDomainBot`
- 每用户每分钟 5 次、24 小时 30 次免费体检限流，以及 Webhook 更新去重
- `/privacy`、公开隐私页面、180 天数据保留与用户自助永久删除
- `JUYU-1.3` 对 RDAP / DNS 临时失败执行重试；证据不足时标记暂定分，基础活跃度与风险不参与结构总分
- 推荐打开按独立用户计数，最近报告按域名去重
- 独立的 JUYU Growth Intelligence Dashboard：增长漏斗、推荐闭环、潜在客户、来源质量、Growth Gate 与数据健康监控
- 未连接 Supabase 时，本地临时报告只在进程内保留 30 分钟

## 本地启动

要求 Node.js 20 或更高版本。

```bash
npm install
cp .env.example .env
# 编辑 .env，至少填写 BOT_TOKEN
npm run dev
```

没有填写 `WEBHOOK_URL` 时使用 long polling。填写后在本地服务器模式使用 webhook，健康检查地址为 `/health`。

## 部署到 Vercel

Vercel 会把 `src/index.ts` 识别为 Express Function。生产环境只处理 Telegram Webhook，不会启动 long polling，也不会在每次冷启动时重设 Webhook。

1. 在 Vercel 选择 **Add New → Project**，导入 `TonyLinkBridge/JuyuCheckBot`。
2. Framework Preset 保持自动检测；无需填写 Output Directory，也无需覆盖 Build Command。
3. Node.js Version 使用 `22.x`。
4. 在 **Settings → Environment Variables** 仅为 **Production** 配置：

   ```text
   BOT_TOKEN
   BOT_USERNAME=JuyuCheckBot
   CHANNEL_USERNAME=juyuofficial
   CHANNEL_URL=https://t.me/juyuofficial
   CHANNEL_NAME=JUYU 聚域｜域名情报局
   COMMERCE_BOT_USERNAME=JuyuDomainBot
   WEBHOOK_URL=https://你的稳定正式域名
   WEBHOOK_SECRET=至少16位、只含 A-Z a-z 0-9 _ - 的随机字符串
   CHECK_TIMEOUT_MS=8000
   SUPABASE_URL
   SUPABASE_SERVICE_ROLE_KEY
   ```

   不需要设置 `PORT`。正式 `BOT_TOKEN` 不要放进 Preview；如需测试 Preview，请创建独立测试 Bot Token，避免覆盖正式 Bot 的 Webhook。

5. 部署成功后先打开 `https://你的正式域名/health`，应返回：

   ```json
   { "ok": true, "service": "juyu-domain-check" }
   ```

6. 确保本地 `.env` 使用与 Vercel 相同的 `BOT_TOKEN` 和 `WEBHOOK_SECRET`，执行一次：

   ```bash
   npm run webhook:set -- https://你的稳定正式域名
   ```

## Growth Dashboard

Dashboard 位于 `dashboard/`，与 Telegram Bot 共用仓库和 Supabase，但作为独立 Vercel Project 部署，避免界面变更影响 Webhook。

- 技术：Next.js、shadcn 风格组件、Tremor/Recharts 图表、Tailwind CSS、Geist
- 数据：只在服务器端使用 Supabase Service Role，浏览器只接收聚合指标
- 访问：使用 HttpOnly、Secure、SameSite Cookie 保护的管理员密码登录
- 指标：新用户、工具用户、解锁率、分享率、推荐新用户、Growth Loop Rate 与 K-factor
- 分析：新用户 Cohort Funnel、Referral Funnel、Lead Conversion、Growth Gate 转化、来源质量、报告质量与最近活动
- 双 Supabase：Dashboard 可在服务器端匹配 Check Bot 导流与 Commerce Bot 已完成 Lead，浏览器不接收 Telegram ID 或联系方式

第二个 Vercel Project 的 Root Directory 设置为 `dashboard`，并配置：

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
COMMERCE_SUPABASE_URL
COMMERCE_SUPABASE_SECRET_KEY
DASHBOARD_PASSWORD=至少12位的独立强密码
```

本地运行：

```bash
npm run dashboard:dev
```

   该命令会同时设置 Bot 命令菜单，并把 Telegram Webhook 指向 `/telegram/webhook`。以后只有正式域名或 Secret 改变时才需重跑。

`vercel.json` 已将函数最大执行时间设为 30 秒。函数区域最好在 Vercel Project Settings 中选择靠近 Supabase 项目的区域。

## Telegram 上线设置

1. 已创建正式 Bot：`@JuyuCheckBot`。在 `@BotFather` 获取 Token，并只写入本地或部署平台的 `BOT_TOKEN` 环境变量。
2. 将 `@JuyuCheckBot` 加为 `@JUYU007` 的频道管理员。Telegram 要求 Bot 具备相应访问权限，才能可靠调用 `getChatMember` 验证其他用户的订阅状态。
3. 用 `/setdescription` 设置：

   > 输入一个域名，快速查看注册信息、结构、历史、DNS 与基础风险。免费域名体检，由 JUYU 聚域提供。

4. 用 `/setabouttext` 设置：

   > 🔍 免费域名体检｜JUYU Domain Check

5. 用 `/setuserpic` 上传独立的放大镜 / 雷达风格头像，避免与 Commerce Bot 混淆。
6. 将部署平台环境变量中的频道、Bot 用户名与公网 Webhook 地址改成真实值。

命令菜单会在进程启动时自动设置：`/start`、`/check`、`/help`。

## Commerce Bot 深链约定

本 Bot 会跳转到 `@JuyuDomainBot` 并传入以下 `/start` 参数：

- `buy_abc-com`：委托购买 `abc.com`
- `sell_abc-com`：出售 `abc.com`
- `register_abc-com`：委托注册未发现注册记录的域名
- `check_abc-com`：进一步人工核查

连字符会编码为双连字符，例如 `my-domain.com` → `my--domain-com`。Commerce Bot 应复用 `encodeDomainParam` / `decodeDomainParam` 的规则，避免域名解析歧义。

## Domain Score 边界

`JUYU-1.3` 的总分只包含品牌力、记忆度、商业适配、后缀匹配与全球化能力。基础活跃度独立显示且不参与结构总分，注册与 DNS 风险也不再直接改变结构质量。证据等级最高暂为 B；在接入可验证成交数据前不会给 A。覆盖不足的报告标记为暂定分。当前仍是透明的初筛启发式规则，不是域名估值，也不代表商标可用性、历史内容安全、SEO 信誉、市场需求或交易合法性。

## Supabase 后端

本地开发可以使用内存模式；Vercel 生产部署必须使用 Supabase，否则函数扩缩实例后无法可靠解锁先前生成的报告。

1. 在 Supabase SQL Editor 执行 `supabase/schema.sql`。
2. 在服务器环境变量填写 `SUPABASE_URL` 与 `SUPABASE_SERVICE_ROLE_KEY`。
3. 重新部署或重启 Bot；日志出现 `Backend mode: Supabase` 即表示已启用。

Service Role Key 只能存在于后端。不要写入 Mini App、网页前端、Telegram 消息或 Git。公开隐私政策地址为部署域名的 `/privacy`。

## 验证

```bash
npm run typecheck
npm test
npm run build
```
