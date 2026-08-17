import { checkDnsWithRetry, emptyDnsResult } from "./dns.js";
import type { DomainReport } from "./types.js";
import type { NormalizedDomain } from "./normalize.js";
import { checkRegistrationWithRetry, unknownRdap } from "./rdap.js";
import { buildEvidence } from "./evidence.js";

export async function checkDomain(input: NormalizedDomain, timeoutMs: number): Promise<DomainReport> {
  const [rdapResult, dnsResult] = await Promise.allSettled([
    checkRegistrationWithRetry(input.registrableDomain, input.publicSuffix, input.isPrivateSuffix, timeoutMs),
    checkDnsWithRetry(input.ascii, timeoutMs),
  ]);

  const rdap = rdapResult.status === "fulfilled" ? rdapResult.value : unknownRdap();
  const dns =
    dnsResult.status === "fulfilled"
      ? dnsResult.value
      : emptyDnsResult();
  const evidence = buildEvidence({
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
    ...evidence,
  };
}
