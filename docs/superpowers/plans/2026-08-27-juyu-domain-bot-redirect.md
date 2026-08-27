# JUYU Domain Bot Redirect Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve old `@JuyuDomainBot` links while directing all new users and commercial actions to `@JuyuCheckBot` with their action and domain intact.

**Architecture:** Replace old menu and Lead starts with a small redirect layer in the legacy JavaScript repository. Leave its Supabase tables and historical Leads unchanged and stop creating new sessions or Leads after deployment.

**Tech Stack:** Node.js, Telegram Bot API, Node test runner, Vercel

**Spec:** `docs/superpowers/specs/2026-08-27-unified-juyu-bot.md`

## Global Constraints

- Do not delete or migrate the legacy Supabase data.
- Do not share the Check Bot token with the old deployment.
- Preserve `buy`, `sell`, and `register` action plus encoded domain.
- Old group, content, alert, and Lead creation behavior is not reachable after redirect mode is enabled.

---

### Task 1: Parameter-preserving redirect mode

**Files:**
- Modify: `src/bot.js`
- Create: `src/redirect.js`
- Create: `test/redirect.test.js`
- Modify: `config/content.json`

**Interfaces:**
- Produces `redirectStartPayload(payload, targetUsername)` and `redirectMessage(targetUrl)`.

- [ ] **Step 1: Write failing tests**

Assert action/domain preservation, source-only fallback, HTML-safe copy, and a single primary URL button.

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `node --test test/redirect.test.js`

- [ ] **Step 3: Implement redirect-only handlers**

Handle `/start`, `/menu`, `/buy`, `/sell`, `/contact`, and matching callbacks by showing the merged-service message. Do not call `createLeadFlows` in redirect mode.

- [ ] **Step 4: Run the legacy repository test suite**

Run: `npm test`

- [ ] **Step 5: Commit**

Commit message: `feat: redirect legacy bot to JuyuCheckBot`

### Task 2: Deployment documentation and verification

**Files:**
- Modify: `README.md`
- Modify: `.env.example`

**Interfaces:**
- Documents `PRIMARY_BOT_USERNAME=JuyuCheckBot` and deployment order.

- [ ] **Step 1: Update legacy deployment instructions**

State that the old Bot remains online only to preserve historic Telegram links and must be deployed after the new Bot accepts commerce deep links.

- [ ] **Step 2: Run fresh verification**

Run: `npm test && npm run check`

- [ ] **Step 3: Review and commit**

Run: `git diff --check && git status --short`; commit with `docs: explain legacy bot redirect`.
