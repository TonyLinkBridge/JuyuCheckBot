import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("whoiser", () => ({
  whoisDomain: vi.fn(),
}));

import { whoisDomain } from "whoiser";
import { checkWhoisRegistration } from "../src/domain/whois.js";

const whoisDomainMock = vi.mocked(whoisDomain);

afterEach(() => {
  whoisDomainMock.mockReset();
});

describe("generic WHOIS registration fallback", () => {
  it("returns non-personal registration facts from the most useful WHOIS server", async () => {
    whoisDomainMock.mockResolvedValue({
      "whois.iana.org": { __raw: "refer: whois.registry.example" },
      "whois.registry.example": {
        __raw: [
          "Domain Name: EXAMPLE.TEST",
          "Registrar: Example Registrar Ltd",
          "Creation Date: 2010-01-02T03:04:05Z",
          "Updated Date: 2026-02-03T04:05:06Z",
          "Registry Expiry Date: 2030-01-02T03:04:05Z",
          "Domain Status: clientTransferProhibited https://icann.org/epp#clientTransferProhibited",
          "Name Server: NS1.EXAMPLE.NET",
          "Name Server: NS2.EXAMPLE.NET",
          "DNSSEC: signedDelegation",
          "Registrant Email: private@example.test",
        ].join("\r\n"),
      },
    } as never);

    const result = await checkWhoisRegistration("example.test", 5000);

    expect(result).toMatchObject({
      status: "registered",
      registrar: "Example Registrar Ltd",
      nameServers: ["ns1.example.net", "ns2.example.net"],
      statuses: ["clientTransferProhibited"],
      dnssec: true,
      source: {
        type: "whois",
        name: "辅助 WHOIS · whois.registry.example",
        authoritative: false,
      },
    });
    expect(result.createdAt).toEqual(new Date("2010-01-02T03:04:05Z"));
    expect(result.updatedAt).toEqual(new Date("2026-02-03T04:05:06Z"));
    expect(result.expiresAt).toEqual(new Date("2030-01-02T03:04:05Z"));
    expect(JSON.stringify(result)).not.toContain("private@example.test");
  });

  it("prefers a registry response with dates and nameservers over a later thin response", async () => {
    whoisDomainMock.mockResolvedValue({
      "whois.verisign-grs.com": {
        __raw: [
          "Domain Name: EXAMPLE.COM",
          "Registrar: RESERVED-Internet Assigned Numbers Authority",
          "Creation Date: 1995-08-14T04:00:00Z",
          "Registry Expiry Date: 2027-08-13T04:00:00Z",
          "Name Server: ELLIOTT.NS.CLOUDFLARE.COM",
          "DNSSEC: signedDelegation",
        ].join("\r\n"),
      },
      "whois.iana.org": {
        __raw: [
          "domain: EXAMPLE.COM",
          "created: 1992-01-01",
          "source: IANA",
        ].join("\n"),
      },
    } as never);

    const result = await checkWhoisRegistration("example.com", 5000);

    expect(result.source.name).toBe("辅助 WHOIS · whois.verisign-grs.com");
    expect(result.registrar).toBe("RESERVED-Internet Assigned Numbers Authority");
    expect(result.expiresAt).toEqual(new Date("2027-08-13T04:00:00Z"));
    expect(result.nameServers).toEqual(["elliott.ns.cloudflare.com"]);
  });

  it("returns available only for an explicit registry not-found response", async () => {
    whoisDomainMock.mockResolvedValue({
      "whois.registry.example": { __raw: "No match for \"UNUSED.TEST\"" },
    } as never);

    const result = await checkWhoisRegistration("unused.test", 5000);

    expect(result.status).toBe("available");
    expect(result.source.type).toBe("whois");
  });

  it("rejects an ambiguous response instead of claiming availability", async () => {
    whoisDomainMock.mockResolvedValue({
      "whois.registry.example": { __raw: "WHOIS service terms and conditions only" },
    } as never);

    await expect(checkWhoisRegistration("unclear.test", 5000)).rejects.toThrow("无法确认");
  });
});
