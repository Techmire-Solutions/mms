---
name: mms-user-management
description: Tenant user admin (invitations, role assignments, session controls). Use when UsersPage/invites/RBAC. Do NOT use for platform apex (use mms-platform-console), session security (use mms-backend-security), or contact linking (use mms-student-lifecycle).
license: Proprietary
metadata:
  owner: mms-platform
  last-verified: 2026-10-16
---

# MMS Tenant User Management & Role Provisioning

**Rules (norms SSOT):** `mms-auth-security.mdc` §2 (RBAC matrices) · `mms-module-architecture.mdc` · `mms-core.mdc`.

## When to use

- Building or modifying the tenant staff user directory (`UsersPage.tsx`)
- Implementing user invitation workflows, invitation token generation, or acceptance
- Managing tenant RBAC role assignments (admin, staff, teacher, viewer)
- Resetting credentials or revoking active tenant user sessions

## 1. Domain Invariants & Security Boundaries

- **Tenant Isolation**: Users managed here operate within the active tenant boundary. Superadmins or apex platform administrators are managed separately under the Platform Console (`mms-platform-console`).
- **Self-Admin Lockout Protection**: An administrator cannot reset their own password or revoke their own permissions through administrative endpoints (`packages/modules/iam/src/backend/tenant/users.router.ts`).
- **Least Privilege RBAC**: Role changes must validate that the granting user possesses equivalent or higher administrative capabilities.
- **Audit Logging**: Every invitation, role promotion/demotion, or credential reset logs an RFC 8785 tamper-evident audit event (`mms-audit-trail`).

## 2. Implementation Map

| Concern | Path |
|---------|------|
| Users Page | `apps/tenant-web/src/tenant/features/users/UsersPage.tsx` |
| Users Controller | `apps/tenant-web/src/tenant/features/users/hooks/useUsersPageController.ts` |
| Users Work Tier | `apps/tenant-web/src/tenant/features/users/components/UsersWorkTier.tsx` |
| Users Setup Tier | `apps/tenant-web/src/tenant/features/users/components/UsersSetupTier.tsx` |
| Users Backend Routes | `packages/modules/iam/src/backend/tenant/users.router.ts` |
| Users Query Facade | `apps/tenant-web/src/tenant/hooks/collections/users.ts` |

## 3. Verification Checklist

```
- [ ] Users directory virtualizes > 30 rows with DataTable
- [ ] UsersPage respects canWrite permission for invite/add actions
- [ ] Soft-delete trash mode (?view=trash) supports restore with 23505 conflict trap
- [ ] Self-reset prevention enforced on /api/users/:id/reset-password
- [ ] Verify: pnpm --filter mms-api test src/__tests__/users.integration.test.ts
- [ ] Verify: pnpm typecheck
```

## Related skills

`mms-backend-security`, `mms-platform-console`, `mms-module-page`, `mms-form-architecture`, `mms-query-factories`.
