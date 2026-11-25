# `@mms/mod-iam`

First audience-separated vertical module: tenant user management, roles and
permissions, organization invites, and platform operator IAM.

## Public API

| Subpath                          | Audience         | Contents                                                                                              |
| -------------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------- |
| `@mms/mod-iam/shared`            | FE + BE          | contracts re-exports, role/permission constants, last-admin/member/impersonation policy, invite state |
| `@mms/mod-iam/backend/tenant`    | API only         | `tenantIamRoutes`, `createIamService`, `IamPorts` types                                               |
| `@mms/mod-iam/backend/platform`  | API only         | `platformIamRoutes` (cross-tenant search, suspension, audited impersonation)                          |
| `@mms/mod-iam/frontend/tenant`   | tenant console   | `TeamMembersPage`, `InviteMemberModal`, team/role hooks, RoleBadge/UserAvatar/PermissionMatrixView    |
| `@mms/mod-iam/frontend/platform` | platform console | `GlobalUsersTable`, `TenantImpersonationModal`, global search/impersonation hooks                     |

No root export. Backend subpaths are Node ESM `dist/`; frontend subpaths are
TypeScript source.

## Backend composition

The module owns policy and orchestration; data/cross-domain access is injected
through `IamPorts` implemented by `apps/api/src/modules/iam/adapters.ts`.
The app mounts the route plugins inside its existing auth scopes:

- tenant: `authenticateTenant` + `registerModuleAccess(scope, "users")`
- platform: `authenticatePlatform` + `requirePlatformPermission("admins")`

New endpoints:

```text
GET    /api/iam/members
GET    /api/iam/roles
POST   /api/iam/members
POST   /api/iam/members/invite
PATCH  /api/iam/members/:id
DELETE /api/iam/members/:id
POST   /api/iam/members/:id/restore
POST   /api/iam/members/:id/reset-password

GET    /api/platform/iam/users?q=
GET    /api/platform/iam/organizations?q=
PATCH  /api/platform/iam/users/:tenant/:userId/status
POST   /api/platform/iam/impersonations
```

Platform suspension and impersonation require `super_user` + `admins` +
password re-entry and a 10–500 character reason. Cross-tenant reads and
impersonation are wrapped in `bypassTenantScope()`; the DB package emits
started/completed audit events and fails closed if a sink fails. Impersonation
issues a one-time `handoff` artifact (120s) and returns the tenant login URL;
the platform and tenant audit trails both record the action.

The existing `/api/users` and `/api/platform/users` routes remain the legacy
surfaces while the module routes embed in the apps; migrating the remaining
advanced Users tabs and moving repositories into the module are follow-ups in
the migration plan.

## Frontend integration

- Shared widgets are presentational and have no API/router imports; every
  user-facing string comes from a `labels` prop (no module-owned copy).
- **Live consumers:** `apps/frontend` imports `RoleBadge` from
  `@mms/mod-iam/frontend/tenant` (`UserBadges`) and the platform operator IAM
  surface (`GlobalUsersTable` + `TenantImpersonationModal`) from
  `@mms/mod-iam/frontend/platform` via `PlatformIamPanel` in the Platform Users
  Work tier. Impersonation is offered only to `super_user`.
- `TeamMembersPage` and `InviteMemberModal` are the canonical tenant views for
  the upcoming `apps/tenant-web` split (P8); the triple-tier tenant UsersPage
  stays app-side until then. `InviteMemberModal.resolveContact` converts the
  typed email into the `contactId` the invite contract requires.
- Advanced Users tabs stay app-side for this slice (P6 relocation).

## Error mapping

`IamError` (`shared/errors.ts`) carries a `code`; `backend/respond.ts` maps it to
400/401/403/404/409 once for both routers. Authorization failures are never
inferred from message substrings, and unknown errors fall back to 400 instead of
leaking a 500/database message.

## Known limitations

- **Last-admin guard is read-then-write.** `updateMember`/`removeMember` load the
  member list, evaluate policy, then mutate. Two concurrent demotions of
  _different_ admins can both pass. Closing the race needs a row lock inside the
  tenant transaction of the app adapter — the module cannot take it across the
  port. Flagged for the P6 repository move.
- **Suspension and reactivation share one guard.** `setTenantUserStatus` runs
  `canSuspendTenantUser` for both directions, so reactivating a platform-managed
  user reports "Cannot suspend this tenant user". Behaviour is correct; the copy
  is not.
- **Self password reset is refused at the service.** `resetMemberPassword`
  rejects the actor's own id; self-service changes must use the current-password
  flow. Ownership removal is still allowed when another active admin remains.

## Verification

```bash
pnpm --filter @mms/mod-iam build typecheck lint test
node --test scripts/ci/module-audience-boundaries.test.mjs   # tenant-web probe
pnpm run check:module-boundaries                             # app/module source ratchet

# Real-Postgres proof of the platform adapter (offset/count/order/tenant scoping):
pnpm --filter mms-api exec vitest run --config vitest.db.config.ts \
  src/__tests__/db-integration/iamPlatformSearch.db.integration.test.ts
```

The probe test proves `apps/tenant-web` cannot import
`@mms/mod-iam/frontend/platform` or `@mms/mod-iam/backend/*` (while `shared` and
`frontend/tenant` stay allowed), that `apps/platform-web` cannot import the
tenant audience, and that no app may import the module root. `apps/frontend` is
the interim hybrid: it may import either frontend audience app-wide, while
`src/tenant/**` keeps the tenant bans.
