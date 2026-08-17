import { domainToASCII } from "node:url";
import { getDomain, parse } from "tldts";

export type NormalizedDomain = {
  ascii: string;
  display: string;
  registrableDomain: string;
  publicSuffix: string;
  isPrivateSuffix: boolean;
  subdomain: string | null;
  isIdn: boolean;
};

export class DomainInputError extends Error {}

export function normalizeDomain(raw: string): NormalizedDomain {
  const input = raw.trim();
  if (!input || input.length > 2048) {
    throw new DomainInputError("请输入一个有效域名，例如 example.com");
  }

  const withoutProtocol = input
    .replace(/^[a-z][a-z0-9+.-]*:\/\//i, "")
    .split(/[/?#\s]/, 1)[0]
    ?.replace(/:\d+$/, "")
    .replace(/^www\./i, "")
    .replace(/\.$/, "");

  if (!withoutProtocol || withoutProtocol.includes("@")) {
    throw new DomainInputError("看起来不像域名。请只发送 example.com 这样的域名。");
  }

  const ascii = domainToASCII(withoutProtocol).toLowerCase();
  if (!ascii || ascii.length > 253 || ascii.split(".").some((label) => !isValidLabel(label))) {
    throw new DomainInputError("域名格式不正确，请检查后重试。");
  }

  const registrableDomain = getDomain(ascii, { allowPrivateDomains: true });
  const parsed = parse(ascii, { allowPrivateDomains: true });
  if (!registrableDomain || !parsed.publicSuffix) {
    throw new DomainInputError("暂时无法识别这个域名后缀。");
  }

  return {
    ascii,
    display: withoutProtocol.toLowerCase(),
    registrableDomain,
    publicSuffix: parsed.publicSuffix,
    isPrivateSuffix: parsed.isPrivate === true,
    subdomain: parsed.subdomain || null,
    isIdn: ascii.includes("xn--"),
  };
}

function isValidLabel(label: string): boolean {
  return (
    label.length >= 1 &&
    label.length <= 63 &&
    /^[a-z0-9-]+$/i.test(label) &&
    !label.startsWith("-") &&
    !label.endsWith("-")
  );
}

export function encodeDomainParam(domain: string): string {
  return domain.replaceAll("-", "--").replaceAll(".", "-");
}

export function decodeDomainParam(value: string): string {
  const placeholder = "\u0000";
  return value.replaceAll("--", placeholder).replaceAll("-", ".").replaceAll(placeholder, "-");
}
