# route-audit-checklist — mms-backend-security

Extracted from `SKILL.md` so the skill body stays loadable in one pass; the owning rule is the norm SSOT.


## Route audit checklist (new PR)

1. Is the route tenant-scoped? → `authenticateTenant` (+ `bindRequestUserId`)
2. Is the route platform apex? → `requireMainDomain` + `authenticatePlatform` (+ `requireSuperUser` / `requirePlatformPermission` as needed)
3. Is it a mutation **or** sensitive read? → `rbacService` / `canReadCollection` / `requireAdmin` (tenant) or `platformUserCan` (platform)
4. Is body validated? → Zod via `parseRequest` before service layer (write schema strips soft-delete when applicable)
5. Never trust body `workspaceSubdomain` / authz `userId` — session only
6. Does it touch auth or messaging send? → rate limit preserved
7. Prod cookies `Secure`; prefer Helmet/secure headers when touching `app.ts`
8. Integration test with wrong-subdomain host returns `403`? (platform routes: tenant host must `403`)
9. New secret store? → FORCE-RLS table + exclude from backup snapshots
10. New tenant table? → composite PK `(workspace_subdomain, id)` + `FORCE RLS` + tenant-scoping policy

## Tenant isolation checklist

- [ ] Tenant from host header — not from client JSON body on protected routes
- [ ] Cookie CSRF / Origin check on state-changing cookie-auth routes
- [ ] Storage keys `t:{subdomain}:{logicalKey}` on server (`database.ts` + `tenantContext.ts`)
- [ ] JWT subdomain matches resolved tenant
- [ ] Apex routes do not expose other tenants' data
- [ ] Tests use `host: '{subdomain}.localhost'` in `inject()`
- [ ] Typed REST routes use repositories + `withTenant` / SET LOCAL RLS (not `dbSyncService`); `dbSyncService` only for `/api/db` JSON documents
- [ ] Redis cache keys strictly isolate by tenant and context (`mms:{tenantId}:{module}:{resource}:{hash(queryParams)}`) with viewer role scope when permissions alter payload (`mms-performance.md`)
