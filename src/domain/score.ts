import type {
  DnsResult,
  DomainReport,
  RdapResult,
  RiskLevel,
  ScoreConfidence,
  ScoreDimension,
  ScoreDimensionKey,
  ScoreGrade,
} from "./types.js";

export const SCORE_VERSION = "JUYU-1.1";

type ScoreInput = {
  domain: string;
  registrableDomain: string;
  isIdn: boolean;
  rdap: RdapResult;
  dns: DnsResult;
  now?: Date;
};

type ScoredFields = Pick<
  DomainReport,
  | "score"
  | "grade"
  | "scoreVersion"
  | "confidence"
  | "dataCoverage"
  | "dimensions"
  | "verdict"
  | "riskLevel"
  | "riskFlags"
  | "strengths"
  | "structureNotes"
  | "ageYears"
  | "daysToExpiry"
>;

const weights: Record<ScoreDimensionKey, number> = {
  brandability: 0.25,
  memorability: 0.2,
  commercialPotential: 0.2,
  extensionFit: 0.15,
  globalReach: 0.1,
  marketSignals: 0.1,
};

export function scoreDomain(input: ScoreInput): ScoredFields {
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
  const hyphens = (name.match(/-/g) ?? []).length;
  const digits = (name.match(/\d/g) ?? []).length;
  const language = analyzeName(name);

  const riskFlags: string[] = [];
  const strengths: string[] = [];
  const structureNotes: string[] = [];

  if (ageYears !== null) {
    if (ageYears >= 10) strengths.push("注册历史超过 10 年");
    else if (ageYears >= 5) strengths.push("注册历史超过 5 年");
    else if (ageYears < 0.25) riskFlags.push("注册时间不足 3 个月，需加强尽调");
  }
  if (daysToExpiry !== null) {
    if (daysToExpiry < 0) riskFlags.push("登记的到期日已过，状态可能正在变化");
    else if (daysToExpiry <= 30) riskFlags.push("距离到期不足 30 天");
    else if (daysToExpiry <= 90) riskFlags.push("距离到期不足 90 天");
    else if (daysToExpiry >= 365) strengths.push("注册有效期超过 1 年");
  }
  if (input.dns.resolves) strengths.push("DNS 解析正常");
  else if (input.rdap.status === "registered") riskFlags.push("已注册但未发现有效 DNS 解析");
  if (input.rdap.dnssec === true) strengths.push("已启用 DNSSEC");
  if (input.isIdn) riskFlags.push("国际化域名需核对字符混淆与钓鱼风险");

  if (name.length <= 6) structureNotes.push("主体较短，便于记忆与输入");
  else if (name.length <= 12) structureNotes.push("主体长度适中");
  else if (name.length > 20) structureNotes.push("主体偏长，传播与输入成本较高");
  if (hyphens >= 2) structureNotes.push("包含多个连字符，口述传播较困难");
  else if (hyphens === 1) structureNotes.push("包含连字符，需留意输入流失");
  if (digits >= 3) structureNotes.push("数字较多，品牌辨识度可能受影响");
  if (language.pronounceable) strengths.push("字母结构具备较好的发音线索");
  else if (language.isAlphabetic && name.length >= 4) structureNotes.push("字母组合发音线索较弱，需测试口述传播");
  if (language.repeatedRun >= 3) structureNotes.push("存在连续重复字符，容易产生输入歧义");
  if (language.commercialKeyword) strengths.push(`包含通用商业语义：${language.commercialKeyword}`);
  if (suffix === "com") strengths.push(".com 具备较强的全球认知度");
  if (input.rdap.status === "available") structureNotes.push("RDAP 未发现注册记录，可能尚未注册");

  const riskLevel = determineRisk(input.rdap, riskFlags);
  if (riskFlags.length === 0) riskFlags.push("未发现明显基础风险");
  if (structureNotes.length === 0) structureNotes.push("域名结构常规");

  const dimensions = buildDimensions({
    name,
    suffix,
    hyphens,
    digits,
    isIdn: input.isIdn,
    rdap: input.rdap,
    dns: input.dns,
    ageYears,
    language,
  });
  const weighted = Object.values(dimensions).reduce(
    (total, dimension) => total + dimension.score * dimension.weight,
    0,
  );
  const riskPenalty = riskLevel === "high" ? 20 : riskLevel === "medium" ? 10 : riskLevel === "unknown" ? 6 : 0;
  const score = clamp(Math.round(weighted - riskPenalty));
  const grade = gradeFor(score);
  const dataCoverage = calculateCoverage(input.rdap, input.dns);
  const confidence: ScoreConfidence =
    input.rdap.status === "unknown" || dataCoverage < 45 ? "low" : "medium";

  return {
    score,
    grade,
    scoreVersion: SCORE_VERSION,
    confidence,
    dataCoverage,
    dimensions,
    verdict: buildVerdict(score, riskLevel),
    riskLevel,
    riskFlags,
    strengths: unique(strengths),
    structureNotes: unique(structureNotes),
    ageYears,
    daysToExpiry,
  };
}

