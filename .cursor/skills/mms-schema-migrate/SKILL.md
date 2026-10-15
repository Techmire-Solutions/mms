---
name: mms-schema-migrate
description: Forward-only Drizzle migrations with journal/meta, expand/contract DDL, FORCE RLS on new tenant tables, and ban on drizzle-kit push against shared/prod DBs. Use when changing schema.ts, writing SQL migrations, or reviewing DDL PRs. Do NOT use for client-side query caching (use mms-query-factories) or application Fastify route handlers (use mms-backend-api).
license: Proprietary
metadata:
  owner: mms-platform
  last-verified: 2026-10-16
---

# MMS Schema & Drizzle Migration Workflow

**Rules (norms SSOT):** `mms-data-layer.mdc` §1, §6–§7 · `mms-auth-security.mdc` · `mms-performance.mdc`. Soft-delete workflow → `mms-soft-delete`.

## When to use

- Changing Drizzle schema, authoring SQL under `migrations_drizzle/`, or reviewing DDL PRs
- Adding FORCE RLS / soft-delete columns / concurrent indexes

## Implementation map

| Concern | Path |
|---------|------|
| Soft-delete mixin | `apps/backend/src/db/schema/softDeleteSchema.ts` (`softDeleteColumns`) |
| Migrations | `apps/backend/src/db/migrations_drizzle/` (+ `meta/_journal.json`) |
| Drizzle config | `apps/backend/drizzle.config.ts` |
| Concurrent indexes | `pnpm --filter mms-backend index:concurrent` |
| Integrity script | `scripts/check-migrations.sh` |

## 1. Schema Authoring Standards

- **3NF & Strict Typing**: Dedicated, typed columns only. Untyped JSON/JSONB/EAV blobs and comma-delimited strings are banned (`mms-data-layer.mdc` §1).
- **Multi-Tenancy**: Every tenant table requires `tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" })` and `FORCE ROW LEVEL SECURITY`.
- **Primary & Temporal Keys**: `bigint` identity PK (high-write) or `uuid` PK (distributed); `TIMESTAMPTZ` with timezone for `createdAt`/`updatedAt`. Bounded `varchar(N)` for predictable text.
- **Drizzle Relations & Types**: Define bidirectional `relations(entityTable, ...)` and export `$inferSelect` and `$inferInsert` types.
- **Shared Zod Contracts**: Define matching write schemas in `packages/shared/src/schemas/` with `.strict()`.

## 2. Migration Execution Procedure

1. **Author Schema**: Add/edit `apps/backend/src/db/schema/[entity].ts` and export from `schema.ts`.
2. **Generate Migration**: Run `pnpm --filter mms-backend exec drizzle-kit generate` (requires `DATABASE_URL`). Never squash or alter existing committed migrations.
3. **Commit Parity**: Always commit SQL migration + `_journal.json` + meta snapshot in the exact same change.
4. **Expand/Contract Workflow**: Add nullable column → deploy & backfill → apply NOT NULL/CHECK constraint. Drop old columns only after dual-read window.
5. **Attach RLS Policies**: Tenant tables must include `tenant_isolation_policy` and `platform_superadmin_policy` (`mms-data-layer.mdc` §1).
6. **Soft-Delete Strategy**: Soft-deletable tables use `softDeleteColumns` from `softDeleteSchema.ts`, Category B partial index (`WHERE deleted_at IS NULL`), and `forbid_hard_delete()` trigger (`mms-soft-delete`).
7. **Non-Blocking Indexes**: Never write-blocking `CREATE INDEX` on large production tables in migration SQL. Run concurrent indexes via `pnpm --filter mms-backend index:concurrent`.
8. **Ban Direct Push**: `drizzle-kit push` and `db push` are strictly banned against shared or production databases.

## 3. Verification & CI Ratchets

Execute before opening PR or committing DDL:

```bash
# 1. Audit migration integrity, RLS enforcement, and lock safety
bash .agent/skills/mms-schema-migrate/scripts/check-migrations.sh
MMS_RLS_STRICT=1 bash .agent/skills/mms-schema-migrate/scripts/check-migrations.sh

# 2. Verify non-blocking index additions and explicit projections
pnpm run check:migration-indexes
pnpm run check:db-projections

# 3. Typecheck backend and shared contracts
pnpm typecheck
```

## References

- Zero-Downtime Expand/Contract Migrations: `references/drizzle-expand-contract-guide.md`

## Related skills

`mms-soft-delete`, `mms-db-performance`, `mms-backend-api`.
