export function selectedVisibleUser<T extends { telegramUserId: number }>(visible: T[], selectedId: number | null): T | null {
  return visible.find((item) => item.telegramUserId === selectedId) ?? visible[0] ?? null;
}
