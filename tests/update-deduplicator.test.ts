import { describe, expect, it } from "vitest";
import { UpdateDeduplicator } from "../src/update-deduplicator.js";

describe("UpdateDeduplicator", () => {
  it("rejects a repeated update until its TTL expires", () => {
    const deduplicator = new UpdateDeduplicator(1000);
    expect(deduplicator.accept(42, 1000)).toBe(true);
    expect(deduplicator.accept(42, 1500)).toBe(false);
    expect(deduplicator.accept(42, 2000)).toBe(true);
  });
});
