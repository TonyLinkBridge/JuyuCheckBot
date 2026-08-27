import { decodeDomainParam } from "../domain/normalize.js";
import { normalizeDomain } from "../domain/normalize.js";
import type { CommerceAction } from "./types.js";

export type CommerceStart = {
  action: Extract<CommerceAction, "buy" | "sell" | "register">;
  domain: string;
};

export function parseCommerceStartPayload(payload: string | undefined): CommerceStart | null {
  const match = /^(buy|sell|register)_([A-Za-z0-9-]+)$/.exec(payload ?? "");
  if (!match?.[1] || !match[2]) return null;
  try {
    return {
      action: match[1] as CommerceStart["action"],
      domain: normalizeDomain(decodeDomainParam(match[2])).ascii,
    };
  } catch {
    return null;
  }
}
