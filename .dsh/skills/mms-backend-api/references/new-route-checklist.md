# new-route-checklist — mms-backend-api

Extracted from `SKILL.md` so the skill body stays loadable in one pass; the owning rule is the norm SSOT.


## New route checklist

```
- [ ] FastifyPluginAsync in routes/
- [ ] preHandler: `authenticateTenant` or `authenticatePlatform` (not raw jwtVerify)
- [ ] Zod via parseRequest + replyValidationError on writes
- [ ] rbacService / canWrite on mutations
- [ ] Errors: { type, message } + correct status
- [ ] Registered prefix; inject() with tenant host + cookie
- [ ] Tenant writes: withTenant + SET LOCAL (+ app.current_user_id for audit) utilizing Node 24 explicit resource management (`await using` db handles for auto-cleanup)
- [ ] Prefer SET LOCAL statement_timeout / idle_in_transaction_session_timeout on tenant write txs — mms-data-layer
- [ ] Parameterized sql only — ban user/tenant input → sql.raw
- [ ] Large/hot list APIs: prefer keyset/cursor; OFFSET OK for small Work pages — mms-data-layer
- [ ] Zero queries inside loops (N+1); batch via Drizzle relational `with`, `inArray` ($\le 500$), SQL joins, or `/resolve` — `mms-performance.md`
- [ ] Zero wildcard projections (`SELECT *` or bare select); use explicit column projection objects matching Response DTOs — `mms-performance.md`
- [ ] Mandatory pagination with hard caps: default 25, max 100 via `baseListQuerySchema` — `mms-performance.md`
- [ ] Large file uploads stream via `@fastify/multipart` (no memory buffering); exports stream via `node:stream` / async generators; datasets $> 500$ rows offloaded to background jobs — `mms-performance.md`
- [ ] Redis caching: tenant-scoped key `mms:{tenantId}:{module}:{resource}:{hash}`; mutations trigger cache eviction + `/api/ws` invalidation — `mms-performance.md`
- [ ] HTTP caching headers: emit `ETag` and `Cache-Control: private, no-cache` on idempotent GET responses (`304 Not Modified` on match) — `mms-performance.md`
- [ ] Contested PUT: updated_at/version → 409 conflict, or document LWW — mms-api-interface §6
- [ ] bodyLimit / requestTimeout from serverConfig (or explicit raise for sync/upload)
- [ ] Outbound provider fetch uses native `fetch()` + `AbortSignal.timeout` (no `axios`/`node-fetch`/`ws` for client comms)
- [ ] Use `node:crypto` `crypto.hash()` instead of `createHash().update().digest()` chains
- [ ] Use `URLPattern` for matching instead of `path-to-regexp`
- [ ] Replace legacy `url.parse()` with WHATWG `new URL()`
- [ ] Core module imports prefixed with `node:` (`node:fs/promises`, `node:crypto`, `node:path`, `node:async_hooks`)
- [ ] Request / tenant tracking via `AsyncLocalStorage` (`node:async_hooks`; no experimental `AsyncContextFrame` flag)
- [ ] Soft-delete endpoints use registerResourceRoutes (deleteFn/restoreFn) + registerSoftDeletableBulkTrashRoutes
- [ ] Atomic conditional latch on soft-delete (`WHERE deleted_at IS NULL RETURNING id`)
- [ ] Batched single-statement SQL for bulk delete/restore (no per-row loops)
- [ ] Dynamic AST in Drizzle queries matching Category B/C partial indexes (no parameterized booleans)
- [ ] Relational child queries in `with: { ... }` explicitly declare `where: (c, { isNull }) => isNull(c.deletedAt)`
- [ ] Restore traps PostgreSQL error `23505` mapping to `409 Conflict`
- [ ] Single-record `GET /:id` returns 404 for archived records unless `?includeDeleted=true` with `canDelete`
- [ ] Session invalidation on user/faculty soft delete + `deleted_at IS NULL` verification in auth resolvers
- [ ] CDC outbox events emitted with monotonic versioning (`entity.soft_deleted` / `entity.restored`)
```
