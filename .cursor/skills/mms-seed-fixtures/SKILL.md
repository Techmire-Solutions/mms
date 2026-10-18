---
name: mms-seed-fixtures
description: Authors, maintains, and runs database seed scripts, demo tenant fixtures, and module reset utilities. Use when adding seed data for new modules, resetting local development databases, or crafting deterministic E2E test fixtures. Do NOT use for production schema DDL migrations (use mms-schema-migrate) or customer backup wipe-restore operations (use mms-backup-restore).
license: Proprietary
metadata:
  owner: mms-platform
  last-verified: 2026-10-16
---

# MMS Database Seed Scripts & Test Fixtures

**Rules (norms SSOT):** `mms-ops-infrastructure.mdc` (dev setup) · `mms-testing-observability.mdc` (test isolation) · `mms-data-layer.mdc` §1 (tenant constraints).

## When to use

- Resetting or re-populating local development databases (`apps/backend/src/scripts/resetDb.ts`)
- Creating seed scripts for newly implemented entity modules (contacts, students, faculty, finance)
- Seeding apex platform administrative users (`seedSuperUser.ts`, `reset-platform-users.ts`)
- Generating deterministic tenant data fixtures for Playwright E2E suites

## 1. Topological Reset & FK Ordering

MMS enforces foreign key integrity across tables. Resetting or seeding tables must follow strict topological dependency ordering:
1. `auth` / `tenant_workspaces` (base tenant anchor)
2. `contacts` (person identity core)
3. `tenant_users`, `students`, `faculty` (entity models linked to contacts)
4. `sessions`, `enrollments`, `courses`, `departments` (academic structures)
5. `attendance`, `examinations`, `finance_invoices` (transactional records)

Use `apps/backend/src/scripts/resetAllModulesTopological.ts` when wiping and resetting tenant data to avoid foreign key violation traps.

## 2. Standardized Seed Scripts Inventory

Located under `apps/backend/src/scripts/`:

| Seed Target | Script Path | Output Entity Count |
|---|---|---|
| Full DB Reset | `apps/backend/src/scripts/resetDb.ts` | Complete baseline schema + demo tenant |
| Super User | `apps/backend/src/scripts/seedSuperUser.ts` | Platform apex admin user |
| Contacts | `apps/backend/src/scripts/seed-20-contacts.ts` | 20 deterministic contacts |
| Students | `apps/backend/src/scripts/seed-20-students.ts` | 20 students linked to contacts |
| Faculty | `apps/backend/src/scripts/seed-20-faculty.ts` | 20 faculty staff records |
| Invoices | `apps/backend/src/scripts/seed-20-invoices.ts` | 20 fee invoices & ledger entries |
| Sessions | `apps/backend/src/scripts/seed-20-sessions.ts` | 20 academic sessions |

## 3. Seed Execution Commands

```bash
# Full local database reset
pnpm --filter mms-backend db:reset

# Seed specific module fixtures via tsx
pnpm --filter mms-backend exec tsx src/scripts/seed-20-contacts.ts
pnpm --filter mms-backend exec tsx src/scripts/seed-20-students.ts
pnpm --filter mms-backend exec tsx src/scripts/seed-20-faculty.ts
```

## 4. Invariants for New Seed Authors

- **Deterministic data**: Avoid random timestamps or IDs in fixtures; deterministic values prevent brittle E2E tests.
- **Tenant isolation**: Always specify the target workspace ID (`ws-demo` or tenant context) so seed rows never land with null or invalid tenant keys.
- **RFC 8785 Audit Rows**: If seeding transactional entities that require tamper-evident logging, ensure audit outbox events are properly created or skipped appropriately for bulk fixtures.

## References

- Database Seed & Fixture Recipes: `references/seed-fixture-recipes.md`

## Related skills

`mms-dev-setup`, `mms-testing-e2e`, `mms-schema-migrate`, `mms-student-lifecycle`, `mms-faculty-domain`.
