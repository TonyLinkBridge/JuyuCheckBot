import { afterEach, describe, expect, it, vi } from "vitest";
import { checkRegistration, checkRegistrationWithRetry, checkRdapWithRetry } from "../src/domain/rdap.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("checkRdapWithRetry", () => {
  it("retries a transient failure and returns the next valid response", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("temporary network failure"))
      .mockRejectedValueOnce(new Error("fallback also unavailable"))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ services: [[['com'], ['https://rdap.example/']]] }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            events: [{ eventAction: "registration", eventDate: "2010-01-01T00:00:00Z" }],
            status: ["active"],
          }),
          { status: 200, headers: { "Content-Type": "application/rdap+json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await checkRdapWithRetry("example.com", 4000);

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(String(fetchMock.mock.calls[3]?.[0])).toBe("https://rdap.example/domain/example.com");
    expect(result.status).toBe("registered");
    expect(result.source.authoritative).toBe(true);
    expect(result.createdAt).toEqual(new Date("2010-01-01T00:00:00Z"));
  });

  it("uses the eu.cc registry WHOIS source for a private suffix", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 1,
          msg: "ok",
          data: [
            "Domain Name: euhome.eu.cc",
            "Registrar: July Name Limited",
            "Creation Date: 2026-05-04T08:54:50Z",
            "Updated Date: 2026-08-06T02:08:53Z",
            "Registry Expiry Date: 2027-05-04T08:54:50Z",
            "Domain Status: clientTransferProhibited https://icann.org/epp#clientTransferProhibited",
            "Name Server: braelyn.ns.cloudflare.com",
            "Name Server: elijah.ns.cloudflare.com",
            "DNSSEC: unsigned",
          ].join("\r\n"),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await checkRegistrationWithRetry("euhome.eu.cc", "eu.cc", true, 4000);

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("www.nic.eu.cc/websiteApi/site/whois");
    expect(result).toMatchObject({
      status: "registered",
      registrar: "July Name Limited",
      nameServers: ["braelyn.ns.cloudflare.com", "elijah.ns.cloudflare.com"],
      dnssec: false,
      source: { type: "registry-whois", name: "EU.CC Registry WHOIS" },
    });
    expect(result.createdAt).toEqual(new Date("2026-05-04T08:54:50Z"));
    expect(result.expiresAt).toEqual(new Date("2027-05-04T08:54:50Z"));
  });

  it("treats an explicit private-registry not-found response as available", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: 1, data: "Domain not found.\r\n" }), { status: 200 }),
    ));

    const result = await checkRegistration("unused.eu.cc", "eu.cc", true, 4000);
    expect(result.status).toBe("available");
    expect(result.source.type).toBe("registry-whois");
  });

  it("returns unknown for private suffixes without an authoritative adapter", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await checkRegistration("site.github.io", "github.io", true, 4000);
    expect(result.status).toBe("unknown");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
