export class UpdateDeduplicator {
  private readonly seen = new Map<number, number>();

  constructor(private readonly ttlMs = 10 * 60 * 1000) {}

  accept(updateId: number, now = Date.now()): boolean {
    this.prune(now);
    if (this.seen.has(updateId)) return false;
    this.seen.set(updateId, now + this.ttlMs);
    return true;
  }

  private prune(now: number): void {
    for (const [updateId, expiresAt] of this.seen) {
      if (expiresAt <= now) this.seen.delete(updateId);
    }
  }
}
