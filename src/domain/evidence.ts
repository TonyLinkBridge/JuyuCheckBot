import type { DnsResult, DomainReport, EvidenceItem, RdapResult, StructureFacts } from "./types.js";

export const REPORT_VERSION = "JUYU-EVIDENCE-3.0";

type EvidenceInput = {
  domain: string;
  registrableDomain: string;
  isIdn: boolean;
  rdap: RdapResult;
  dns: DnsResult;
  now?: Date;
};

type EvidenceFields = Pick<
  DomainReport,
  "reportVersion" | "ageYears" | "daysToExpiry" | "dataCoverage" | "evidenceItems" | "structure" | "summary" | "alerts" | "observations"
>;

export function buildEvidence(input: EvidenceInput): EvidenceFields {
  const now = input.now ?? new Date();
  const ageYears = input.rdap.createdAt
    ? Math.max(0, (now.getTime() - input.rdap.createdAt.getTime()) / 31_557_600_000)
    : null;
  const daysToExpiry = input.rdap.expiresAt
    ? Math.ceil((input.rdap.expiresAt.getTime() - now.getTime()) / 86_400_000)
    : null;
  const labels = input.registrableDomain.split(".");
  const name = labels[0] ?? input.registrableDomain;
  const suffix = labels.slice(1).join(".");
  const hyphenCount = (name.match(/-/g) ?? []).length;
  const digitCount = (name.match(/\d/g) ?? []).length;
  const structure: StructureFacts = {
    nameLength: name.length,
    suffix,
    hyphenCount,
    digitCount,
    characterType: input.isIdn ? "idn" : /^[a-z]+$/i.test(name) ? "ascii-letters" : "ascii-mixed",
  };
  const evidenceItems = evidenceChecklist(input.rdap, input.dns);
  const availableEvidence = evidenceItems.filter((item) => item.available).length;
  const dataCoverage = Math.round((availableEvidence / evidenceItems.length) * 100);
  const alerts = buildAlerts(input, ageYears, daysToExpiry);
  const observations = [
    `主体长度：${name.length} 个字符`,
    `连字符：${hyphenCount ? `${hyphenCount} 个` : "无"}`,
    `数字：${digitCount ? `${digitCount} 个` : "无"}`,
    `字符类型：${structure.characterType === "idn" ? "国际化字符（IDN）" : structure.characterType === "ascii-letters" ? "英文字母" : "ASCII 混合字符"}`,
    `后缀：.${suffix}`,
  ];

  return {
    reportVersion: REPORT_VERSION,
    ageYears,
    daysToExpiry,
    dataCoverage,
    evidenceItems,
    structure,
    summary: buildSummary(input.rdap, input.dns, alerts),
    alerts,
    observations,
  };
}

function evidenceChecklist(rdap: RdapResult, dns: DnsResult): EvidenceItem[] {
  return [
    { key: "registration", label: "注册状态", available: rdap.status !== "unknown" },
    { key: "registrar", label: "注册商", available: Boolean(rdap.registrar) },
    { key: "created", label: "注册日期", available: Boolean(rdap.createdAt) },
    { key: "expiry", label: "到期日期", available: Boolean(rdap.expiresAt) },
    { key: "nameservers", label: "Nameserver", available: rdap.status !== "unknown" || dns.checked },
    { key: "dns", label: "DNS", available: dns.checked },
    { key: "dnssec", label: "DNSSEC", available: rdap.dnssec !== null },
  ];
}

function buildAlerts(input: EvidenceInput, ageYears: number | null, daysToExpiry: number | null): string[] {
  const alerts: string[] = [];
  if (input.rdap.status === "unknown") alerts.push("注册状态暂时无法从可用资料源确认");
  if (ageYears !== null && ageYears < 0.25) alerts.push("注册时间不足 3 个月");
  if (daysToExpiry !== null) {
    if (daysToExpiry < 0) alerts.push("资料源显示的到期日已过，状态可能正在变化");
    else if (daysToExpiry <= 30) alerts.push("距离到期不足 30 天");
    else if (daysToExpiry <= 90) alerts.push("距离到期不足 90 天");
  }
  if (input.dns.checked && !input.dns.resolves && input.rdap.status === "registered") {
    alerts.push("已确认注册，但未发现有效 DNS 解析");
  }
  if (input.isIdn) alerts.push("包含国际化字符，需核对字符混淆与钓鱼风险");
  return alerts;
}

function buildSummary(rdap: RdapResult, dns: DnsResult, alerts: string[]): string {
  if (rdap.status === "unknown") {
    return dns.resolves
      ? "DNS 正常，但当前资料源无法确认注册记录；不能据此判断可注册。"
      : "当前资料源无法确认注册记录，建议到对应注册服务复核。";
  }
  if (rdap.status === "available") {
    return "注册资料源未发现记录；实际注册前仍应在注册商处复核实时状态。";
  }
  if (alerts.length) return `已确认注册资料；本次基础检查发现 ${alerts.length} 项提醒。`;
  return dns.checked
    ? "已确认注册资料与 DNS；本次基础检查未发现明显警报。"
    : "已确认注册资料；DNS 本次暂未取得结果。";
}
