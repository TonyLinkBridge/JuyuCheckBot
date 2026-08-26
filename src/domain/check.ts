import { checkDnsWithRetry, emptyDnsResult } from "./dns.js";
import type { DomainReport } from "./types.js";
import type { NormalizedDomain } from "./normalize.js";
import { checkRegistrationWithRetry, unknownRdap } from "./rdap.js";
import { buildEvidence } from "./evidence.js";
import { emptyIntelligence } from "./intelligence.js";

export type DomainCheckOptions = { timeoutMs: number };

export async function checkDomain(input: NormalizedDomain, options: DomainCheckOptions): Promise<DomainReport> {
  const [rdapResult, dnsResult] = await Promise.allSettled([
    checkRegistrationWithRetry(input.registrableDomain, input.publicSuffix, input.isPrivateSuffix, options.timeoutMs),
    checkDnsWithRetry(input.ascii, options.timeoutMs),
  ]);

  const rdap = rdapResult.status === "fulfilled" ? rdapResult.value : unknownRdap();
  const dns =
    dnsResult.status === "fulfilled"
      ? dnsResult.value
      : emptyDnsResult();
  // Keep an empty compatibility shape so older Supabase reports remain readable,
  // while the active Bot no longer calls Western web-metric providers.
  const intelligence = emptyIntelligence(input.registrableDomain);
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
