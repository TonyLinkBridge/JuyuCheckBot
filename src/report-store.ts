import { randomBytes } from "node:crypto";
import type { DomainReport } from "./domain/types.js";

type Entry = {
  report: DomainReport;
  userId: number;
  expiresAt: number;
};

export class ReportStore {
  private readonly entries = new Map<string, Entry>();

  constructor(private readonly ttlMs = 30 * 60 * 1000) {}

  put(userId: number, report: DomainReport): string {
    this.prune();
    const token = randomBytes(6).toString("base64url");
    this.entries.set(token, { report, userId, expiresAt: Date.now() + this.ttlMs });
    return token;
  }

  get(token: string, userId: number): DomainReport | null {
    const entry = this.entries.get(token);
    if (!entry || entry.userId !== userId || entry.expiresAt < Date.now()) {
      if (entry?.expiresAt && entry.expiresAt < Date.now()) this.entries.delete(token);
      return null;
    }
    return entry.report;
  }

  private prune(): void {
    const now = Date.now();
    for (const [token, entry] of this.entries) {
      if (entry.expiresAt < now) this.entries.delete(token);
    }
  }
}
