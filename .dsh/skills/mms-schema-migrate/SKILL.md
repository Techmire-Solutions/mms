---
name: mms-schema-migrate
description: Forward-only Drizzle migrations (journal/meta, expand/contract, RLS). Use when schema.ts/SQL/DDL review. Do NOT use for query caching (use mms-query-factories) or route handlers (use mms-backend-api).
license: Proprietary
metadata:
  owner: mms-platform
  last-verified: 2026-10-16
---

# MMS Schema & Drizzle Migration Workflow

**Rules (norms SSOT):** `mms-data-layer.md` §1, §6–§7 · `mms-auth-security.md` · `mms-performance.md`. Soft-delete workflow → `mms-soft-delete`.

## When to use

- Changing Drizzle schema, authoring SQL under `migrations_drizzle/`, or reviewing DDL PRs
- Adding FORCE RLS / soft-delete columns / concurrent indexes

## Implementation map

| Concern | Path |
|---------|------|
| Soft-delete mixin | `packages/db/src/schema/softDeleteSchema.ts` (`softDeleteColumns`) |
| Migrations | `packages/db/migrations_drizzle/` (+ `meta/_journal.json`) |
| Drizzle config | `packages/db/drizzle.config.ts` |
| Concurrent indexes | `pnpm --filter mms-api index:concurrent` |
| Integrity script | `scripts/check-migrations.sh` |

## 1. Schema Authoring Standards

- **3NF & Strict Typing**: Dedicated, typed columns only. Untyped JSON/JSONB/EAV blobs and comma-delimited strings are banned (`mms-data-layer.md` §1).
- **Multi-Tenancy**: Every tenant table requires `tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" })` and `FORCE ROW LEVEL SECURITY`.
- **Primary & Temporal Keys**: `bigint` identity PK (high-write) or `uuid` PK (distributed); `TIMESTAMPTZ` with timezone for `createdAt`/`updatedAt`. Bounded `varchar(N)` for predictable text.
- **Drizzle Relations & Types**: Define bidirectional `relations(entityTable, ...)` and export `$inferSelect` and `$inferInsert` types.
- **Shared Zod Contracts**: Define matching write schemas in `packages/contracts/src/schemas/` with `.strict()`.

## 2. Migration Execution Procedure

1. **Author Schema**: Add/edit `packages/db/src/schema/[entity].ts` and export from `schema.ts`.
2. **Generate Migration**: Run `pnpm --filter mms-api exec drizzle-kit generate` (requires `DATABASE_URL`). If generation is blocked by a malformed historical snapshot, stop and report; a hand-authored migration is a reviewed exception only (copy the previous snapshot, append the journal entry, document the reason in the PR). Never squash or alter existing committed migrations.

   > **Applied SQL is immutable; snapshot metadata is repairable.** `meta/*_snapshot.json` is drizzle-kit's diff input, not applied DDL, so repairing a malformed serialization (e.g. a missing `name`/`schema`, a `null` `prevId`, duplicate snapshot ids) is a *metadata repair*, not a retcon of history that has already run on a database. The `check-migrations-forward-only` ratchet exempts snapshots for this reason; `.sql` files and the hand-written TS data migrations remain byte-identical, and `_journal.json` remains append-only.
3. **Commit Parity**: Always commit SQL migration + `_journal.json` + meta snapshot in the exact same change.
4. **Expand/Contract Workflow**: Add nullable column → deploy & backfill → apply NOT NULL/CHECK constraint. Drop old columns only after dual-read window.
5. **Attach RLS Policies**: Tenant tables must include `tenant_isolation_policy` and `platform_superadmin_policy` (`mms-data-layer.md` §1).
6. **Soft-Delete Strategy**: Soft-deletable tables use `softDeleteColumns` from `softDeleteSchema.ts`, Category B partial index (`WHERE deleted_at IS NULL`), and `forbid_hard_delete()` trigger (`mms-soft-delete`).
7. **Non-Blocking Indexes**: Never write-blocking `CREATE INDEX` on large production tables in migration SQL. Run concurrent indexes via `pnpm --filter mms-api index:concurrent`.
8. **Ban Direct Push**: `drizzle-kit push` and `db push` are strictly banned against shared or production databases.
9. **Data-Only Backfills**: Derived-row backfills (e.g. system tags) are forward-only, idempotent, and conflict-targeted. They still require a journal entry + meta snapshot even when no schema column changes (`0202_backfill_relationship_role_tags.sql` is the reference). Do not edit an applied backfill.

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
