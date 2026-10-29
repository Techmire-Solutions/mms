---
name: mms-backend-api
description: Adds or modifies Fastify routes, middleware (authenticateTenant), services, Zod validation, auth artifacts, and WhatsApp integration in the MMS backend. Use when creating API endpoints, db sync, students/contacts REST, error handling, or backend services. Do NOT use for database DDL/migrations (use mms-schema-migrate), session/CSRF security hardening (use mms-backend-security), or background worker queuing (use mms-background-jobs).
license: Proprietary
metadata:
  owner: mms-platform
  last-verified: 2026-10-29
---

# MMS Backend API Workflow

**Rules (norms SSOT):** `mms-api-interface.md` · `mms-tdd.md` (route/use-case tests) · `mms-data-layer.md` §5–§6 · `mms-auth-security.md`. Checklists → `references/new-route-checklist.md` · `references/add-rest-resource.md`.

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
