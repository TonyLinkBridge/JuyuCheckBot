# 🔍 JUYU 域名体检

`JUYU Domain Check` 是一个面向亚洲与中文用户的 Telegram Growth Bot。用户发送域名后先获得可信初检，订阅 **JUYU 聚域｜域名情报局** 后解锁进阶摘要；完整历史、备案、商标、平台风险与网站资料进入聚查查询，购买、注册、出售和咨询需求直接在同一个 `@JuyuCheckBot` 完成。

正式 Bot 用户名：`@JuyuCheckBot`。

## 用户流程

```text
新用户 → 发送域名 → Evidence Preview → 选择意图 → 订阅频道 → 进阶摘要
                                                           ├─ 普通查询 → 聚查
                                                           └─ 买卖需求 → 同 Bot 商业流程
                    注册 / DNS / 来源   拥有 / 购买 / 研究       ├→ 分享 → 新用户
                                                          └→ 动态 CTA → Lead
```

当前 MVP 已实现：

- 极简 `/start` 首屏和域名输入识别（支持 URL、子域名、中文 IDN）
- 通过 IANA Bootstrap 直达权威注册局 RDAP，并进行原生 DNS 检查，不使用演示数据
- `JUYU-EVIDENCE-3.2` 中文市场决策型证据报告：先说明结论、已确认资料、注意事项、聚查可继续查询的目录与 JUYU 下一步，不提供自创总分
- 免费事实层只保留全球通用的注册与技术资料：权威 RDAP、辅助 WHOIS、DNS、DNSSEC、域龄、到期时间与 EPP 状态
- ICANN 域名使用 RDAP；RDAP 失败后自动回退通用 WHOIS；`eu.cc` 等 TechEdge 私有注册后缀使用对应 Registry WHOIS
- Preview → 意图 → Growth Gate → `结论 / 关键依据 / 注意事项 / JUYU 建议` 进阶摘要
- Value-first 首屏与初检：订阅前先显示注册状态、域龄、到期时间、DNS、资料来源、取得时间与快速结论，再询问用户目的
- `getChatMember` 频道订阅验证和进阶摘要 Growth Gate
- 可传播的 Telegram 深链，以及在同一个 Bot 自动带入域名的购买、出售和注册流程
- Long Polling 本地运行、Vercel/Express Webhook 生产运行、健康检查和 Docker 部署
- Supabase REST 后端持久保存并按用户安全读回报告，支持 Vercel 跨实例解锁
- 新用户识别、首次/最近来源、推荐打开、分享卡和完整 Growth Event 漏斗
- `/recent` 最近报告、15 分钟域名结果缓存、忽略缓存实时重查和安全分享推荐深链
- Referral Growth Loop：朋友结果作为社交证明、推荐用户专属首屏、跨 Serverless 实例来源归因
- 决策型 Inline 分享卡：公开分享关键结论、可信信号和资料覆盖，不公开用户买卖意图；收件人可直接点击「免费检查我的域名」进入 Bot，并保留推荐归因
- Lead Conversion Loop：购买、出售、注册与联系 JUYU 都在 `@JuyuCheckBot` 内完成，保存 Lead 后自动通知管理员
- Jucha Conversion Loop：聚查按钮经 `/go/jucha` 记录真实点击，再携带域名与 UTM 参数进入聚查综合查询
- 每用户每分钟 5 次、24 小时 30 次免费体检限流，以及 Webhook 更新去重
- `/privacy`、公开隐私页面、180 天数据保留与用户自助永久删除
- 对 RDAP、辅助 WHOIS、Registry WHOIS 与 DNS 临时失败执行重试；资料无法确认时明确显示“未知”，不误报可注册
- 推荐打开按独立用户计数，最近报告按域名去重
- 独立的 JUYU Growth Intelligence Dashboard：增长漏斗、商业 Leads、Telegram 用户跟进、推荐闭环、来源质量、Growth Gate 与逐注册资料源健康监控
- Dashboard Poll 引流发布器：测试/正式频道双目标、服务器端 Token、正式发布确认与 `src_` Campaign 自动归因
- 未连接 Supabase 时，本地临时报告只在进程内保留 30 分钟

## 本地启动

使用 Node.js 22.12 或更高的 22.x 版本（与 Vercel 保持一致）。

```bash
npm install
cp .env.example .env
# 使用独立测试 Bot Token，并明确设置 LOCAL_POLLING=true
npm run dev
```

