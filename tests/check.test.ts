import { describe, expect, it, vi } from "vitest";

vi.mock("node:dns", () => ({
  promises: {
    resolve4: vi.fn().mockResolvedValue(["192.0.2.1"]),
    resolve6: vi.fn().mockResolvedValue([]),
    resolveNs: vi.fn().mockResolvedValue(["ns1.example.com"]),
    resolveMx: vi.fn().mockResolvedValue([]),
  },
}));

import { checkDomain } from "../src/domain/check.js";
import { normalizeDomain } from "../src/domain/normalize.js";

describe("Chinese-first domain check", () => {
  it("queries registry and DNS facts without calling Western web-metric providers", async () => {
    const requestedUrls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      requestedUrls.push(url);
      if (url === "https://data.iana.org/rdap/dns.json") {
        return new Response(JSON.stringify({ services: [[['com'], ['https://rdap.example/']]] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url === "https://rdap.example/domain/example.com") {
        return new Response(JSON.stringify({
          ldhName: "example.com",
          events: [
            { eventAction: "registration", eventDate: "2000-01-01T00:00:00Z" },
            { eventAction: "expiration", eventDate: "2030-01-01T00:00:00Z" },
          ],
          nameservers: [{ ldhName: "ns1.example.com" }],
          status: ["active"],
          secureDNS: { delegationSigned: false },
        }), { status: 200, headers: { "Content-Type": "application/rdap+json" } });
      }
      return new Response("provider disabled", { status: 503 });
    }));

    const report = await checkDomain(normalizeDomain("example.com"), { timeoutMs: 4000 });

    expect(report.rdap.status).toBe("registered");
    expect(requestedUrls).toEqual([
      "https://data.iana.org/rdap/dns.json",
      "https://rdap.example/domain/example.com",
    ]);
    expect(requestedUrls.join("\n")).not.toMatch(/tranco|chromeuxreport|ahrefs|web\.archive/i);
  });
});