type DimensionInput = {
  name: string;
  suffix: string;
  hyphens: number;
  digits: number;
  isIdn: boolean;
  rdap: RdapResult;
  dns: DnsResult;
  ageYears: number | null;
  language: NameSignals;
};

function buildDimensions(input: DimensionInput): Record<ScoreDimensionKey, ScoreDimension> {
  let brandability = 45;
  if (input.name.length <= 6) brandability += 25;
  else if (input.name.length <= 12) brandability += 15;
  else if (input.name.length > 20) brandability -= 15;
  brandability += input.hyphens === 0 ? 10 : input.hyphens >= 2 ? -20 : -8;
  brandability += input.digits === 0 ? 5 : input.digits >= 3 ? -12 : -4;
  if (input.suffix === "com") brandability += 5;
  if (input.language.pronounceable) brandability += 12;
  else if (input.language.isAlphabetic && input.name.length >= 4) brandability -= 14;
  if (input.language.repeatedRun >= 3) brandability -= 10;
  if (input.language.commercialKeyword) brandability += 6;

  let memorability = 50;
  if (input.name.length <= 6) memorability += 25;
  else if (input.name.length <= 12) memorability += 12;
  else if (input.name.length > 20) memorability -= 18;
  memorability += input.hyphens === 0 ? 12 : input.hyphens >= 2 ? -18 : -8;
  memorability += input.digits === 0 ? 8 : input.digits >= 3 ? -12 : -4;
  if (input.language.pronounceable) memorability += 10;
  else if (input.language.isAlphabetic && input.name.length >= 4) memorability -= 18;
  if (input.language.repeatedRun >= 3) memorability -= 12;

  let commercialPotential = 45;
  commercialPotential += input.suffix === "com" ? 20 : input.suffix === "ai" ? 15 : input.suffix === "io" ? 10 : 0;
  if (input.name.length <= 12) commercialPotential += 5;
  if (input.language.pronounceable) commercialPotential += 5;
  else if (input.language.isAlphabetic && input.name.length >= 4) commercialPotential -= 5;
  if (input.language.commercialKeyword) commercialPotential += 8;
  if (input.hyphens > 0) commercialPotential -= 10;
  if (input.digits >= 3) commercialPotential -= 8;

  const extensionFit = extensionScore(input.suffix);

  let globalReach = 55;
  globalReach += input.isIdn ? -15 : 10;
  if (input.suffix === "com") globalReach += 25;
  else if (["net", "org"].includes(input.suffix)) globalReach += 15;
  else if (["ai", "io"].includes(input.suffix)) globalReach += 12;
  if (input.name.length <= 12) globalReach += 5;
  if (input.hyphens > 0) globalReach -= 8;
  if (input.digits >= 3) globalReach -= 6;

  let marketSignals = 35;
  if (input.ageYears !== null) {
    if (input.ageYears >= 10) marketSignals += 30;
    else if (input.ageYears >= 5) marketSignals += 20;
    else if (input.ageYears >= 2) marketSignals += 10;
    else if (input.ageYears < 0.25) marketSignals -= 8;
  }
  if (input.rdap.status === "registered") marketSignals += 5;
  if (input.dns.resolves) marketSignals += 15;
  if (input.dns.mx.length > 0) marketSignals += 5;
  if (input.rdap.dnssec === true) marketSignals += 5;

  return {
    brandability: dimension(
      "brandability",
      "品牌力",
      brandability,
      input.language.pronounceable
        ? `主体 ${input.name.length} 字符；具备较好的发音线索`
        : `主体 ${input.name.length} 字符；需进一步验证语言与发音`,
    ),
    memorability: dimension(
      "memorability",
      "记忆度",
      memorability,
      input.name.length <= 12 && input.hyphens === 0 && input.language.pronounceable
        ? "长度、输入与发音结构较友好"
        : "输入或发音结构存在一定记忆成本",
    ),
    commercialPotential: dimension(
      "commercialPotential",
      "商业潜力",
      commercialPotential,
      "基于结构与后缀通用性，暂未包含成交案例",
    ),
    extensionFit: dimension(
      "extensionFit",
      "后缀匹配",
      extensionFit,
      `.${input.suffix} 的通用认知与品牌适配规则`,
    ),
    globalReach: dimension(
      "globalReach",
      "全球化能力",
      globalReach,
      input.isIdn ? "国际化字符更依赖特定语言市场" : "ASCII 结构便于跨市场输入",
    ),
    marketSignals: dimension(
      "marketSignals",
      "活跃度信号",
      marketSignals,
      "仅基于域龄与 DNS 活跃度，不代表市场需求或成交表现",
    ),
  };
}

