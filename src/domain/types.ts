export type RegistrationStatus = "registered" | "available" | "unknown";

export type RegistrationSourceType = "rdap" | "registry-whois" | "unavailable";

export type RegistrationSource = {
  type: RegistrationSourceType;
  name: string;
  url: string | null;
  authoritative: boolean;
  checkedAt: Date;
};

export type DnsSource = {
  name: string;
  url: string | null;
  checkedAt: Date;
};

export type RdapResult = {
  status: RegistrationStatus;
  registrar: string | null;
  createdAt: Date | null;
  expiresAt: Date | null;
  updatedAt: Date | null;
  nameServers: string[];
  statuses: string[];
  dnssec: boolean | null;
  source: RegistrationSource;
};

export type DnsResult = {
  checked: boolean;
  resolves: boolean;
  ipv4: string[];
  ipv6: string[];
  nameServers: string[];
  mx: Array<{ exchange: string; priority: number }>;
  source: DnsSource;
};

export type DomainIntent = "owner" | "buyer" | "research";
export type EvidenceItem = {
  key: "registration" | "registrar" | "created" | "expiry" | "nameservers" | "dns" | "dnssec";
  label: string;
  available: boolean;
};

export type StructureFacts = {
  nameLength: number;
  suffix: string;
  hyphenCount: number;
  digitCount: number;
  characterType: "ascii-letters" | "ascii-mixed" | "idn";
};

export type ExternalDataStatus = "available" | "not_found" | "not_configured" | "unavailable";

export type TrancoResult = {
  status: ExternalDataStatus;
  rank: number | null;
  rankedAt: string | null;
  checkedAt: Date;
};

export type CruxResult = {
  status: ExternalDataStatus;
  origin: string;
  lcpP75Ms: number | null;
  inpP75Ms: number | null;
  clsP75: number | null;
  periodStart: string | null;
  periodEnd: string | null;
  checkedAt: Date;
};

export type AhrefsResult = {
  status: ExternalDataStatus;
  domainRating: number | null;
  checkedAt: Date;
};

export type WaybackResult = {
  status: ExternalDataStatus;
  firstCaptureAt: Date | null;
  latestCaptureAt: Date | null;
  firstCaptureUrl: string | null;
  latestCaptureUrl: string | null;
  checkedAt: Date;
};

export type DomainIntelligence = {
  tranco: TrancoResult;
  crux: CruxResult;
  ahrefs: AhrefsResult;
  wayback: WaybackResult;
};

export type DomainReport = {
  reportVersion: string;
  domain: string;
  registrableDomain: string;
  isSubdomain: boolean;
  isIdn: boolean;
  checkedAt: Date;
  rdap: RdapResult;
  dns: DnsResult;
  intelligence: DomainIntelligence;
  ageYears: number | null;
  daysToExpiry: number | null;
  dataCoverage: number;
  evidenceItems: EvidenceItem[];
  structure: StructureFacts;
  summary: string;
  alerts: string[];
  observations: string[];
};
