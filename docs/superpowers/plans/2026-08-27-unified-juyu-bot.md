# JUYU Unified Bot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move buyer, seller, registration, and contact Lead collection into `@JuyuCheckBot` without losing old Commerce Bot Leads.

**Architecture:** Add a pure commerce state machine and Supabase persistence to the existing TypeScript Bot. Keep the Check Bot Supabase as the source of truth for new Leads, merge old Commerce Supabase rows in the Dashboard, and convert the old Bot into a parameter-preserving redirector in a separate plan.

**Tech Stack:** TypeScript, grammY, Vitest, Supabase REST, PostgreSQL, Next.js Dashboard

**Spec:** `docs/superpowers/specs/2026-08-27-unified-juyu-bot.md`

## Global Constraints

- `@JuyuCheckBot` is the only active user-facing Bot for new flows.
- New commercial data is written only to the Check Bot Supabase.
- Old Commerce Supabase stays read-only and remains visible in the Dashboard.
- Growth event metadata never stores contact text or full Lead answers.
- Registration Leads use `lead_type=buy` and `data.service=register`.
- Group tools, alerts, events, content publishing, roles, and usage quotas are outside this implementation.
- Production code follows test-first red-green-refactor cycles.

---

### Task 1: Commerce state machine

**Files:**
- Create: `src/commerce/types.ts`
- Create: `src/commerce/flow.ts`
- Test: `tests/commerce-flow.test.ts`

**Interfaces:**
- Produces: `startCommerceFlow(action, context)`, `advanceCommerceText(session, text)`, `advanceCommerceChoice(session, choice)`.
- Produces: `CommerceSession`, `CommerceTransition`, `CommerceAction`, `CommerceChoice`.

- [ ] **Step 1: Write failing state-machine tests**

Test domain-prefilled buy, register, sell, contact, invalid choices, seller “待报价”, and completed Lead payloads.

- [ ] **Step 2: Run the focused test and confirm missing-module failure**

Run: `npx vitest run tests/commerce-flow.test.ts`

- [ ] **Step 3: Implement minimal pure transitions**

Use immutable session objects. Text limits: price 100, contact 500, message 1500. Budget choices are `under_5k`, `5k_20k`, `20k_100k`, `100k_500k`, `over_500k`, `unsure` with Chinese labels.

- [ ] **Step 4: Run focused and full tests**

Run: `npx vitest run tests/commerce-flow.test.ts && npm test`

- [ ] **Step 5: Commit**

Commit message: `feat: add unified commerce state machine`

### Task 2: Commerce messages and keyboards

**Files:**
- Create: `src/commerce/messages.ts`
- Test: `tests/commerce-messages.test.ts`
- Modify: `src/messages.ts`
- Modify: `tests/messages.test.ts`

**Interfaces:**
- Consumes: transition prompt keys from Task 1.
- Produces: `commercePrompt(transition)`, `commerceKeyboard(prompt)`, `commerceResumeText(session)`, `commerceResumeKeyboard(session)`.

- [ ] **Step 1: Write failing message tests**

Assert Chinese-first budgets, Telegram/微信/WhatsApp/Email contact order, “待报价 / 面议” seller button, cancel button, and same-Bot callback data.

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `npx vitest run tests/commerce-messages.test.ts tests/messages.test.ts`

- [ ] **Step 3: Implement message rendering and replace Commerce Bot copy**

Remove `commerceLink` from new report actions. Keep Jucha as the first URL button and use `lead:owner:*` / `lead:buyer:*` callbacks for same-Bot flows.

- [ ] **Step 4: Run focused and full tests**

Run: `npx vitest run tests/commerce-messages.test.ts tests/messages.test.ts && npm test`

- [ ] **Step 5: Commit**

Commit message: `feat: add JUYU commerce flow messages`

### Task 3: Supabase sessions and Leads

**Files:**
- Modify: `supabase/schema.sql`
- Modify: `src/backend.ts`
- Modify: `tests/backend.test.ts`

**Interfaces:**
- Consumes: `CommerceSession` and completed Lead data from Task 1.
- Produces Backend methods `saveCommerceSession`, `getCommerceSession`, `clearCommerceSession`, `createLead`.
- Produces `CreatedLead` with numeric `id`.

- [ ] **Step 1: Write failing Backend REST tests**

Assert session upsert/read/delete, Lead insert with `Prefer: return=representation`, returned ID parsing, and user deletion including sessions/Leads.

