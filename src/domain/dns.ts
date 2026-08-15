import { promises as dns } from "node:dns";
import type { DnsResult } from "./types.js";

export async function checkDns(domain: string, timeoutMs: number): Promise<DnsResult> {
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

  const [ipv4, ipv6, nameServers, mx] = await Promise.all([
    safely(withTimeout(dns.resolve4(domain))),
    safely(withTimeout(dns.resolve6(domain))),
    safely(withTimeout(dns.resolveNs(domain))),
    safely(withTimeout(dns.resolveMx(domain))),
  ]);

  return {
    resolves: ipv4.length > 0 || ipv6.length > 0 || nameServers.length > 0 || mx.length > 0,
    ipv4,
    ipv6,
    nameServers: nameServers.map((name) => name.toLowerCase().replace(/\.$/, "")),
    mx: mx.sort((a, b) => a.priority - b.priority),
  };
}

async function safely<T>(promise: Promise<T[]>): Promise<T[]> {
  try {
    return await promise;
  } catch {
    return [];
  }
}
