# JUYU 单一 Bot 闭环设计

## 目标

将 `@JuyuCheckBot` 变成用户唯一需要认识的 JUYU Telegram Bot：用户在同一个私聊中完成域名初检、前往聚查深查、提交购买/注册/出售需求以及联系 JUYU。`@JUYU007` 继续作为内容频道；旧 `@JuyuDomainBot` 暂不关闭，只负责把旧入口带参数转回主 Bot。

## 产品边界

第一版合并：

- 域名体检与频道订阅验证。
- 前往聚查查看完整资料，保留域名、报告编号、意图和来源。
- 委托购买、协助注册、提交出售、联系 JUYU。
- Lead 存入 Check Bot 的 Supabase。
- 新 Lead 发送 Telegram 管理员通知。
- Dashboard 同时显示新数据库 Lead 与旧 Commerce Supabase 历史 Lead。
- 未完成流程可以在同一 Bot 中继续或取消。

第一版不合并：

- 群欢迎、群统计、防广告和群内自动回复。
- 活动报名、内容发布、今日域名、过期域名列表。
- 用户角色、会员等级和次数限制。
- 域名提醒。
- 旧 Commerce Supabase 的历史数据迁移。

## 用户路径

### 域名持有人

`发送域名 → 选择“我是域名持有人” → 查看摘要 → 提交出售 → 期望售价 → 是否议价 → 是否挂牌 → 联系方式 → Lead 完成`

售价允许直接输入，也提供“待报价 / 面议”和“暂不确定”按钮，降低用户在第一步退出的概率。

### 域名买家

已注册域名：

`发送域名 → 选择“我想购买” → 查看摘要 → 委托收购 → 预算 → 用途 → 联系方式 → Lead 完成`

未注册域名：

`发送域名 → 选择“我想购买” → 查看摘要 → 协助注册 → 联系方式 → Lead 完成`

### 研究用户

`发送域名 → 选择“只是研究” → 查看摘要 → 前往聚查查看完整资料或继续体检`

### 联系 JUYU

主菜单提供“联系 JUYU”，用户发送一段需求和联系方式后生成联系 Lead。

## 单一入口原则

- 用户可见主 Bot：`@JuyuCheckBot`。
- 频道：`@JUYU007`，仅内容、Poll 和引流按钮。
- 聚查：完整资料、注册、充值和查询消费。
- 旧 `@JuyuDomainBot`：过渡期跳转器，不再创建新的商业 Lead。
- 后端仍按模块拆分，体检、商业流程和 Dashboard 不塞进同一个大文件。

## 数据设计

Check Bot Supabase 新增：

### `bot_sessions`

- `telegram_user_id`：主键，关联 `user_profiles`。
- `flow`：`buy | sell | register | contact`。
- `step`：当前问题。
- `data`：域名、报告编号、来源和已填写答案。
- `updated_at`：用于恢复和清理过期流程。

### `leads`

- `id`：Lead 编号。
- `lead_type`：`buy | sell | contact`；注册需求使用 `lead_type=buy` 与 `data.service=register`，兼容旧 Dashboard。
- `telegram_user_id`、`username`：方便后台跟进。
- `data`：域名、预算、用途、售价、议价、挂牌、联系方式、来源、报告编号。
- `status`：默认 `new`。
- `created_at`。

RLS 保持开启，不向 `anon` 或 `authenticated` 开放；仅服务端 Service Role 读写。删除用户数据时同时删除会话和 Lead。

旧 Commerce Supabase 暂时只读。Dashboard 合并两边结果，并以数据库来源与 Lead ID 形成稳定键，避免编号相同造成冲突。

## 行为事件

新增事件：

- `lead_started`：商业流程开始。
- `lead_step_completed`：完成一个选择步骤，只记录步骤名，不记录联系方式正文。
- `lead_cancelled`：用户取消。
- `lead_submitted`：Lead 入库成功，metadata 记录 action 与 leadId。
- `lead_notification_failed`：Lead 已保存但管理员通知失败。

旧 `commerce_handoff` 保留给历史分析，但新流程不再把用户送到另一个 Bot。

## Telegram 交互

- `/buy`、`/sell`、`/contact`、`/cancel` 作为直接入口。
- `/start buy_<domain>`、`sell_<domain>`、`register_<domain>` 用于旧 Bot 或外部链接带入域名。
- 商业流程进行时，普通文字优先作为当前问题答案；没有流程时才当作域名体检输入。
- `/start` 或主菜单发现未完成流程时，显示“继续”与“取消”，不会静默覆盖。
- 每个按钮都检查当前 session 的 flow 与 step，过期按钮不会写错资料。
- Lead 完成后显示 Lead 编号、域名和 JUYU 会跟进的说明。

## 管理员通知

新增后端环境变量 `ADMIN_CHAT_ID`。Lead 先入库，再发送通知；通知失败不能丢失 Lead，并记录失败事件。通知显示：

- Lead 编号与类型。
- Telegram 用户名和用户 ID。
- 域名与用户填写的商业信息。
- 来源、导流入口和报告编号。

`/notifytest` 只允许 `ADMIN_CHAT_ID` 对应账号执行，用来确认 Bot 已能给管理员发消息。

## 旧 Bot 过渡

旧 `@JuyuDomainBot` 收到 `/start`、`/menu`、`buy_*`、`sell_*`、`register_*` 时，不再启动旧 Lead 流程，而是显示：

“JUYU 查询与商业服务已合并到 @JuyuCheckBot。”

按钮跳到：

- `https://t.me/JuyuCheckBot?start=buy_<encoded-domain>`
- `https://t.me/JuyuCheckBot?start=sell_<encoded-domain>`
- `https://t.me/JuyuCheckBot?start=register_<encoded-domain>`
- 无域名时 `https://t.me/JuyuCheckBot?start=src_juyu_domain_bot`

旧数据库保留，不删除旧 Lead。

## 亚洲与中国市场文案

- 购买预算以人民币为主，兼容用户直接填写其他币种。
- 联系方式示例顺序：Telegram、微信、WhatsApp、Email。
- 出售价格支持人民币、美元和“待报价”。
- 不显示 Ahrefs、Tranco、CrUX、Similarweb 等偏海外增长指标。
- 完整历史、备案、国内平台风险和市场资料继续引导聚查。

## 错误与隐私

- Supabase 写入失败：提示暂时无法提交，不显示成功编号。
- 管理员通知失败：用户仍收到提交成功，因为 Lead 已保存。
- 不在 growth event metadata 保存联系方式、留言或完整商业答案。
- 不保存原始 WHOIS、注册人邮箱或电话。
- 用户执行数据删除时，一并删除新会话与新 Lead；旧 Commerce 数据仍按旧系统的删除流程处理，Dashboard 标注为历史来源。

## 验收条件

- 用户点击体检报告的出售/收购/注册按钮后，不再跳到另一个 Bot。
- 域名与报告上下文自动带入，不要求重新输入。
- 四类流程能在同一个 Bot 完成并生成 Lead。
- 管理员能收到包含 Telegram ID 的通知。
- Dashboard 能读取新 Lead，同时不丢失旧 Lead。
- 未完成流程可恢复、可取消，域名体检仍正常。
- 旧 Bot 的入口能保留 action/domain 跳到新 Bot。
- 单元测试、TypeScript 检查、Bot 构建与 Dashboard 构建全部通过。
