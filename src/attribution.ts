export class AttributionStore {
  private readonly sources = new Map<number, { source: string; expiresAt: number }>();

  constructor(private readonly ttlMs = 30 * 24 * 60 * 60 * 1000) {}

  set(userId: number, source: string): string {
    const normalized = normalizeSource(source);
    this.sources.set(userId, { source: normalized, expiresAt: Date.now() + this.ttlMs });
    return normalized;
  }

  get(userId: number): string {
    const value = this.sources.get(userId);
    if (!value || value.expiresAt < Date.now()) {
      if (value) this.sources.delete(userId);
      return "direct";
    }
    return value.source;
  }

  delete(userId: number): void {
    this.sources.delete(userId);
  }
}

export function sourceFromStartPayload(payload: string | undefined): string {
  if (!payload) return "direct";
  if (payload.startsWith("share_")) return "share";
  if (payload.startsWith("ref_")) return "referral";
  if (payload.startsWith("src_")) return normalizeSource(payload.slice(4));
  if (payload === "channel" || payload === "juyucom") return payload;
  return "direct";
}

function normalizeSource(source: string): string {
  const normalized = source.toLowerCase().replace(/[^a-z0-9_-]/g, "_").slice(0, 32);
  return normalized || "direct";
}
