# `@mms/fe-core`

The MMS frontend runtime: the typed API SDK and the non-UI React infrastructure
that both consoles share.

## Entry points

| Import                             | Contents                                                                                                        |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `@mms/fe-core`                     | Re-exports every subpath below                                                                                  |
| `@mms/fe-core/api`                 | `configureApiClient`/`apiFetch`/`apiJson`, ts-rest client, `ApiError`, contract-query helpers, downloads        |
| `@mms/fe-core/query`               | QueryClient singleton + factory, retry policy, IDB persister, persistence lifecycle, module-access invalidation |
| `@mms/fe-core/auth`                | `AuthProvider`/`useAuth`, login/session hooks, auth-error mapping, 2FA, background-job storage                  |
| `@mms/fe-core/tenant`              | `TenantProvider`/`useTenant`, workspace lookup, deployment domain hook                                          |
| `@mms/fe-core/forms`               | Draft/identity/submit hooks, Zod resolver, validation mapping, form auto-scroll                                 |
| `@mms/fe-core/i18n`                | Language-pack initialization, UI-language resolution, document language/fonts                                   |
| `@mms/fe-core/config` / `/routing` | Typed env, routes, tenant config, imperative navigation                                                         |
| `@mms/fe-core/testing`             | Test-only helpers (refresh state reset)                                                                         |

## API client contract

- Auth is cookie-based (`credentials: "include"`); no token is stored in
  JavaScript or localStorage.
- Mutations send `X-CSRF-Token` from the double-submit cookie.
- Every request gets `X-Request-Id`; a caller-provided value is preserved.
- `X-Tenant-Id` is supplied by an injected provider and is informational only —
  the backend derives the authoritative tenant from the verified host + DB.
- 401s trigger a single-flight refresh; failures dispatch `mms:session-expired`.
- Non-2xx responses normalize into `ApiError` with status/type/body/requestId/
  retry-after preserved.

## Compatibility

The app still imports through its historical `@/lib/...` paths; those files are
thin re-export shims over this package. New code should import `@mms/fe-core`
subpaths directly. `pnpm run check:core-packages` enforces that the package
imports no app code and only `@mms/contracts`/`@mms/ui` from the workspace.
