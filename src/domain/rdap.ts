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
  };
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
  };
}

export function unknownRdap(): RdapResult {
  return emptyResult("unknown");
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
