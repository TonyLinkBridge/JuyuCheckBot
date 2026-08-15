import { describe, expect, it } from "vitest";
import {
  decodeDomainParam,
  DomainInputError,
  encodeDomainParam,
  normalizeDomain,
} from "../src/domain/normalize.js";

describe("normalizeDomain", () => {
  it("extracts and normalizes a domain from a URL", () => {
    expect(normalizeDomain("https://WWW.Example.COM:443/path?q=1")).toMatchObject({
      ascii: "example.com",
      registrableDomain: "example.com",
      subdomain: null,
      isIdn: false,
    });
  });

  it("keeps a meaningful subdomain", () => {
    expect(normalizeDomain("store.example.co.uk")).toMatchObject({
      ascii: "store.example.co.uk",
      registrableDomain: "example.co.uk",
      subdomain: "store",
    });
  });

  it("converts an IDN to ASCII", () => {
    expect(normalizeDomain("聚域.com")).toMatchObject({
      ascii: "xn--cjsx55g.com",
      isIdn: true,
    });
  });

  it("rejects email addresses and malformed labels", () => {
    expect(() => normalizeDomain("hello@example.com")).toThrow(DomainInputError);
    expect(() => normalizeDomain("-bad.com")).toThrow(DomainInputError);
  });
});

describe("deep-link domain encoding", () => {
  it.each(["example.com", "my-domain.com", "a--b.co.uk"])("round trips %s", (domain) => {
    expect(decodeDomainParam(encodeDomainParam(domain))).toBe(domain);
  });
});