本地默认拒绝启动 Bot。即使启用 `LOCAL_POLLING=true`，发现已配置或线上已有 Webhook 也会拒绝，不会自动修改 Webhook 或命令菜单。允许的本地测试仅使用安全的 `getUpdates` 循环；正式 Webhook 只由显式的 `webhook:set` 操作配置。

## 部署到 Vercel

Vercel 会把 `src/index.ts` 识别为 Express Function。生产环境只处理 Telegram Webhook，不会启动 long polling，也不会在每次冷启动时重设 Webhook。

1. 在 Vercel 选择 **Add New → Project**，导入 `TonyLinkBridge/JuyuCheckBot`。
2. Framework Preset 保持自动检测；无需填写 Output Directory，也无需覆盖 Build Command。
3. Node.js Version 使用 `22.x`。
4. 在 **Settings → Environment Variables** 仅为 **Production** 配置：

   ```text
   BOT_TOKEN
   BOT_USERNAME=JuyuCheckBot
   CHANNEL_USERNAME=JUYU007
   CHANNEL_URL=https://t.me/JUYU007
   CHANNEL_NAME=JUYU 聚域｜域名情报局
   ADMIN_CHAT_ID=接收新 Lead 通知的 Telegram 用户或群组 Chat ID
   JUCHA_URL=https://www.jucha.com/juhe/
   WEBHOOK_URL=https://你的稳定正式域名
   WEBHOOK_SECRET=至少16位、只含 A-Z a-z 0-9 _ - 的随机字符串
   CHECK_TIMEOUT_MS=8000
   SUPABASE_URL
   SUPABASE_SERVICE_ROLE_KEY
   ```

   不需要设置 `PORT`。正式 `BOT_TOKEN` 不要放进 Preview；如需测试 Preview，请创建独立测试 Bot Token，避免覆盖正式 Bot 的 Webhook。

5. 部署成功后先打开 `https://你的正式域名/health`，应返回：

   ```json
   { "ok": true, "status": "healthy", "checkedAt": "...", "checks": { "database": "healthy", "commerce": "healthy", "telegram": "healthy", "webhook": "healthy", "notifications": "healthy" } }
   ```

6. 确保本地 `.env` 使用与 Vercel 相同的 `BOT_TOKEN` 和 `WEBHOOK_SECRET`，执行一次：

   ```bash
   npm run webhook:set -- https://你的稳定正式域名
   ```

## Growth Dashboard

Dashboard 位于 `dashboard/`，与 Telegram Bot 共用仓库和 Supabase，但作为独立 Vercel Project 部署，避免界面变更影响 Webhook。

- 技术：Next.js、shadcn 风格组件、Tremor/Recharts 图表、Tailwind CSS、Geist
- 数据：只在服务器端使用 Supabase Service Role；登录后的管理员页面可查看 Telegram ID 与公开用户名，密钥不会发送到浏览器
- 访问：使用 HttpOnly、Secure、SameSite Cookie 保护的管理员密码登录
- 指标：新用户、工具用户、解锁率、分享率、推荐新用户、Growth Loop Rate 与 K-factor
- 分析：新用户 Cohort Funnel、Referral Funnel、Lead Conversion、Growth Gate 转化、来源质量、报告质量与最近活动
- Lead 数据：默认只从 Check Bot Supabase 读取；旧 Commerce 读取已停用，旧配置及数据库保留，不会自动迁移或删除历史数据

