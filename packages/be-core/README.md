# `@mms/be-core`

The MMS backend kernel. It owns transport-adjacent primitives that every
Fastify surface shares, without importing app services or domain modules.

## Entry points

| Import                    | Contents                                                                                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@mms/be-core`            | Re-exports every subpath below                                                                                                                         |
| `@mms/be-core/auth`       | `createTenantAuthGuard`, `createPlatformAdminGuard`, `createModuleAccessGuard`, session/JWT verification helpers, cookie token helpers, auth responses |
| `@mms/be-core/rbac`       | Permission maps, `can*` helpers, request role-catalog WeakMap                                                                                          |
| `@mms/be-core/logger`     | Structured pino logger with the shared DB redaction rules                                                                                              |
| `@mms/be-core/telemetry`  | Traceparent parse/format, AsyncLocalStorage tracer, Fastify telemetry plugin                                                                           |
| `@mms/be-core/http`       | Request-id/correlation hooks, tenant host parsing, request diagnostics, payload trimming                                                               |
| `@mms/be-core/redis`      | Redis clients, bounded in-memory fallback cache, key builders, BullMQ connection options                                                               |
| `@mms/be-core/queues`     | Shared job defaults, tenant priority bands, tenant fair-share counters                                                                                 |
| `@mms/be-core/realtime`   | WS/SSE connection registry, job event broadcast, tenant invalidation emitters, Redis pub/sub                                                           |
| `@mms/be-core/transports` | SMTP transport, outbound URL/SSRF guards, email/notification channel adapters                                                                          |

## Guard contract

Guards are factories over explicit ports, so the app keeps the domain services
and `@mms/be-core` keeps the fail-closed ordering and response envelopes:

```ts
const authenticateTenant = createTenantAuthGuard({
  readAuthPipeline,
  isDependencyUnavailable,
  resolveAuthoritativeRole,
  attachRoleCatalog,
  isAccountSoftDeleted,
  loadGlobalSettings,
  sessionPolicyFor,
  enforceSessionClock,
  loadWorkspace,
  markStage,
  onUnexpectedError,
});
```

`apps/api/src/middleware/*` are thin composition roots using these
factories. Their public names (`authenticateTenant`, `authenticatePlatform`)
are preserved; `tenantAuthGuard` and `platformAdminGuard` are exported aliases.

## Dependency rule

Workspace imports are limited to `@mms/contracts` and `@mms/db`. `pnpm run
check:core-packages` enforces this and fails closed on an empty package.
