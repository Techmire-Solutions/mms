# Platform Console Module — Review Record

Date: 2026-11-17 · Scope: `apps/frontend/src/platform`, `apps/backend/src/routes/platform`, `apps/backend/src/platform`, `apps/backend/src/services/platform`, `apps/backend/src/middleware/authenticatePlatform.ts`, platform contracts/schemas in `@mms/shared`, and `e2e/tests/platform`.

## Method

Three read-only review passes over the module, each followed by minimal, test-backed fixes:

1. **Core remediation** — auth middleware, route gating, contracts/DTOs, backend handlers, LTR lock.
2. **Completion review** — remaining backend services + consolidation domain; i18n hardcoded-copy sweep.
3. **Frontend confirmation sweep** — remaining pages/dialogs/directory views/shell; permission-gating consistency.

Dimensions checked throughout: platform auth/authorization, `.strict()` Zod DTOs, Tenant=Platform parity (`@shared/ui`, no forked primitives), 300-LOC cap, LTR lock + English-only, backend boundary (routes → use-cases, never repository adapters), i18n key usage, and a11y on interactive primitives.

## Findings

### Fixed

| # | Severity | Area | Finding | Fix |
|---|---|---|---|---|
| 1 | Medium | `@mms/shared` schema | `platformSettingsDtoSchema` omitted `emailNotifications`/`smsNotifications`/`whatsAppNotifications` and lacked `.strict()`; the settings service actually returns those fields, forcing `as PlatformSettings` casts. | Added fields + `.strict()`; `tlsExtraSans` made required to match `PlatformSettings`. Parity test added. |
| 2 | Medium | `@mms/shared` contract | `setupRegister` declared only 200/400/403 but a second registration returns **409** (`setup_not_needed`). | Declared `409`. |
| 3 | Medium | `@mms/shared` contract + backend | `getWorkspaceModules` declared 404 but never returned it; `updateWorkspaceModules` had no 404 and no existence check; `patchWorkspace` could emit `workspace: undefined`. | Added existence checks → 404 in the handlers; declared 404 in `updateWorkspaceModules`; made `patchWorkspace` 404 on missing summary. |
| 4 | Low | `@mms/shared` contract | `getSessionPolicy` / `getErd` / `getTelemetry` / `getActivityTrend` used `z.unknown()` client stubs. | Gave `getSessionPolicy` a real schema; documented the remaining three as backend-owned stubs so they cannot silently drift. |
| 5 | Low | backend | `handlePlatform2FAResend` returned `404 { type: "invalid_credentials" }` for a missing/expired challenge — misleading. | New `challenge_not_found` error type (shared union + frontend mapping). |
| 6 | Low | backend | `handleVerifyTenantUserEmail` did a redundant `findTenantUserRowById` + `verifyTenantUserEmailRow` double lookup. | Removed the redundant first lookup. |
| 7 | Very low | frontend | `PlatformSidebarNav` sourced `dir` from translation despite the console being LTR-locked; 10 components carried dead `rtl:` classes. | Pinned `dir="ltr"`; removed dead `rtl:` classes. |
| 8 | Low | frontend i18n | Hardcoded English in `PlatformDatabaseTelemetryCard` and `PlatformUsersReportsTier` (pool labels, replica status, RLS badge, near-cap warning, two aria-live announcements, reports labels, governance title). | Added 15 `platform.db.*` / `platform.reports.*` keys across en/ar/ur/fa and wired them through `t()`. |
| 9 | Low | frontend gating | Work-tier admin directory exposed create/edit/disable/delete to any `admins`-grant holder, but the backend restricts those to `super_user` (only list + verify-email are `admins`-grant). Backend was already the security boundary; this was a UX inconsistency that also contradicted the setup-tier `PlatformPermissionMatrix`. | `PlatformUsersPage` "Add Admin" gated on `isSuperUser`; `PlatformAdminActionButtons` hides edit/disable/delete for non-super-users (verify-email remains). |

### Reported — confirmed intentional / no change

- **Workspace-ops step-up** (`patchWorkspace`, `updateWorkspaceModules`, `patchWorkspaceEmailVerification`, `verifyTenantUserEmail`): gated by the `workspaces` grant with no password step-up. Confirmed intentional per the permission matrix ("suspend or configure tenant workspaces") and the security matrix.
- **Session extension**: `/session/extend` resets only the idle clock; the 8h absolute JWT lifetime is fixed. Confirmed intentional (absolute-lifetime control).
- **Super-user tenant sync**: replicates the platform super-user password hash into every tenant `tenant_users` row (break-glass SSO). Env-gated (`PLATFORM_SYNC_SUPERUSER_TO_TENANTS=false` to disable); documented in-source.
- **`ErdMermaidDiagram`** renders mermaid SVG via `dangerouslySetInnerHTML` with `securityLevel: "strict"` — acceptable.
- **`PostgreSQL 16`** engine fallback and the `min` unit suffix: technical/invariant copy.

## Confirmed no-change security decisions (user-approved)

1. Workspace-ops hardening → **leave as-is** (area-grant-only).
2. Session extension → **keep idle-only**.

## E2E consistency

Reviewed `platform-console-critical.spec.ts`, `platform-admin-management.spec.ts`, `platform-onboarding.spec.ts`. None assert on the changed 409/404/error-type behavior; all use super-user or happy paths, so no assertion updates were required. Playwright execution was not run (requires the full Postgres + dev-server stack).

## Verification matrix

| Gate | Result |
|---|---|
| `mms-backend` typecheck | pass |
| `mms-frontend` typecheck | pass |
| `@mms/shared` typecheck | pass |
| backend Vitest | 575 files / 4098 tests pass |
| frontend Vitest | 1299 files / 4835 tests pass |
| `@mms/shared` Vitest | 297 files / 2451 tests pass |
| `check:shared-ui` | clean (0 violations) |
| `check:i18n` | 0 missing / 0 EN-fallback (en/ar/ur/fa) |
| `check:i18n-unused` | ratchet held |
| 300-LOC cap | no platform file exceeds 300 lines |
