---
name: mms-platform-console
description: Platform Console features (apex routes, permissions, workspace provisioning, admin). Use when apps/platform-web/src/platform, apps/api/src/platform, e2e platform. Do NOT use for tenant modules (use mms-module-page), UI primitives (use mms-shared-ui), or tenant RBAC (use mms-backend-security).
license: Proprietary
metadata:
  owner: mms-platform
  last-verified: 2026-10-16
---

# MMS Platform Console Architecture

**Rules (norms SSOT):** `mms-core.md` (Tenant = Platform Parity Principle) · `mms-auth-security.md` (Platform Auth & Permissions) · `mms-shared-ui.md` (Zero cross-console duplicates) · `mms-structure-naming.md` (300-line limit).

## When to use

- Building or modifying pages, routes, or components in the Platform Console (`apps/platform-web/src/platform`)
- Implementing platform-level backend routes, services, or repositories (`packages/modules/platform/src/backend/platform/routes`)
- Enforcing platform authorization, super-user capabilities, or workspace provisioning
- Writing or maintaining Platform Console E2E specs (`e2e/tests/platform`)

## 1. Tenant = Platform Parity Principle

All architecture rules apply equally to Platform Console code:
- **No Forked UI Primitives**: Import shared primitives from `@mms/ui` (`Button`, `Table`, `Card`, `Modal`). Never hand-roll custom platform duplicates (`platformUiArchitecture.test.ts`).
- **Design Tokens**: Adhere to centralized design tokens, CSS variables, and layout contracts (`mms-ui-ux-design.md`).
- **LTR Locking**: Unlike the BiDi/RTL tenant console, the Platform Apex Console is locked to LTR (`mms-settings-i18n.md` §5).
- **Zod Strict Schemas**: All platform API payloads require `.strict()` DTO schemas defined in `@mms/contracts`.
- **Source File Cap**: Files must strictly obey the 300 LOC hard ceiling (`check-code-norms.mjs`).

## 2. Platform Authentication & Authorization

| Concern | Tenant Workspace | Platform Console |
|---|---|---|
| **Middleware** | `authenticateTenant` | `authenticatePlatform` |
| **User Subject** | `tenant_users` | `platform_users` |
| **Permission Check** | `can(action, resource)` | `platformUserCan(permission)` / `requirePlatformPermission` |
| **Session Cookie** | `mms_tenant_session` | `mms_platform_session` |
| **Context** | Bound to `tenantId` via RLS | Apex admin context (no tenant isolation barrier) |

### Authorization Guards
```typescript
// Fastify Route PreHandler
fastify.get('/api/platform/workspaces', {
  preHandler: [authenticatePlatform, requirePlatformPermission('workspaces:read')],
  handler: handleListWorkspaces,
});
```

For platform permission keys, RBAC mappings, and capability matrices, see [references/platform-permissions-matrix.md](references/platform-permissions-matrix.md).

## 3. Implementation Map

| Layer | Path / Symbol |
|---|---|
| Frontend Shell & Routes | `apps/platform-web/src/platform/routes/ApexRoutes.tsx`, `apexRouteRegistry.ts` |
| Feature Modules | `apps/platform-web/src/platform/features/{feature}/` (`{Feature}Page.tsx`, `components/`, `hooks/`, `lib/`) |
| Shared Shell / Auth | `apps/platform-web/src/platform/features/shell/`, `platform/features/auth/` |
| Frontend Auth Context | `apps/platform-web/src/platform/features/auth/lib/PlatformAuthContext.tsx` |
| Query Keys Factory | `apps/platform-web/src/platform/features/shell/lib/platformQueryKeys.ts` |
| Backend Routes | `packages/modules/platform/src/backend/platform/routes/` |
| Backend Auth Middleware | `apps/api/src/middleware/authenticatePlatform.ts` |
| Architecture Guard Test | `apps/platform-web/src/platform/platformUiArchitecture.test.ts` |
| E2E Tests | `e2e/tests/platform/` |

## 4. Verification

```bash
pnpm --filter mms-platform-web typecheck
pnpm --filter mms-api typecheck
pnpm --filter mms-platform-web test apps/platform-web/src/platform/platformUiArchitecture.test.ts
pnpm run check:shared-ui
```

## Related skills

`mms-shared-ui`, `mms-backend-api`, `mms-backend-security`, `mms-module-page`.
