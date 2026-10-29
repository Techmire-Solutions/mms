---
name: mms-data-sync
description: Governs legacy localStorage and /api/db document-store persistence (db.ts, useLiveCollection, objects/collections) for non-migrated entities. Use when modifying legacy storage keys, local drafts, or document sync endpoints. Do NOT use for ANY newly created modules or migrated REST entities (use mms-query-factories + mms-backend-api), full workspace encrypted backups (use mms-backup-restore), or database DDL migrations (use mms-schema-migrate).
license: Proprietary
metadata:
  owner: mms-platform
  last-verified: 2026-10-16
---

# MMS Data Sync Workflow

**Rules (norms SSOT):** `mms-data-layer.md` · `mms-core.md` · `mms-migration-status.md`. Modern REST queries → `mms-query-factories`. Full backups → `mms-backup-restore`.

## When to use

- Changing legacy `db.ts` / `useLiveCollection` keys or document sync behaviour
- Touching `/api/db` collections, objects, backup, or wipe-restore sync endpoints
- Narrowing (not expanding) the legacy document-store surface

## Implementation map

| Concern | Path |
|---------|------|
| Client store | `apps/frontend/src/lib/db.ts` |
| Live collection hook | `apps/frontend/src/hooks/useLiveCollection.ts` |
| Backend routes | `apps/backend/src/routes/common/db.ts` |
| Helpers | `dbRouteHelpers` / `canReadCollection` / `canWriteCollection` near that route module |

## 1. Scope & Layer Boundaries

- **Legacy Only**: Restricted to non-migrated document collections. Creating new collections or adding `useLiveCollection` for new or REST-migrated modules is strictly banned.
- **REST Entities**: Primary entities use TanStack Query facades (`@/tenant/hooks/collections/*`). Never dual-write REST entities to `saveCollection`.
- **Async Saves**: Await `saveCollectionAsync` or `mutateAsync` before indicating saved state.

## 2. Document Store APIs (`/api/db`)

- `GET/POST /api/db/collections/:name`: `canReadCollection` / `canWriteCollection`.
- `GET/POST /api/db/objects/:key`: `canReadObject` / `canWriteObject`. Server-only keys blocked.
- `GET /api/db/backup`: Admin + `canBulkSync` (REPEATABLE READ).
- `POST /api/db/sync`: Admin + `canBulkSync` (wipe-restore under `withSyncTimeout` → 408).
- Never store OAuth tokens or secrets in `objects` (`mms-auth-security.md`).

## 3. Data Formatting & Save Intercepts

- Title-case Latin display names via `applyTitleCaseRecursive`; skip non-Latin RTL scripts.
- Normalize phones via `parsePhoneNumber` to E.164 on save paths.
- `db.ts` hydrates students from linked contacts on read; Contact REST owns person profiles.

## Verification

```bash
pnpm typecheck
# When touching client store or /api/db routes, run the matching FE/BE tests
pnpm --filter mms-frontend test
pnpm --filter mms-backend test
```

## Related skills

`mms-query-factories`, `mms-backup-restore`, `mms-frontend`.
