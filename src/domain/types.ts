export type RegistrationStatus = "registered" | "available" | "unknown";

export type RdapResult = {
  status: RegistrationStatus;
  registrar: string | null;
  createdAt: Date | null;
  expiresAt: Date | null;
  updatedAt: Date | null;
  nameServers: string[];
  statuses: string[];
  dnssec: boolean | null;
};

export type DnsResult = {
  checked: boolean;
  resolves: boolean;
  ipv4: string[];
  ipv6: string[];
  nameServers: string[];
  mx: Array<{ exchange: string; priority: number }>;
};

export type RiskLevel = "low" | "medium" | "high" | "unknown";

export type DomainIntent = "owner" | "buyer" | "research";
export type ScoreGrade = "S" | "A" | "B" | "C" | "D";
export type ScoreConfidence = "low" | "medium";
export type ScoreDimensionKey =
  | "brandability"
  | "memorability"
  | "commercialPotential"
  | "extensionFit"
  | "globalReach"
  | "marketSignals";

export type ScoreDimension = {
  key: ScoreDimensionKey;
  label: string;
  score: number;
  weight: number;
  available: boolean;
  conclusion: string;
};

export type DomainReport = {
  domain: string;
  registrableDomain: string;
  isSubdomain: boolean;
  isIdn: boolean;
  checkedAt: Date;
  rdap: RdapResult;
  dns: DnsResult;
  ageYears: number | null;
  daysToExpiry: number | null;
  score: number;
  grade: ScoreGrade;
  scoreVersion: string;
  confidence: ScoreConfidence;
  dataCoverage: number;
  dimensions: Record<ScoreDimensionKey, ScoreDimension>;
  verdict: string;
  riskLevel: RiskLevel;
  riskFlags: string[];
  strengths: string[];
  structureNotes: string[];
};
