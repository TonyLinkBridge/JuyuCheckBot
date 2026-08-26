export function telegramContactUrl(user: { telegramUserId: number; username: string | null }): string {
  const username = user.username?.trim().replace(/^@/, "");
  return username
    ? `https://t.me/${encodeURIComponent(username)}?profile`
    : `tg://user?id=${encodeURIComponent(String(user.telegramUserId))}`;
}
