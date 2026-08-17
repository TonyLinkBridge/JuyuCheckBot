import { describe, expect, it } from "vitest";
import { buildEvidence, REPORT_VERSION } from "../src/domain/evidence.js";
import type { DnsResult, RdapResult } from "../src/domain/types.js";

const rdap: RdapResult = {
  status: "registered",
  registrar: "Example Registrar",
  createdAt: new Date("2000-01-01T00:00:00Z"),
  expiresAt: new Date("2030-01-01T00:00:00Z"),
  updatedAt: null,
  nameServers: ["ns1.example.com"],
  statuses: ["active"],
  dnssec: false,
  source: { type: "rdap", name: "RDAP 注册资料", url: "https://rdap.org/domain/example.com" },
};

const dns: DnsResult = {
  checked: true,
  resolves: true,
  ipv4: ["192.0.2.1"],
  ipv6: [],
  nameServers: ["ns1.example.com"],
  mx: [],
};

describe("evidence report", () => {
  it("reports obtained facts without producing a proprietary domain score", () => {
    const result = buildEvidence({
      domain: "example.com",
      registrableDomain: "example.com",
      isIdn: false,
      rdap,
      dns,
      now: new Date("2026-08-17T00:00:00Z"),
    });

    expect(result.reportVersion).toBe(REPORT_VERSION);
    expect(result.evidenceItems.filter((item) => item.available)).toHaveLength(7);
    expect(result.dataCoverage).toBe(100);
    expect(result.alerts).toEqual([]);
    expect(result.structure).toEqual({
      nameLength: 7,
      suffix: "com",
      hyphenCount: 0,
      digitCount: 0,
      characterType: "ascii-letters",
    });
    expect(result).not.toHaveProperty("score");
    expect(result).not.toHaveProperty("grade");
  });

  it("does not claim availability when registration data is unavailable", () => {
    const result = buildEvidence({
      domain: "site.private.example",
      registrableDomain: "site.private.example",
      isIdn: false,
      rdap: {
        ...rdap,
        status: "unknown",
        registrar: null,
        createdAt: null,
        expiresAt: null,
        nameServers: [],
        dnssec: null,
        source: { type: "unavailable", name: "暂未取得注册资料", url: null },
      },
      dns,
    });

    expect(result.summary).toContain("无法确认注册记录");
    expect(result.alerts).toContain("注册状态暂时无法从可用资料源确认");
  });
});
