---
name: mms-user-management
description: Governs tenant-level user administration, staff invitations, role assignments, and active session controls. Use when modifying UsersPage, user invitation dialogs, tenant RBAC role assignments, or staff access controls. Do NOT use for platform superadmin apex console (use mms-platform-console), low-level session cookie/CSRF security hardening (use mms-backend-security), or person demographic contact linking (use mms-student-lifecycle).
license: Proprietary
metadata:
  owner: mms-platform
  last-verified: 2026-10-16
---

# MMS Tenant User Management & Role Provisioning

**Rules (norms SSOT):** `mms-auth-security.md` §2 (RBAC matrices) · `mms-module-architecture.md` · `mms-core.md`.

## When to use

- Building or modifying the tenant staff user directory (`UsersPage.tsx`)
- Implementing user invitation workflows, invitation token generation, or acceptance
- Managing tenant RBAC role assignments (admin, staff, teacher, viewer)
- Resetting credentials or revoking active tenant user sessions

## 1. Domain Invariants & Security Boundaries

- **Tenant Isolation**: Users managed here operate within the active tenant boundary. Superadmins or apex platform administrators are managed separately under the Platform Console (`mms-platform-console`).
- **Self-Admin Lockout Protection**: An administrator cannot reset their own password or revoke their own permissions through administrative endpoints (`apps/backend/src/routes/tenant/users.ts`).
- **Least Privilege RBAC**: Role changes must validate that the granting user possesses equivalent or higher administrative capabilities.
- **Audit Logging**: Every invitation, role promotion/demotion, or credential reset logs an RFC 8785 tamper-evident audit event (`mms-audit-trail`).

## 2. Implementation Map

| Concern | Path |
|---------|------|
| Users Page | `apps/frontend/src/tenant/features/users/UsersPage.tsx` |
| Users Controller | `apps/frontend/src/tenant/features/users/hooks/useUsersPageController.ts` |
| Users Work Tier | `apps/frontend/src/tenant/features/users/components/UsersWorkTier.tsx` |
| Users Setup Tier | `apps/frontend/src/tenant/features/users/components/UsersSetupTier.tsx` |
| Users Backend Routes | `apps/backend/src/routes/tenant/users.ts` |
| Users Query Facade | `apps/frontend/src/tenant/hooks/collections/users.ts` |

## 3. Verification Checklist

```
- [ ] Users directory virtualizes > 30 rows with DataTable
- [ ] UsersPage respects canWrite permission for invite/add actions
- [ ] Soft-delete trash mode (?view=trash) supports restore with 23505 conflict trap
- [ ] Self-reset prevention enforced on /api/users/:id/reset-password
- [ ] Verify: pnpm --filter mms-backend test src/__tests__/users.integration.test.ts
- [ ] Verify: pnpm typecheck
```

## Related skills

`mms-backend-security`, `mms-platform-console`, `mms-module-page`, `mms-form-architecture`, `mms-query-factories`.