- [ ] **Step 2: Run focused test and confirm interface failure**

Run: `npx vitest run tests/backend.test.ts`

- [ ] **Step 3: Implement memory and Supabase persistence**

Use `bot_sessions?on_conflict=telegram_user_id` and `leads`. Do not expose these tables to public roles.

- [ ] **Step 4: Run focused and full tests**

Run: `npx vitest run tests/backend.test.ts && npm test`

- [ ] **Step 5: Commit**

Commit message: `feat: persist unified bot leads`

### Task 4: Wire commerce flows into grammY

**Files:**
- Modify: `src/bot.ts`
- Modify: `src/config.ts`
- Modify: `.env.example`
- Create: `tests/commerce-start.test.ts`
- Modify: `tests/attribution.test.ts`

**Interfaces:**
- Consumes: state machine, messages, and Backend methods.
- Produces: `/buy`, `/sell`, `/contact`, `/cancel`, `/notifytest`, deep-link start actions, same-Bot callback handling.

- [ ] **Step 1: Write failing deep-link and source tests**

Assert `buy_example-com`, `sell_asset--name-com`, and `register_newbrand-com` decode correctly and attribute source to `juyu_domain_bot` when redirected.

- [ ] **Step 2: Run tests and confirm failure**

Run: `npx vitest run tests/commerce-start.test.ts tests/attribution.test.ts`

- [ ] **Step 3: Implement Bot wiring**

Before normal `/start` welcome, detect commerce deep links and start the flow. Before `runCheck`, route private text through an active session. Track only event names, step names, action, domain, report token, and Lead ID.

- [ ] **Step 4: Implement admin notification**

Add optional `ADMIN_CHAT_ID`. Save Lead first, then notify. Add admin-only `/notifytest`. Track `lead_notification_failed` after a failed Telegram send.

- [ ] **Step 5: Run focused and full verification**

Run: `npx vitest run tests/commerce-start.test.ts tests/attribution.test.ts && npm test && npm run typecheck && npm run build`

- [ ] **Step 6: Commit**

Commit message: `feat: merge commerce flows into check bot`

### Task 5: Dashboard new and legacy Lead compatibility

**Files:**
- Modify: `dashboard/lib/dashboard-data.ts`
- Modify: `dashboard/lib/follow-up.ts`
- Modify: `tests/follow-up.test.ts`
- Modify: `dashboard/.env.example`

**Interfaces:**
- Consumes: Check Bot `leads` rows and optional legacy Commerce `leads` rows.
- Produces: one normalized Lead list with `databaseSource: check | legacy` and a stable composite key.

- [ ] **Step 1: Write failing normalization and follow-up tests**

Assert new `lead_submitted` resolves an unfinished commercial blocker and that same numeric IDs from separate databases remain distinct.

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `npx vitest run tests/follow-up.test.ts`

- [ ] **Step 3: Read new Leads and merge optional legacy rows**

Always query `leads` from the primary Supabase. If the table is not migrated yet, return a clear migration status without breaking the rest of the Dashboard. Continue optional legacy reads from `COMMERCE_SUPABASE_*`.

- [ ] **Step 4: Run Dashboard verification**

Run: `npm test && npm run dashboard:typecheck && npm run dashboard:build`

- [ ] **Step 5: Commit**

Commit message: `feat: show unified and legacy leads in dashboard`

### Task 6: Documentation and release verification

**Files:**
- Modify: `README.md`
- Modify: `.env.example`
- Modify: `docs/privacy.md`

**Interfaces:**
- Documents the SQL, environment variables, Vercel redeploy order, and old Bot transition.

- [ ] **Step 1: Update deployment instructions**

Document running `supabase/schema.sql`, setting `ADMIN_CHAT_ID`, redeploying Check Bot, testing `/notifytest`, and then deploying the legacy redirect.

- [ ] **Step 2: Update privacy and deletion behavior**

Explain that contact details submitted as a Lead are stored for follow-up and deleted by the unified Bot deletion flow.

- [ ] **Step 3: Run fresh full verification**

Run: `npm test && npm run typecheck && npm run build && npm run dashboard:typecheck && npm run dashboard:build`

- [ ] **Step 4: Review diff for secrets and scope**

Run: `git diff --check && git status --short && git diff --stat`

- [ ] **Step 5: Commit**

Commit message: `docs: document unified JUYU bot deployment`
