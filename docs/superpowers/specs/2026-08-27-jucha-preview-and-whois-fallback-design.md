# JUYU Preview and Public WHOIS Fallback Design

## Goal

Keep `@JuyuCheckBot` useful as a free community tool while making 聚查 the clear destination for complete domain research. Improve registration-data coverage with public RDAP and WHOIS resources without connecting the paid 聚查 API or copying the full next-whois product.

## Product flow

1. A user submits a domain and receives a useful public preview before any gate.
2. The preview shows only facts the Bot actually obtained: registration status, age, expiry, DNS, one public signal, alerts, source, and retrieval time.
3. The user selects owner, buyer, or research intent.
4. Channel membership unlocks a short decision summary.
5. The summary separates `本次已确认` from `聚查可继续查询`.
6. 聚查 is the primary CTA for every intent. Owner and buyer flows retain JUYU Commerce Bot as a secondary service CTA.
7. The tracked `/go/jucha` route preserves the domain, report token, intent, and UTM attribution.

## Truthful locking rules

- `本次已确认` may contain only fields or public signals present in the current report.
- Modules not queried by the Bot must be labelled `聚查可继续查询`, never `已经找到`.
- Counts may be shown only when the underlying source returned a real count.
- Missing registration data is `暂时无法确认`; it is never treated as availability.
- The Bot does not expose registrant email, phone, raw WHOIS, or personal contact details.

## Free registration-data coverage

The registration pipeline remains RDAP-first:

1. IANA Bootstrap to authoritative registry RDAP.
2. `rdap.org` as a labelled transport fallback.
3. Generic WHOIS only when both RDAP paths fail.
4. Explicit private-registry adapters such as `eu.cc` remain in place.
5. Unsupported private suffixes remain unknown instead of being queried as registry domains.

The generic WHOIS adapter is inspired by the MIT-licensed next-whois architecture but is implemented as a small JUYU-owned adapter. It parses only registration facts: domain, registrar, creation/update/expiry dates, nameservers, EPP statuses, and DNSSEC. It does not retain raw WHOIS or registrant personal data.

WHOIS responses count as `available` only when the registry explicitly returns a recognised not-found response. Ambiguous or malformed responses fail closed and eventually become `unknown`.

## Asia and Chinese-market fit

The Bot is a Chinese-first registration-fact tool, not a Western SEO dashboard. Keep globally applicable registry standards and technical facts: RDAP, WHOIS, DNS, DNSSEC, age, expiry, EPP status, IDN handling, and objective name structure. Remove Tranco, Chrome UX Report, Ahrefs, and Internet Archive from the active Bot query and all user-facing messages because their coverage and terminology are not a reliable primary signal for the target market and they add latency.

Use Simplified Chinese first, replace English-only headings with Chinese product language, and describe `Nameserver` as `域名服务器（NS）` where it appears. China-market modules that the Bot does not query—ICP filing, China trademark checks, domestic platform risk, website history, SEO/traffic, and price history—belong under `聚查可继续查询`, without availability claims or invented counts.

## Status alerts

Public EPP statuses are translated only when they affect a decision. Hold states produce a suspension alert; redemption or pending-delete states produce a lifecycle alert. Ordinary transfer locks are not presented as risks.

## Scope exclusions

- No 聚查 API integration.
- No 大佬论坛 integration or scraping.
- No marketplace, pricing, account, PWA, or UI code from next-whois.
- No new JUYU score or estimated valuation.
- No public raw WHOIS or registrant contact data.
- No Tranco, Chrome UX Report, Ahrefs, or Internet Archive query in the active Bot flow.

## Analytics

Keep the existing events and tracked handoff: `domain_submitted`, `preview_shown`, `intent_selected`, `gate_shown`, unlock events, `jucha_handoff`, and commerce handoff/lead events. The dashboard should continue measuring the funnel without a schema migration in this phase.

## Acceptance criteria

- Preview visibly states source and retrieval time.
- Unlocked summary clearly separates confirmed facts from 聚查-only modules.
- 聚查 is the first CTA for research, buyer, and owner intent.
- Buyer/owner JUYU service buttons remain available as secondary CTAs.
- RDAP failure can be recovered by a parsed generic WHOIS result.
- Explicit WHOIS not-found may report available; ambiguous results may not.
- Hold/delete EPP states create plain-language alerts.
- Existing tests, typecheck, and production build pass.
