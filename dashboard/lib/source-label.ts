const sourceLabels: Readonly<Record<string, string>> = {
  direct: "直接打开 Telegram Bot",
  channel: "JUYU Telegram 频道",
  juyucom: "JUYU 官网",
  share: "报告分享入口",
  referral: "朋友分享链接",
  juyu_check_bot: "JUYU 域名体检 Bot",
  juyu_domain_bot: "JUYU 聚域助手",
};

const shortSourceLabels: Readonly<Record<string, string>> = {
  direct: "直接打开",
  channel: "Telegram 频道",
  juyucom: "JUYU 官网",
  share: "报告分享",
  referral: "朋友分享",
  juyu_check_bot: "域名体检 Bot",
  juyu_domain_bot: "聚域助手",
};

export function sourceLabel(source: string): string {
  const known = sourceLabels[source];
  if (known) return known;
  if (source.startsWith("morningbrief_")) return `Telegram 频道活动：${source}`;
  return `活动来源：${source}`;
}

export function sourceShortLabel(source: string): string {
  const known = shortSourceLabels[source];
  if (known) return known;
  if (source.startsWith("morningbrief_")) return "频道活动";
  return source;
}
