# add-rest-resource — mms-backend-api

Extracted from `SKILL.md` so the skill body stays loadable in one pass; the owning rule is the norm SSOT.


## Add a REST resource

1. **Zod Schemas & Contracts**: Define strictly-typed API endpoints using `@ts-rest/core` contracts in `@mms/shared/contracts`. Write schemas in `@mms/shared` (`.strict()` on write bodies) + explicit Insert/Update/Response DTO types aligning 1:1 with Drizzle tables.
2. **Domain & DB Layer**:
   - Drizzle schema with typed columns (3NF/BCNF, zero semi-structured storage, multi-tenancy `tenantId` FK, bidirectional relations).
   - Domain use-cases in `{module}/use-cases/**` (orchestration, repo DI) + `{module}/repository/` interface + Drizzle adapter + composition root (`{module}UseCases`) — `mms-api-interface.md` §2.
3. **Service & Transaction RLS**: Execute tenant writes inside `withTenant` applying `SET LOCAL app.current_tenant = ?`. Always validate payloads via `@mms/shared` Zod schemas before persistence.
4. **Fastify Route & Router Decomposition**: Implement endpoints using `@ts-rest/fastify` connected to the shared contracts. Decompose larger resources into focused route plugins under `routes/tenant/{resource}/` (e.g. read, write, soft-delete, bulk, stats) mounted via `index.ts` — `authenticateTenant` + `canWriteCollection` (or `authenticatePlatform` + `platformUserCan` for platform routes); call the composition root.
   - **Soft-Delete Wiring**: In `{resource}SoftDeleteRoutes.ts`, wire single restore via `registerResourceRoutes` (`restoreFn`, `buildRestoreResponse` with `sanitizeOneForUser`, `mapRestoreError` translating domain uniqueness failures to HTTP 400 vs DB 23505 to 409) and bulk operations via `registerSoftDeletableBulkTrashRoutes` (`bulkIdsBodySchema`, batched SQL, audit logging) — `mms-api-interface.md` §7.
5. **Registration**: Register under `/api/{resource}` or `/api/platform/{resource}` in `routes/index.ts`.
6. **Tests**: `inject()` tests with `host: 'tenant.localhost'`.
7. **FE Query Hooks**: **`mms-query-factories`** / **`mms-frontend`**.

Refs: `routes/tenant/students.ts`, `contacts.ts`, `contacts/contactSoftDeleteRoutes.ts`, `faculty.ts`, `examinations.ts`, `hasanat.ts`; Contacts Clean Architecture standard (`contacts/use-cases/` + `contacts/repository/` + `contactUseCases` + decomposed routes).