function dimension(
  key: ScoreDimensionKey,
  label: string,
  score: number,
  conclusion: string,
): ScoreDimension {
  return { key, label, score: clamp(Math.round(score)), weight: weights[key], conclusion };
}

function extensionScore(suffix: string): number {
  if (suffix === "com") return 100;
  if (suffix === "ai") return 90;
  if (suffix === "io") return 85;
  if (suffix === "org") return 82;
  if (suffix === "net") return 78;
  if (["co", "app", "dev"].includes(suffix)) return 76;
  if (suffix.includes(".")) return 70;
  return 65;
}

function determineRisk(rdap: RdapResult, flags: string[]): RiskLevel {
  if (rdap.status === "unknown") return "unknown";
  if (flags.some((flag) => flag.includes("到期日已过") || flag.includes("不足 30 天"))) return "high";
  if (flags.length >= 2) return "medium";
  return "low";
}

function calculateCoverage(rdap: RdapResult, dns: DnsResult): number {
  let coverage = rdap.status !== "unknown" ? 20 : 0;
  if (rdap.registrar) coverage += 15;
  if (rdap.createdAt) coverage += 20;
  if (rdap.expiresAt) coverage += 15;
  if (dns.resolves) coverage += 15;
  if (rdap.dnssec !== null) coverage += 10;
  if (rdap.nameServers.length || dns.nameServers.length) coverage += 5;
  return clamp(coverage);
}

function gradeFor(score: number): ScoreGrade {
  if (score >= 90) return "S";
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  return "D";
}

function buildVerdict(score: number, risk: RiskLevel): string {
  if (risk === "high") return "基础信号存在明确风险，建议先完成状态与历史尽调。";
  if (score >= 90) return "结构、发音与基础活跃度突出，具备进一步品牌评估价值。";
  if (score >= 80) return "整体结构清晰，品牌与商业延展条件较好。";
  if (score >= 70) return "具备可用基础，但仍需结合行业语义与价格判断。";
  if (score >= 60) return "基础条件一般，建议重点核对命名成本与应用场景。";
  return "结构或基础信号偏弱，投入前建议进行更严格比较。";
}

type NameSignals = {
  isAlphabetic: boolean;
  pronounceable: boolean;
  repeatedRun: number;
  commercialKeyword: string | null;
};

const commercialKeywords = [
  "ai",
  "app",
  "bank",
  "brand",
  "car",
  "cloud",
  "crypto",
  "data",
  "finance",
  "health",
  "home",
  "pay",
  "shop",
  "tech",
  "travel",
];

function analyzeName(name: string): NameSignals {
  const normalized = name.toLowerCase();
  const isAlphabetic = /^[a-z]+$/.test(normalized);
  const repeatedRun = longestRun(normalized, (character, previous) => character === previous);
  if (!isAlphabetic) {
    return { isAlphabetic, pronounceable: false, repeatedRun, commercialKeyword: findKeyword(normalized) };
  }

  const vowelCount = (normalized.match(/[aeiouy]/g) ?? []).length;
  const vowelRatio = vowelCount / Math.max(1, normalized.length);
  const consonantRun = longestRun(normalized, (character) => !/[aeiouy]/.test(character));
  const pronounceable =
    normalized.length <= 3 ||
    (vowelCount > 0 && vowelRatio >= 0.2 && vowelRatio <= 0.7 && consonantRun <= 3 && repeatedRun < 3);
  return {
    isAlphabetic,
    pronounceable,
    repeatedRun,
    commercialKeyword: findKeyword(normalized),
  };
}

function longestRun(value: string, matches: (character: string, previous: string) => boolean): number {
  let longest = value.length ? 1 : 0;
  let current = longest;
  for (let index = 1; index < value.length; index += 1) {
    const character = value[index] ?? "";
    const previous = value[index - 1] ?? "";
    current = matches(character, previous) ? current + 1 : 1;
    longest = Math.max(longest, current);
  }
  return longest;
}

function findKeyword(name: string): string | null {
  return commercialKeywords.find((keyword) => name === keyword || name.startsWith(keyword) || name.endsWith(keyword)) ?? null;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
