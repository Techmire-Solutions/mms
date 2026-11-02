---
name: mms-soft-delete
description: Implements, verifies, or audits the MMS Soft-Delete System — column sextuple, 3-tier index strategy, partial unique indexes, BEFORE DELETE triggers, RLS policies, dynamic query ASTs, and trash UX. Use when adding or changing soft-delete, trash directories, restore handlers, DDL migrations, or auditing deletion lifecycles. Do NOT use for ephemeral scratchpad data (hard-delete directly per mms-data-layer.mdc), immutable audit log events (use mms-audit-trail), or posted-journal corrections (use mms-finance-accounting).
license: Proprietary
metadata:
  owner: mms-platform
  last-verified: 2026-10-16
---

# MMS Soft-Delete System Workflow

**Rules (norms SSOT):** `mms-data-layer.mdc` §6 · `mms-module-architecture.mdc` §6–§7 · `mms-core.mdc` · `mms-api-interface.mdc` §7.

## When to use

- Adding soft-delete columns, trash/restore APIs, or Work-tier trash UX
- Auditing deletion indexes, AST filters, or CDC outbox events

Financial posted ledgers are append-only/reversal-driven; see ledger controls before applying generic undo.

## 1. Database Schema Standards

- **Column Sextuple**: Add `softDeleteColumns` from `apps/backend/src/db/schema/softDeleteSchema.ts` (`deletedAt`, `deletedBy`, `deletionReason`, `restoredAt`, `restoredBy`, `deletedWithCascade`).
- **3-Tier Indexing**:
  - Category A (Trash scan): compound `(tenant_id, deleted_at)`.
  - Category B (Active hot partial): `(tenant_id, ...)` `WHERE deleted_at IS NULL` (mandatory for active list performance).
  - Category C (Archived partial): `(tenant_id, deleted_at)` `WHERE deleted_at IS NOT NULL`.
- **Recyclable Uniqueness**: Unique fields (`email`, `phone`, `code`) must use partial unique indexes `WHERE deleted_at IS NULL`.
- **Safety Triggers**: Attach `forbid_hard_delete()` trigger to prevent direct SQL `DELETE` without explicit bypass flag.

## 2. Backend API Implementation

1. **Dedicated Soft-Delete Router**:
   - Isolate soft-delete and bulk trash endpoints in `<module>SoftDeleteRoutes.ts` (e.g. `contactSoftDeleteRoutes.ts`).
2. **Delete (`DELETE /:id`)**:
   - Verify `can('delete')` permission and check foreign key restrict guards.
   - For user/faculty accounts, immediately invalidate active sessions and Redis tokens.
   - Update `deletedAt = new Date()`, `deletedBy = user.id`, `deletionReason`.
   - Emit transactional outbox CDC event `entity.soft_deleted`.
3. **Single Restore (`POST /:id/restore`)**:
   - Register via `registerResourceRoutes` with `restoreFn: (id, userId) => useCases.restoreById(id, userId)`.
   - **Viewer Sanitization**: Provide `buildRestoreResponse: async (restored, user) => ({ success: true, [entity]: await sanitizeOneForUser(restored, user) })`.
   - **Error Taxonomy**: Use `mapRestoreError` to translate domain uniqueness validation failures to HTTP 400 (`type: 'validation_error'`) with structured field errors. Trap unexpected database race-condition collisions (`isUniqueViolation` / PostgreSQL `23505`) and map to `409 Conflict`.
   - Audit hook: `onAfterRestore: async (user, id) => audit(...)`.
4. **Bulk Trash & Restore (`POST /bulk-delete`, `POST /bulk-restore`)**:
   - Register via `registerSoftDeletableBulkTrashRoutes` with `bulkBodySchema: bulkIdsBodySchema` (capped at 500 IDs).
   - `bulkDeleteFn` and `bulkRestoreFn` execute single batched SQL `UPDATE ... WHERE id IN (...) AND deleted_at IS NULL/NOT NULL RETURNING id`.
   - Transactional audit hooks: `onAfterBulkDelete` (recording deletion reason) and `onAfterBulkRestore`.
   - CDC outbox rows emit in **one** multi-row INSERT + one `NOTIFY` (`emitOutboxEvents`); audit rows stay per record (hash chain). Do not loop the outbox emitter.
5. **Provenance on Any Resurrection**: an update/upsert that clears `deleted_at` (an upsert restoring a trashed record) stamps `restoredAt`/`restoredBy`, not only `POST /:id/restore` — otherwise the sextuple is incomplete and the restore is unattributable.
6. **List Queries**:
   - Default queries enforce `isNull(table.deletedAt)`.
   - `?includeDeleted=true` requires explicit delete permission and applies `isQueryFlagTrue(query.includeDeleted)`.
   - The list projection must carry `restoredAt`, `restoredBy`, and `deletedWithCascade` so trash rows keep their restore evidence.
7. **Derived Projections**:
   - Soft-deleting a source entity archives its derived rows (`Former …`) and restoring reactivates them; do not delete derived history.
   - Reconcile inside the delete/restore transaction, with a per-entity advisory lock; batch delete/restore reconciles all affected ids once after the cascade.

## 3. Frontend Work Tier Integration

- **URL Sync & Toggle**: Mount `ModuleTrashToggle` in toolbar; sync state to `?view=trash` via `useSearchParams()`. Preserves search and active filters across toggles.
- **Bulk Actions**: Mount `BulkSelectionRestoreAction` in trash mode via `BulkSelectionBar`.
- **Optimistic Undo**: Non-financial single-record deletes show instant 5–10s Undo toast calling restore.
- **Detail Drawer**: Display `EntityArchivedBanner` / `DetailDrawerArchivedBanner` (from `@/components/app/DetailDrawerArchiveChrome`) or a module wrapper (e.g. `StudentArchivedBanner`) with deletion metadata + Restore CTA; hide Edit and communication buttons.

## 4. Verification

```bash
# Verify schema sextuple and Category B partial indexes across tenant tables
bash .agent/skills/mms-soft-delete/scripts/verify-soft-delete-schema.sh

# Run backend soft-delete test suite
pnpm --filter mms-backend test
```

## References

| Task | File |
|------|------|
| DDL / indexes / triggers | `references/triggers-and-indexes.sql` |
| Query AST active filter | `references/query-ast-filter.ts` |
| Outbox CDC | `references/cdc-outbox.ts` |

## Related skills

`mms-module-work`, `mms-backend-api`, `mms-schema-migrate`, `mms-audit-trail`.
