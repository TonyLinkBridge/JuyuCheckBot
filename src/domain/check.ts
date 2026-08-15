import { checkDns } from "./dns.js";
import type { DomainReport } from "./types.js";
import type { NormalizedDomain } from "./normalize.js";
import { checkRdap, unknownRdap } from "./rdap.js";
import { scoreDomain } from "./score.js";

export async function checkDomain(input: NormalizedDomain, timeoutMs: number): Promise<DomainReport> {
  const [rdapResult, dnsResult] = await Promise.allSettled([
    checkRdap(input.registrableDomain, timeoutMs),
    checkDns(input.ascii, timeoutMs),
  ]);

  const rdap = rdapResult.status === "fulfilled" ? rdapResult.value : unknownRdap();
  const dns =
    dnsResult.status === "fulfilled"
      ? dnsResult.value
      : { resolves: false, ipv4: [], ipv6: [], nameServers: [], mx: [] };
  const scored = scoreDomain({
    domain: input.ascii,
    registrableDomain: input.registrableDomain,
    isIdn: input.isIdn,
    rdap,
    dns,
  });

  return {
    domain: input.ascii,
    registrableDomain: input.registrableDomain,
    isSubdomain: input.ascii !== input.registrableDomain,
    isIdn: input.isIdn,
    checkedAt: new Date(),
    rdap,
    dns,
    ...scored,
  };
}
