---
name: mms-backend-api
description: Adds or modifies Fastify routes, middleware (authenticateTenant), services, Zod validation, auth artifacts, and WhatsApp integration in the MMS backend. Use when creating API endpoints, db sync, students/contacts REST, error handling, or backend services. Do NOT use for database DDL/migrations (use mms-schema-migrate), session/CSRF security hardening (use mms-backend-security), or background worker queuing (use mms-background-jobs).
license: Proprietary
metadata:
  owner: mms-platform
  last-verified: 2026-11-02
---

# MMS Backend API Workflow

**Rules (norms SSOT):** `mms-api-interface.mdc` · `mms-tdd.mdc` (route/use-case tests) · `mms-data-layer.mdc` §5–§6 · `mms-auth-security.mdc`. Checklists → `references/new-route-checklist.md` · `references/add-rest-resource.md`.

## When to use

- Adding or changing Fastify tenant/platform routes, use-cases, or repositories
- Wiring Zod validation, RLS tenant context, or standard CRUD/soft-delete factories
- Registering module access gates for new endpoints

## Implementation map

| Concern | Path |
|---------|------|
| Resource CRUD | `apps/backend/src/lib/crudResourceRoutes.ts` (`registerResourceRoutes`) |
| Bulk trash | `apps/backend/src/lib/crudBulkRouteFactories.ts` (`registerSoftDeletableBulkTrashRoutes`) |
| Standard routes | `apps/backend/src/lib/crudStandardRoutes.ts` (`registerStandardTenantRoutes`) |
| Zod parse | `apps/backend/src/lib/zodRequest.ts` (`parseRequest`) |
| RLS tx | `apps/backend/src/db/tenant-context.ts` (`withTenant`) |
| Auth | `apps/backend/src/middleware/authenticate.ts` (`authenticateTenant`) |
| Module gates | `registerModuleAccess` + `MODULE_ROUTE_ACTION_RULES` + `apps/backend/src/__tests__/moduleAccessCoverage.test.ts` |

## 1. Clean Architecture Layering

- **Flow**: `routes/` (thin controller) → `use-cases/` (business rules) → `repositories/` (interface) → `db/` (Drizzle adapter).
- **Decoupling**: Route handlers invoke the module composition root (`xxxUseCases`); direct database queries from route handlers are banned.
- **Explicit Projections**: Every query must provide an explicit, typed column projection (`db.select({ id: table.id }).from(table)`). Bare `.select()` and `SELECT *` are strictly banned (`check:db-projections`).
- **Resource Management**: Use Node 24 `await using` for deterministic disposal of pooled client checkouts and stream handles.

## 2. Request Handling & REST Contracts

- **Zod Validation**: Validate incoming params, query, and body via `parseRequest` paired with strict `@mms/shared` Zod schemas.
- **Multi-Tenant Context**: Wrap tenant mutations inside `withTenant(async (tx) => ...)` enforcing transaction-scoped RLS (`SET LOCAL app.current_tenant`).
- **Bulk PUTs**: Upsert only using `conflictTarget`. Wiping missing rows (`replaceForWorkspace`) on normal save paths is strictly banned.
- **Standard CRUD Factories**: Use `registerResourceRoutes` and `registerSoftDeletableBulkTrashRoutes` for standard REST entities.
- **Single-Record Reads**: Filter `isNull(table.deletedAt)`; return `404 Not Found` for archived records unless caller has delete permissions and specifies `?includeDeleted=true`.
- **Audit Outbox**: Mutating audited entities emits RFC 8785 canonical JSON outbox records inside the primary transaction (`mms-audit-trail`).
- **Optimistic Concurrency**: Contested single-row updates echo the read version and compare-and-set atomically (`onConflictDoNothing` / `WHERE updated_at = expected`); a zero-row result is `409 Conflict`, never a silent overwrite. The token is the value the client read — a body `expectedUpdatedAt` or an explicit header (contacts: `x-expected-updated-at`), never the payload's regenerated `updatedAt` — and the route/integration test must assert the 409. Document-template example: `mms-document-templates`.
- **Read/Write DTO Parity**: A request-body schema must accept exactly what the response mapper emits (child rows included). Prove it with a round-trip test that feeds a mapper fixture through the write DTO; `@ts-rest` validates requests but not responses, so a strict nested row shows up as a silent 400 on edits.
- **Server-Owned Attribution**: Strip `createdBy`/`updatedBy`/`createdAt` and soft-delete columns before validation (`stripClientAuditFields` + `stripContactClientSoftDeleteFields`), then stamp the actor from the session in the use case.
- **Self-Service Writes**: An own-record path validates against the profile DTO whitelist (`ownContactPatchBodySchema` / `OWN_CONTACT_PATCH_KEYS`), not the module DTO, and skips peer-graph side effects.
- **Domain Errors in Shared Helpers**: Generic route helpers map `sendIfHttpDomainError(reply, err)` before `sendDatabaseError` — a repository `ValidationError` must reach the client as 400, not 500.
- **Batch Writers**: Preload tenant config once per job/batch (`loadContactWriteContext` pattern) and suppress per-record side effects (`batchMode`: broadcast, cache invalidation, scan invalidation), running each once after the loop.

## 3. Verification

```bash
# Run backend typecheck, tests, and linting
cd apps/backend && pnpm typecheck && pnpm test && pnpm lint

# Verify explicit column projections across all queries
pnpm run check:db-projections
```

## Examples

- Clean architecture route shape: `examples/clean-architecture-route.ts`

## Related skills

`mms-backend-security`, `mms-schema-migrate`, `mms-soft-delete`, `mms-audit-trail`, `mms-shared-package`.
