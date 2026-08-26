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
  source: {
    type: "rdap",
    name: "权威 RDAP · rdap.example",
    url: "https://rdap.example/domain/example.com",
    authoritative: true,
    checkedAt: new Date("2026-08-17T00:00:00Z"),
  },
};

const dns: DnsResult = {
  checked: true,
  resolves: true,
  ipv4: ["192.0.2.1"],
  ipv6: [],
  nameServers: ["ns1.example.com"],
  mx: [],
  source: { name: "实时 DNS 查询", url: null, checkedAt: new Date("2026-08-17T00:00:00Z") },
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

    expect(result.reportVersion).toBe("JUYU-EVIDENCE-3.2");
    expect(REPORT_VERSION).toBe("JUYU-EVIDENCE-3.2");
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
        source: {
          type: "unavailable",
          name: "暂未取得注册资料",
          url: null,
          authoritative: false,
          checkedAt: new Date("2026-08-17T00:00:00Z"),
        },
      },
      dns,
    });

    expect(result.summary).toContain("无法确认注册记录");
    expect(result.alerts).toContain("注册状态暂时无法从可用资料源确认");
  });

  it("warns when an EPP hold status suspends normal resolution", () => {
    const result = buildEvidence({
      domain: "example.com",
      registrableDomain: "example.com",
      isIdn: false,
      rdap: { ...rdap, statuses: ["clientHold"] },
      dns,
    });

    expect(result.alerts).toContain("域名状态显示暂停解析，需到注册商或注册局核实原因");
  });

  it("warns when an EPP status shows redemption or pending deletion", () => {
    const result = buildEvidence({
      domain: "example.com",
      registrableDomain: "example.com",
      isIdn: false,
      rdap: { ...rdap, statuses: ["pendingDelete"] },
      dns,
    });

    expect(result.alerts).toContain("域名处于赎回或待删除流程，状态可能快速变化");
  });

  it("does not treat an ordinary transfer lock as a risk alert", () => {
    const result = buildEvidence({
      domain: "example.com",
      registrableDomain: "example.com",
      isIdn: false,
      rdap: { ...rdap, statuses: ["clientTransferProhibited"] },
      dns,
    });

    expect(result.alerts).toEqual([]);
  });
});
