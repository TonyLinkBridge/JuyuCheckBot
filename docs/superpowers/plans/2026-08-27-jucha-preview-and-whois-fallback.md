# Jucha Preview and WHOIS Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Bot into a truthful public-data preview that sends complete research to 聚查, while adding a safe generic WHOIS fallback for RDAP failures.

**Architecture:** Keep the existing Telegram and report pipeline. Update message composition and CTA ordering without changing the Supabase schema, then add an isolated WHOIS adapter behind the existing RDAP-first registration interface. WHOIS returns only non-personal registration facts and fails closed on ambiguous data.

**Tech Stack:** TypeScript, grammY, Express, Vitest, `whoiser`, Vercel Node.js 22

**Spec:** `docs/superpowers/specs/2026-08-27-jucha-preview-and-whois-fallback-design.md`

## Global Constraints

- No 聚查 API integration.
- No 大佬论坛 integration or scraping.
- Do not claim locked data was found unless a source actually returned it.
- Do not expose or retain registrant email, phone, or raw WHOIS.
- Keep RDAP authoritative and first in the source order.
- Do not create scores, valuations, or unverified market counts.
- Do not query or display Tranco, Chrome UX Report, Ahrefs, or Internet Archive in the active Bot flow.

---

### Task 1: Truthful preview and 聚查-first conversion

**Files:**
- Modify: `tests/messages.test.ts`
- Modify: `src/messages.ts`

**Interfaces:**
- Consumes: `DomainReport`, `DomainIntent`, `juchaHandoffLink(...)`
- Produces: updated `previewReportText(...)`, `fullReportText(...)`, and `fullReportKeyboard(...)`

- [ ] **Step 1: Write failing message tests**

Add expectations that preview text contains `资料来源` and `取得时间`; unlocked text contains `本次已确认` and `聚查可继续查询` but not `完整资料已找到`; and the first keyboard button for all three intents is a 聚查 URL. Assert owner and buyer still contain their respective `lead:*` callbacks.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npx vitest run tests/messages.test.ts`

Expected: assertions fail because source/time, truthful catalogue, and 聚查-first ordering do not yet exist.

- [ ] **Step 3: Implement the message hierarchy**

Add small formatting helpers in `src/messages.ts` that derive confirmed labels only from registration and DNS evidence present in `report.evidenceItems`. Change locked copy to `聚查可继续查询`. Reorder all full-report keyboards so 聚查 is first and JUYU Commerce Bot is secondary for owner/buyer intent.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npx vitest run tests/messages.test.ts`

Expected: all message tests pass.

### Task 2: Chinese-first core and removal of Western web metrics

**Files:**
- Modify: `tests/messages.test.ts`
- Create: `tests/check.test.ts`
- Modify: `src/messages.ts`
- Modify: `src/domain/check.ts`
- Modify: `src/bot.ts`
- Modify: `src/config.ts`
- Modify: `src/index.ts`
- Modify: `.env.example`

**Interfaces:**
- Changes: `checkDomain(input, { timeoutMs })` no longer invokes third-party web-intelligence fetches
- Preserves: `DomainReport.intelligence` as an empty compatibility shape so existing persisted reports remain readable

- [ ] **Step 1: Write failing Chinese-market tests**

Assert preview/full/share messages do not contain `Tranco`, `CrUX`, `Ahrefs`, `Internet Archive`, or English-only `JUYU DOMAIN CHECK`; assert the locked catalogue contains `ICP 备案`, `中国商标`, and `国内平台风险`. Add a check-domain test whose fetch boundary rejects any request to the four removed providers.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npx vitest run tests/messages.test.ts tests/check.test.ts`

Expected: current messages contain Western metrics and the active check still calls their endpoints.

- [ ] **Step 3: Remove the active metric path**

Stop invoking `checkDomainIntelligence`, supply `emptyIntelligence` for backward-compatible report storage, remove the two metric API keys from the Bot configuration and example environment, and remove metric health flags. Rewrite message decisions to use registration, DNS, expiry, EPP, and objective evidence only.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `npx vitest run tests/messages.test.ts tests/check.test.ts`

Expected: messages are Chinese-first and no removed provider is requested.

### Task 3: Generic WHOIS fallback

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/domain/whois.ts`
- Modify: `src/domain/rdap.ts`
- Modify: `src/domain/types.ts`
- Create: `tests/whois.test.ts`
- Modify: `tests/rdap.test.ts`

