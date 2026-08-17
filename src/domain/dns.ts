import { promises as dns } from "node:dns";
import type { DnsResult } from "./types.js";

export async function checkDns(domain: string, timeoutMs: number): Promise<DnsResult> {
  const checkedAt = new Date();
  const withTimeout = async <T>(promise: Promise<T>): Promise<T> => {
    let timeout: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          timeout = setTimeout(() => reject(new Error("DNS timeout")), timeoutMs);
        }),
      ]);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  };

  const lookups = await Promise.all([
    safely(withTimeout(dns.resolve4(domain))),
    safely(withTimeout(dns.resolve6(domain))),
    safely(withTimeout(dns.resolveNs(domain))),
    safely(withTimeout(dns.resolveMx(domain))),
  ]);
  const [ipv4Lookup, ipv6Lookup, nameServerLookup, mxLookup] = lookups;
  const ipv4 = ipv4Lookup.values;
  const ipv6 = ipv6Lookup.values;
  const nameServers = nameServerLookup.values;
  const mx = mxLookup.values;
  const resolves = ipv4.length > 0 || ipv6.length > 0 || nameServers.length > 0 || mx.length > 0;
  const checked = resolves || lookups.filter((lookup) => lookup.definitive).length >= 3;

  return {
    checked,
    resolves,
    ipv4,
    ipv6,
    nameServers: nameServers.map((name) => name.toLowerCase().replace(/\.$/, "")),
    mx: mx.sort((a, b) => a.priority - b.priority),
    source: {
      name: "实时 DNS 查询",
      url: null,
      checkedAt,
    },
  };
}

export async function checkDnsWithRetry(domain: string, timeoutMs: number, attempts = 2): Promise<DnsResult> {
  const attemptTimeout = Math.max(1000, Math.floor(timeoutMs / Math.max(1, attempts)));
  let last: DnsResult | null = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    last = await checkDns(domain, attemptTimeout);
    if (last.checked) return last;
  }
  return last ?? emptyDnsResult();
}

type LookupResult<T> = { values: T[]; definitive: boolean };

async function safely<T>(promise: Promise<T[]>): Promise<LookupResult<T>> {
  try {
    return { values: await promise, definitive: true };
  } catch (error) {
    return { values: [], definitive: isDefinitiveDnsAnswer(error) };
  }
}

function isDefinitiveDnsAnswer(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) return false;
  const code = String(error.code);
  return code === "ENODATA" || code === "ENOTFOUND" || code === "ENONAME" || code === "NOTFOUND" || code === "NODATA";
}

export function emptyDnsResult(): DnsResult {
  return {
    checked: false,
    resolves: false,
    ipv4: [],
    ipv6: [],
    nameServers: [],
    mx: [],
    source: { name: "实时 DNS 查询", url: null, checkedAt: new Date() },
  };
}