第二个 Vercel Project 的 Root Directory 设置为 `dashboard`，并配置：

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
LEGACY_COMMERCE_ENABLED=false
COMMERCE_SUPABASE_URL
COMMERCE_SUPABASE_SECRET_KEY
DASHBOARD_PASSWORD=至少12位的独立强密码
TELEGRAM_BOT_TOKEN=与 JuyuCheckBot 相同的 BotFather Token
POLL_TEST_CHAT_ID=@juyuofficial
POLL_PRODUCTION_CHAT_ID=@JUYU007
```

`COMMERCE_` 两项可以保留原值。只有明确设置 `LEGACY_COMMERCE_ENABLED=true` 才会重新读取旧 Commerce 历史 Lead；未设置或为 `false` 时不会访问旧库。购买、出售及通知始终使用目前的 Check Bot Supabase，不受此开关影响。

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

   > 输入一个域名，快速查看注册信息、结构、DNS、资料来源与基础警报。免费域名体检，由 JUYU 聚域提供。

4. 用 `/setabouttext` 设置：

   > 🔍 免费域名体检｜JUYU Domain Check

5. 用 `/setuserpic` 上传独立的放大镜 / 雷达风格头像，避免与 Commerce Bot 混淆。
6. 用 `/setinline` 选择 `@JuyuCheckBot`，将 Placeholder 设置为：`分享一份 JUYU 域名体检`。这是让分享卡附带按钮所必需的一次性设置。
7. 将部署平台环境变量中的频道、Bot 用户名与公网 Webhook 地址改成真实值。

命令菜单不会随启动或部署自动更新。部署成功后执行 `npm run menu:sync`，单独同步默认和私聊菜单，不更改 Webhook。命令包含 `/start`、`/menu`、`/check`、`/buy`、`/sell`、`/register`、`/contact`、`/cancel`、`/help`、`/recent`、`/privacy`。

## 旧 Commerce Bot 过渡约定

`@JuyuCheckBot` 可以直接接收以下 `/start` 参数。旧 `@JuyuDomainBot` 在过渡期只需把相同参数转发回来：

- `buy_abc-com`：委托购买 `abc.com`
- `sell_abc-com`：出售 `abc.com`
- `register_abc-com`：委托注册未发现注册记录的域名

连字符会编码为双连字符，例如 `my-domain.com` → `my--domain-com`。旧 Bot 不再创建新 Lead，只保留历史入口和参数跳转；旧 Supabase 不删除。

## Evidence Report 边界

`JUYU-EVIDENCE-3.2` 已移除 JUYU Structure Score、S/A/B 等级和数值化品牌判断。主报告根据买家、持有人或研究者身份，先输出一句话结论、Bot 本次已确认的注册/DNS 事实、注意事项、聚查可继续查询的资料目录与 JUYU 行动建议。普通域名按照 IETF RDAP Bootstrap 标准访问权威注册局；RDAP 失败时使用通用 WHOIS 作为明确标注的非权威辅助来源。对于 Public Suffix List 标记的私有注册后缀，Bot 只在有明确注册局适配器时判断“已注册/未发现记录”；没有可靠来源时显示“暂时无法确认”。

Bot 定位为亚洲与中文市场的域名注册事实初筛，不再查询或展示 Tranco、Chrome UX Report、Ahrefs、Internet Archive 等偏欧美网站生态的指标。`DomainReport.intelligence` 只保留空的兼容结构，用于安全读取旧版 Supabase 报告，不会触发这些外部请求。

ICP 备案、中国商标、国内平台风险、网站历史、搜索表现和历史价格等项目显示为“聚查可继续查询”，Bot 未取得时不会写成“已经找到”，也不会编造数量。只有逐条记录域名、价格、日期与原始来源的已核验成交资料，未来才会显示；没有足够可比案例时不输出价格区间。报告仍不代表商标可用性、历史内容安全、市场需求、估值或交易合法性。

通用 WHOIS 只提取域名、注册商、日期、域名服务器、EPP 状态与 DNSSEC，不保存原始 WHOIS，也不读取或保存注册人邮箱、电话等个人资料。只有明确的 Registry `not found` 回应才会显示“未发现注册记录”；模糊或异常回应一律显示“暂时无法确认”。

## Supabase 后端

本地开发可以使用内存模式；Vercel 生产部署必须使用 Supabase，否则函数扩缩实例后无法可靠解锁先前生成的报告。

1. 在 Check Bot Supabase SQL Editor 执行最新版 `supabase/schema.sql`。脚本可重复执行，并会新增 `bot_sessions` 与 `leads`。
2. 在服务器环境变量填写 `SUPABASE_URL` 与 `SUPABASE_SERVICE_ROLE_KEY`。
3. 重新部署或重启 Bot；日志出现 `Backend mode: Supabase` 即表示已启用。

### 核心流程可靠性升级

在部署本次代码前，执行 `supabase/core-flow-reliability.sql`。它增加管理员通知队列与安全清理函数，不会重新通知既有 Lead。随后可运行 `supabase/tests/core-flow-reliability.sql`；测试数据全部回滚，正式客户资料不受影响。

管理员通知失败会保留在队列；成功通知不会再次领取。任务中断后，五分钟租约到期可重新领取。极少数情况下 Telegram 已收信、但确认状态写入失败，重试可能重复通知；请用 Lead 编号识别同一需求。

自动重试使用免费的 Supabase Cron + pg_net，每五分钟只在有到期任务时调用 Bot 的 `POST /internal/lead-notifications`。该接口拒绝未授权请求。使用 `src/commerce/notification-auth.ts` 中的算法从生产 `WEBHOOK_SECRET` 派生专用令牌，存入 Supabase Vault 的 `juyu_lead_notification_token`，再执行 `supabase/lead-notification-scheduler.sql`。不要把 Bot Token 或专用令牌写进 SQL 文件或 Git。生产 `WEBHOOK_SECRET` 更换时须同步更新 Vault 中的派生令牌。

用户每次私聊操作都会更新活跃时间；未完成表单超过 24 小时失效。自动清理只删除超过保留期限的报告、行为及无关联记录的闲置用户，不通过删除用户来连带删除客户 Lead。用户主动请求删除资料的功能保持不变。

### 防重复、登录与健康检测升级

部署当前代码前须执行 `supabase/production-hardening.sql`，再运行 `supabase/tests/production-hardening.sql`。升级只新增私有表、字段及函数，保留所有旧 Lead；测试在事务内回滚，不会发送通知。

同一表单通过数据库事务只创建一条 Lead；已完成的 Telegram 更新持久去重，旧消息重试不能误改后来发起的表单。只有匹配表单会在提交事务中清除，通知仍使用既有队列。

Dashboard 登录采用随机签名会话、服务端 7 天有效期和数据库撤销；退出后当前会话失效，更换访问密码也会使旧会话失效。每个来源地址在 15 分钟内最多尝试 5 次登录，计数跨实例共享且不保存原始 IP；验证服务不可用时拒绝登录。升级会要求管理员重新登录，不需要更换密码。

`/health` 真实检查数据库访问、提交及队列所需权限、Telegram API、Webhook 地址与积压、管理员配置及超时任务，异常返回 HTTP 503。结果最多复用 15 秒；不会创建需求或试发通知，也不保证外部注册局可用或完整交易流程已验收。Dashboard 显示每项结果与检测时间；无法读取时显示“状态未确认”，不固定亮绿灯。可用 `BOT_HEALTH_URL` 指定独立部署的健康地址。

## 合并上线顺序

### 商业线索跟进升级

部署本轮后台前，在目前的 Check Bot Supabase 执行 `supabase/lead-follow-up.sql`，再运行 `supabase/tests/lead-follow-up.sql`（事务回滚验收，不发送通知）。这是独立增量升级；不要为此重跑基础 schema 的历史数据清理语句。

商业 Leads 可查看原始提交的预算、售价、用途、联系方式、挂牌／议价资料及来源；未填写的字段明确显示“未提供”，不会向客户追加提问。后台跟进状态、备注和手动测试标记存于独立私有表，不修改原始需求 JSON，不触发管理员通知。只有通过 Dashboard 会话校验的服务器操作能写入，旧 Commerce 历史仍只读。

默认展示真实线索；测试记录可单独查看，计数只从商业 Lead 统计中排除，不会删记录或把该用户全部行为过滤。用户、来源与增长页面仍保留原始行为。多页面同时编辑通过版本号拒绝旧页面覆盖；遇到冲突须刷新核对。跟进数据无法读取时明确报错，不展示可能混入测试数据的商业统计。

1. 在 Check Bot Supabase 运行最新版 `supabase/schema.sql`。
2. 在 Check Bot Vercel Project 新增 `ADMIN_CHAT_ID`，保留现有 `SUPABASE_URL` 与 `SUPABASE_SERVICE_ROLE_KEY`。
3. 重新部署 Check Bot。
4. 本地执行 `npm run webhook:set -- https://juyu-check-bot.vercel.app`，同步命令菜单和 Webhook。
5. 管理员在 `@JuyuCheckBot` 私聊发送 `/notifytest`，确认收到通知。
6. 用一个测试域名走完出售或购买流程，确认 Telegram 管理员通知与 Dashboard `/leads` 页面同时出现记录。
7. 最后才部署旧 `@JuyuDomainBot` 的跳转版本。旧 Bot 和旧 Supabase 在确认历史链接正常前不要删除。

Service Role Key 只能存在于后端。不要写入 Mini App、网页前端、Telegram 消息或 Git。公开隐私政策地址为部署域名的 `/privacy`。

## 验证

```bash
npm run typecheck
npm test
npm run build
```
