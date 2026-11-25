---
description: Fix documented MMS technical debt from migration-status
---

# Workflow: Fix Migration Debt

This workflow guides the structured resolution of technical debt items documented in the MMS project.

## Phase 1: Discovery & Context Gathering

- [ ] **Load core skills**: Load `mms-migration-fixes` along with the specific domain skill (e.g., `mms-backend-security`, `mms-frontend`, `mms-module-page`).
- [ ] **Read the debt registry**: Check `rules/mms-migration-status.md` and confirm the target item is currently in the "open gaps" section (and not "Recently Resolved").
- [ ] **Assess the blast radius**: Search the workspace using `grep_search` for occurrences of the debt pattern before modifying code to understand the full scope of the required change.

## Phase 2: Planning & Approval

- [ ] **Formulate a plan**: Output a concise structural `<plan>`. If the refactor touches multiple domain boundaries or heavily alters database schema, pause for user approval.
- [ ] **Scope strictly**: Ensure the plan *only* addresses the specific migration debt item. Avoid scope creep.

## Phase 3: Execution & Project Alignment

Refactor the code following the strict MMS invariants (`rules/mms-core.md`):

- [ ] **Data Hooks Refactor**: If migrating frontend data fetching, replace legacy `useLiveCollection` (unless for local drafts) with TanStack Query v5 `queryOptions`/`mutationOptions` factories (`mms-query-factories`).
- [ ] **Security Refactor**: If removing `role ===` hardcoded checks, replace them with authoritative RBAC permission wrappers (`can()`, `platformUserCan()`) and zero-trust `@mms/contracts` Zod validation.
- [ ] **Schema Debt (`mms-schema-migrate`)**: If normalizing database tables, enforce 3NF/BCNF, ensure bidirectional relations are typed, and write forward-only migrations (no `drizzle-kit push`).
- [ ] **UI/UX Modernization**: Ensure any touched UI is modernized to 44x44px touch targets, BiDi tokens (`mms-ui-ux-design.md`), and semantic HTML.
- [ ] **Preserve intentional debt**: Some items (like Messaging clear / QB variants) are marked as intentional debt. **Do not regress** or "fix" these unless specifically requested.

## Phase 4: Verification & Completion Review

- [ ] **Verify changes**: Run applicable checks based on the scope:
  - Backend changes: `cd apps/api && pnpm lint`, backend tests.
  - Frontend changes: `cd apps/tenant-web && pnpm lint` (platform: `cd apps/platform-web && pnpm lint`), frontend tests.
  - Always run `pnpm typecheck` at the monorepo root.
- [ ] **Follow Completion Review**: Ensure all steps in `mms-completion-review.md` are satisfied.
- [ ] **Update the registry**: Move the fixed item from the open gaps table to the "Recently Resolved" table in `rules/mms-migration-status.md` (and update the `mms-migration-fixes` SKILL.md if needed).
- [ ] **Sync Standards**: If any standards, rules, or agent files were modified, run `bash .agent/scripts/sync-all.sh`.

---

> [!NOTE]
> **Current P1 Focus Areas**
> - **Messaging**: Clear / QB papers-results variants (intentional — do not regress). Skills: `mms-module-work`, `mms-messaging`.
> - **Security/Frontend**: Residual `role ===` / setup matrix special cases. Skills: `mms-backend-security`, `mms-frontend`.
> - **Reports**: Report drill-down & saved reports beyond Contacts. Skill: `mms-reports-export`.
> - **Data Layer**: Custom tabs relational schema. Skill: `mms-fields-registry`.
