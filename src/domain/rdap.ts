import type { RdapResult } from "./types.js";

type RdapEvent = { eventAction?: string; eventDate?: string };
type RdapEntity = {
  roles?: string[];
  vcardArray?: [string, Array<[string, unknown, string, unknown]>];
};
type RdapResponse = {
  errorCode?: number;
  events?: RdapEvent[];
  entities?: RdapEntity[];
  nameservers?: Array<{ ldhName?: string; unicodeName?: string }>;
  status?: string[];
  secureDNS?: { delegationSigned?: boolean };
};

type RegistryWhoisResponse = {
  code?: number;
  data?: string | null;
};

const privateRegistrySuffixes = new Set(["ec.cc", "eu.cc", "gu.cc", "uk.cc", "us.cc"]);

export async function checkRegistration(
  domain: string,
  publicSuffix: string,
  isPrivateSuffix: boolean,
  timeoutMs: number,
): Promise<RdapResult> {
  if (isPrivateSuffix) {
    if (!privateRegistrySuffixes.has(publicSuffix)) return unknownRdap();
    return checkTechEdgeWhois(domain, publicSuffix, timeoutMs);
  }
  return checkRdap(domain, timeoutMs);
}

export async function checkRdap(domain: string, timeoutMs: number): Promise<RdapResult> {
  const response = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
    headers: { Accept: "application/rdap+json, application/json" },
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (response.status === 404) return emptyResult("available");
  if (!response.ok) throw new Error(`RDAP ${response.status}`);

  const data = (await response.json()) as RdapResponse;
  if (data.errorCode === 404) return emptyResult("available");

  return {
    status: "registered",
    registrar: findRegistrar(data.entities),
    createdAt: findEvent(data.events, ["registration"]),
    expiresAt: findEvent(data.events, ["expiration"]),
    updatedAt: findEvent(data.events, ["last changed", "last update of rdap database"]),
    nameServers: (data.nameservers ?? [])
      .map((ns) => ns.ldhName ?? ns.unicodeName)
      .filter((name): name is string => Boolean(name))
      .map((name) => name.toLowerCase().replace(/\.$/, "")),
    statuses: data.status ?? [],
    dnssec: data.secureDNS?.delegationSigned ?? null,
    source: {
      type: "rdap",
      name: "RDAP 注册资料",
      url: `https://rdap.org/domain/${encodeURIComponent(domain)}`,
    },
  };
}

export async function checkRegistrationWithRetry(
  domain: string,
  publicSuffix: string,
  isPrivateSuffix: boolean,
  timeoutMs: number,
  attempts = 2,
): Promise<RdapResult> {
  return retry(
    () => checkRegistration(domain, publicSuffix, isPrivateSuffix, Math.max(1000, Math.floor(timeoutMs / Math.max(1, attempts)))),
    attempts,
  );
}

export async function checkRdapWithRetry(domain: string, timeoutMs: number, attempts = 2): Promise<RdapResult> {
  return retry(() => checkRdap(domain, Math.max(1000, Math.floor(timeoutMs / Math.max(1, attempts)))), attempts);
}

async function retry<T>(operation: () => Promise<T>, attempts: number): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("RDAP lookup failed");
}

function emptyResult(status: "available" | "unknown"): RdapResult {
  return {
    status,
    registrar: null,
    createdAt: null,
    expiresAt: null,
    updatedAt: null,
    nameServers: [],
    statuses: [],
    dnssec: null,
    source: status === "available"
      ? { type: "rdap", name: "RDAP 注册资料", url: null }
      : { type: "unavailable", name: "暂未取得注册资料", url: null },
  };
}

export function unknownRdap(): RdapResult {
  return emptyResult("unknown");
}

async function checkTechEdgeWhois(domain: string, publicSuffix: string, timeoutMs: number): Promise<RdapResult> {
  const sourceUrl = `https://www.nic.${publicSuffix}/whois`;
  const response = await fetch(
    `https://www.nic.${publicSuffix}/websiteApi/site/whois?domainName=${encodeURIComponent(domain)}`,
    {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    },
  );
  if (!response.ok) throw new Error(`Registry WHOIS ${response.status}`);
  const payload = await response.json() as RegistryWhoisResponse;
  if (payload.code !== 1 || typeof payload.data !== "string") throw new Error("Registry WHOIS invalid response");
  if (/^Domain not found\./im.test(payload.data)) {
    return {
      ...emptyResult("available"),
      source: { type: "registry-whois", name: `${publicSuffix.toUpperCase()} Registry WHOIS`, url: sourceUrl },
    };
  }

  const fields = parseWhoisFields(payload.data);
  const domainName = firstField(fields, "domain name");
  if (!domainName || domainName.toLowerCase() !== domain.toLowerCase()) throw new Error("Registry WHOIS domain mismatch");
  return {
    status: "registered",
    registrar: firstField(fields, "registrar"),
    createdAt: parseWhoisDate(firstField(fields, "creation date", "created date")),
    expiresAt: parseWhoisDate(firstField(fields, "registry expiry date", "expiration date", "expiry date")),
    updatedAt: parseWhoisDate(firstField(fields, "updated date", "last updated date")),
    nameServers: valuesFor(fields, "name server").map((value) => value.toLowerCase().replace(/\.$/, "")),
    statuses: valuesFor(fields, "domain status").map((value) => value.split(/\s+https?:\/\//, 1)[0] ?? value),
    dnssec: parseDnssec(firstField(fields, "dnssec")),
    source: { type: "registry-whois", name: `${publicSuffix.toUpperCase()} Registry WHOIS`, url: sourceUrl },
  };
}

function parseWhoisFields(value: string): Map<string, string[]> {
  const fields = new Map<string, string[]>();
  for (const line of value.split(/\r?\n/)) {
    const match = /^([^:]+):\s*(.*)$/.exec(line);
    if (!match?.[1] || !match[2]) continue;
    const key = match[1].trim().toLowerCase();
    const rows = fields.get(key) ?? [];
    rows.push(match[2].trim());
    fields.set(key, rows);
  }
  return fields;
}

function firstField(fields: Map<string, string[]>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = fields.get(key)?.[0];
    if (value) return value;
  }
  return null;
}

function valuesFor(fields: Map<string, string[]>, key: string): string[] {
  return fields.get(key) ?? [];
}

function parseWhoisDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseDnssec(value: string | null): boolean | null {
  if (!value) return null;
  if (/^(signed|yes|true)$/i.test(value)) return true;
  if (/^(unsigned|no|false)$/i.test(value)) return false;
  return null;
}

function findEvent(events: RdapEvent[] | undefined, actions: string[]): Date | null {
  const event = events?.find((item) => actions.includes(item.eventAction?.toLowerCase() ?? ""));
  if (!event?.eventDate) return null;
  const date = new Date(event.eventDate);
  return Number.isNaN(date.getTime()) ? null : date;
}

function findRegistrar(entities: RdapEntity[] | undefined): string | null {
  const registrar = entities?.find((entity) => entity.roles?.includes("registrar"));
  const rows = registrar?.vcardArray?.[1] ?? [];
  const fn = rows.find(([property]) => property === "fn")?.[3];
  return typeof fn === "string" ? fn : null;
}