**Interfaces:**
- Produces: `checkWhoisRegistration(domain: string, timeoutMs: number): Promise<RdapResult>`
- Changes: `RegistrationSourceType` adds `whois`
- Consumes: `whoiser.whoisDomain`, returning server-keyed structured/raw WHOIS data

- [ ] **Step 1: Install the audited WHOIS dependency**

Run: `npm install whoiser@2.0.0-beta.10`

Expected: dependency and lockfile update without importing next-whois UI or account code.

- [ ] **Step 2: Write failing adapter tests**

Create fixtures covering a registered domain, an explicit `No match` response, and an ambiguous response. Assert that registered output contains registrar/dates/nameservers and source type `whois`; explicit not-found returns `available`; ambiguous output rejects.

- [ ] **Step 3: Run the adapter test and verify RED**

Run: `npx vitest run tests/whois.test.ts`

Expected: module or exported function is missing.

- [ ] **Step 4: Implement the minimal non-personal adapter**

Implement WHOIS result flattening, conservative not-found detection, common registration-field parsing, date validation, DNSSEC parsing, source labelling, and timeout forwarding. Ignore registrant/contact fields and do not return raw text.

- [ ] **Step 5: Run adapter tests and verify GREEN**

Run: `npx vitest run tests/whois.test.ts`

Expected: all WHOIS adapter tests pass.

- [ ] **Step 6: Write a failing RDAP fallback integration test**

Mock IANA, `rdap.org`, and WHOIS boundaries so both RDAP requests fail and WHOIS succeeds. Assert `checkRegistrationWithRetry(...)` returns the WHOIS source and confirmed registration facts.

- [ ] **Step 7: Run RDAP tests and verify RED**

Run: `npx vitest run tests/rdap.test.ts`

Expected: the registration flow throws or returns no WHOIS result.

- [ ] **Step 8: Connect fallback after RDAP failure**

In `checkRegistration(...)`, preserve private-suffix rules. For ordinary registry domains, try RDAP first and invoke `checkWhoisRegistration(...)` only when RDAP throws.

- [ ] **Step 9: Run WHOIS and RDAP tests and verify GREEN**

Run: `npx vitest run tests/whois.test.ts tests/rdap.test.ts`

Expected: all focused tests pass.

### Task 4: Decision-relevant EPP alerts

**Files:**
- Create: `src/domain/epp.ts`
- Modify: `src/domain/evidence.ts`
- Modify: `tests/evidence.test.ts`

**Interfaces:**
- Produces: `eppAlerts(statuses: string[]): string[]`
- Consumes: `RdapResult.statuses`

- [ ] **Step 1: Write failing evidence tests**

Assert `clientHold` produces a suspension alert, `pendingDelete` produces a deletion-process alert, and `clientTransferProhibited` produces neither.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npx vitest run tests/evidence.test.ts`

Expected: EPP-specific alerts are absent.

- [ ] **Step 3: Implement minimal EPP classification**

Normalize case, spaces, hyphens, and underscores. Translate only hold, redemption, and pending-delete states into decision-relevant Chinese alerts; deduplicate alerts.

- [ ] **Step 4: Run evidence tests and verify GREEN**

Run: `npx vitest run tests/evidence.test.ts`

Expected: all evidence tests pass.

### Task 5: Version, documentation, and complete verification

**Files:**
- Modify: `src/domain/evidence.ts`
- Modify: `README.md`
- Modify: `package.json`

**Interfaces:**
- Changes report version from `JUYU-EVIDENCE-3.1` to `JUYU-EVIDENCE-3.2`

- [ ] **Step 1: Update version-facing assertions and verify RED**

Update affected tests to expect `JUYU-EVIDENCE-3.2`, then run the suite before changing production version.

- [ ] **Step 2: Update production version and documentation**

Document 聚查-first truthful locking, Chinese-first positioning, removal of Western web metrics, generic WHOIS fallback, data-source labels, personal-data exclusion, and the unchanged exclusions for 聚查 API and 大佬论坛.

- [ ] **Step 3: Run full verification**

Run: `npm test && npm run typecheck && npm run build`

Expected: all tests pass, typecheck has no errors, and build exits 0.

- [ ] **Step 4: Inspect the final diff**

Run: `git diff --check && git status --short && git diff --stat`

Expected: no whitespace errors; only Phase 1 and Phase 2 files are changed.
