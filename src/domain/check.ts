import { checkDnsWithRetry, emptyDnsResult } from "./dns.js";
import type { DomainReport } from "./types.js";
import type { NormalizedDomain } from "./normalize.js";
import { checkRegistrationWithRetry, unknownRdap } from "./rdap.js";
import { buildEvidence } from "./evidence.js";
import { checkDomainIntelligence, emptyIntelligence, type IntelligenceOptions } from "./intelligence.js";

export async function checkDomain(input: NormalizedDomain, options: IntelligenceOptions): Promise<DomainReport> {
  const [rdapResult, dnsResult, intelligenceResult] = await Promise.allSettled([
    checkRegistrationWithRetry(input.registrableDomain, input.publicSuffix, input.isPrivateSuffix, options.timeoutMs),
    checkDnsWithRetry(input.ascii, options.timeoutMs),
    checkDomainIntelligence(input.registrableDomain, options),
  ]);

  const rdap = rdapResult.status === "fulfilled" ? rdapResult.value : unknownRdap();
  const dns =
    dnsResult.status === "fulfilled"
      ? dnsResult.value
      : emptyDnsResult();
  const intelligence = intelligenceResult.status === "fulfilled"
    ? intelligenceResult.value
    : emptyIntelligence(input.registrableDomain);
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
    intelligence,
    ...evidence,
  };
}
