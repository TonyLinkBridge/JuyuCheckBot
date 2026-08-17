export const PRIVACY_RETENTION_DAYS = 180;

export const privacyBotText = `🔐 <b>JUYU 域名体检｜隐私说明</b>

为了生成和恢复报告、验证产品转化，系统会保存：
• Telegram 数字用户 ID
• 你主动提交的域名与使用意图
• 报告结果、来源标记和产品事件

我们不会保存 Bot Token、密码或其他私人聊天内容；数据不会出售。报告与产品事件最多保留 ${PRIVACY_RETENTION_DAYS} 天。

你可以随时点击下方按钮删除与 Telegram 用户 ID 关联的报告、事件和用户资料。删除后无法恢复。`;

export function privacyHtml(serviceName: string): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${serviceName}｜隐私说明</title>
  <style>
    body{margin:0;background:#0b0d10;color:#e8eaed;font:16px/1.75 system-ui,-apple-system,sans-serif}
    main{max-width:720px;margin:auto;padding:56px 24px}.tag{color:#58d0a6;font-weight:700}
    h1{font-size:32px;line-height:1.2}h2{margin-top:34px;font-size:20px}p,li{color:#b9c0c8}
    a{color:#58d0a6}code{background:#171b20;padding:2px 6px;border-radius:5px}
  </style>
</head>
<body><main>
  <div class="tag">JUYU DOMAIN CHECK</div>
  <h1>隐私说明</h1>
  <p>更新日期：2026-08-15</p>
  <h2>我们保存什么</h2>
  <ul><li>Telegram 数字用户 ID</li><li>用户主动提交的域名与使用意图</li><li>域名报告、来源标记和产品事件</li></ul>
  <h2>为什么保存</h2>
  <p>用于生成及恢复报告、提供订阅解锁、衡量产品转化和改进域名资料覆盖。我们不会保存 Bot Token、密码或其他私人聊天内容，也不会出售这些数据。</p>
  <h2>保留与删除</h2>
  <p>报告、产品事件和不活跃用户资料最多保留 ${PRIVACY_RETENTION_DAYS} 天。你可以在 Telegram Bot 中发送 <code>/privacy</code>，然后选择“删除我的数据”。删除后无法恢复。</p>
  <h2>第三方处理</h2>
  <p>服务使用 Telegram、Vercel 与 Supabase 处理请求和保存数据，各服务可能依照其政策处理必要的技术信息。</p>
  <h2>联系</h2>
  <p>如需隐私协助，请通过 <a href="https://www.juyu.com/">JUYU.com</a> 联系我们。</p>
</main></body></html>`;
}

export function landingHtml(botUsername: string, channelUrl: string): string {
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>JUYU 域名体检</title><style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#090b0e;color:#eef1f4;font:16px/1.65 system-ui,-apple-system,sans-serif}
main{max-width:680px;padding:48px 26px}.tag{color:#58d0a6;font-weight:800;letter-spacing:.08em}h1{font-size:46px;line-height:1.1;margin:14px 0}p{color:#adb5bf;font-size:19px}
.actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:30px}a{padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:700}.primary{background:#58d0a6;color:#07100d}.secondary{border:1px solid #343b44;color:#e8eaed}
</style></head><body><main><div class="tag">JUYU DOMAIN CHECK</div><h1>一个域名到底怎么样？</h1>
<p>使用有明确来源的资料，快速查看域名结构、注册状态、DNS 与基础警报。</p>
<div class="actions"><a class="primary" href="https://t.me/${encodeURIComponent(botUsername)}">打开 Telegram 体检</a><a class="secondary" href="${channelUrl}">JUYU 情报局</a><a class="secondary" href="/privacy">隐私说明</a></div>
</main></body></html>`;
}
