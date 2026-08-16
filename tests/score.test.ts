import { describe, expect, it } from "vitest";
import { scoreDomain } from "../src/domain/score.js";
import type { DnsResult, RdapResult } from "../src/domain/types.js";

const healthyDns: DnsResult = {
  checked: true,
  resolves: true,
  ipv4: ["93.184.216.34"],
  ipv6: [],
  nameServers: ["ns1.example.com"],
  mx: [{ exchange: "mail.example.com", priority: 10 }],
};

function rdap(overrides: Partial<RdapResult> = {}): RdapResult {
  return {
    status: "registered",
    registrar: "Example Registrar",
    createdAt: new Date("2010-01-01T00:00:00Z"),
    expiresAt: new Date("2028-01-01T00:00:00Z"),
    updatedAt: null,
    nameServers: [],
    statuses: [],
    dnssec: true,
    ...overrides,
  };
}

describe("scoreDomain", () => {
  it("rewards an established, healthy, short .com", () => {
    const result = scoreDomain({
      domain: "brand.com",
      registrableDomain: "brand.com",
      isIdn: false,
      rdap: rdap(),
      dns: healthyDns,
      now: new Date("2026-08-14T00:00:00Z"),
    });
    expect(result.score).toBeGreaterThanOrEqual(90);
    expect(result.grade).toBe("S");
    expect(result.scoreVersion).toBe("JUYU-1.3");
    expect(result.confidence).toBe("medium");
    expect(result.evidenceGrade).toBe("B");
    expect(result.provisional).toBe(false);
    expect(result.marketEvidence).toBe("limited");
    expect(Object.keys(result.dimensions)).toHaveLength(6);
    expect(result.dimensions.extensionFit.score).toBe(100);
    expect(result.riskLevel).toBe("low");
  });

  it("does not treat an unpronounceable short string like a strong word brand", () => {
    const word = scoreDomain({
      domain: "brand.com",
      registrableDomain: "brand.com",
      isIdn: false,
      rdap: rdap(),
      dns: healthyDns,
      now: new Date("2026-08-14T00:00:00Z"),
    });
    const random = scoreDomain({
      domain: "xqzv.com",
      registrableDomain: "xqzv.com",
      isIdn: false,
      rdap: rdap(),
      dns: healthyDns,
      now: new Date("2026-08-14T00:00:00Z"),
    });

    expect(word.score).toBeGreaterThan(random.score);
    expect(random.dimensions.brandability.score).toBeLessThan(word.dimensions.brandability.score);
    expect(random.structureNotes.join(" ")).toContain("发音线索较弱");
    expect(random.dimensions.marketSignals.label).toBe("基础活跃度");
    expect(random.dimensions.marketSignals.weight).toBe(0);
  });

  it("flags a domain that expires within 30 days and has no DNS", () => {
    const result = scoreDomain({
      domain: "new-risky-domain.net",
      registrableDomain: "new-risky-domain.net",
      isIdn: false,
      rdap: rdap({
        createdAt: new Date("2026-08-01T00:00:00Z"),
        expiresAt: new Date("2026-08-20T00:00:00Z"),
        dnssec: false,
      }),
      dns: { checked: true, resolves: false, ipv4: [], ipv6: [], nameServers: [], mx: [] },
      now: new Date("2026-08-14T00:00:00Z"),
    });
    expect(result.riskLevel).toBe("high");
    expect(result.riskFlags.join(" ")).toContain("不足 30 天");
    expect(result.score).toBeLessThan(50);
    expect(result.grade).toBe("D");
  });

  it("keeps structure quality separate from registration risk", () => {
    const safe = scoreDomain({
      domain: "brand.com",
      registrableDomain: "brand.com",
      isIdn: false,
      rdap: rdap({ expiresAt: new Date("2028-01-01T00:00:00Z") }),
      dns: healthyDns,
      now: new Date("2026-08-14T00:00:00Z"),
    });
    const expiring = scoreDomain({
      domain: "brand.com",
      registrableDomain: "brand.com",
      isIdn: false,
      rdap: rdap({ expiresAt: new Date("2026-08-20T00:00:00Z") }),
      dns: healthyDns,
      now: new Date("2026-08-14T00:00:00Z"),
    });

    expect(expiring.riskLevel).toBe("high");
    expect(expiring.score).toBe(safe.score);
  });

  it("does not punish the total score when external activity data is unavailable", () => {
    const complete = scoreDomain({
      domain: "crypto.com",
      registrableDomain: "crypto.com",
      isIdn: false,
      rdap: rdap(),
      dns: healthyDns,
      now: new Date("2026-08-14T00:00:00Z"),
    });
    const incomplete = scoreDomain({
      domain: "crypto.com",
      registrableDomain: "crypto.com",
      isIdn: false,
      rdap: rdap({
        status: "unknown",
        registrar: null,
        createdAt: null,
        expiresAt: null,
        dnssec: null,
      }),
      dns: { checked: false, resolves: false, ipv4: [], ipv6: [], nameServers: [], mx: [] },
      now: new Date("2026-08-14T00:00:00Z"),
    });

    expect(incomplete.score).toBeGreaterThanOrEqual(complete.score - 2);
    expect(incomplete.confidence).toBe("low");
    expect(incomplete.evidenceGrade).toBe("D");
    expect(incomplete.provisional).toBe(true);
    expect(incomplete.riskLevel).toBe("unknown");
    expect(incomplete.dimensions.marketSignals.available).toBe(false);
    expect(incomplete.dimensions.marketSignals.conclusion).toContain("不参与结构总分");
  });
});
