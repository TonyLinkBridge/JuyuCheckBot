import type { DomainIntelligence } from "./types.js";

export function emptyIntelligence(domain: string, checkedAt = new Date()): DomainIntelligence {
  return {
    tranco: { status: "unavailable", rank: null, rankedAt: null, checkedAt },
    crux: {
      status: "unavailable",
      origin: `https://${domain}`,
      lcpP75Ms: null,
      inpP75Ms: null,
      clsP75: null,
      periodStart: null,
      periodEnd: null,
      checkedAt,
    },
    ahrefs: { status: "unavailable", domainRating: null, checkedAt },
    wayback: {
      status: "unavailable",
      firstCaptureAt: null,
      latestCaptureAt: null,
      firstCaptureUrl: null,
      latestCaptureUrl: null,
      checkedAt,
    },
  };
}
