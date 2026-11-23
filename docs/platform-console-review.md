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
- **Super-user tenant sync**: replicates the platform super-user password hash into every tenant `tenant_users` row (break-glass SSO). **Opt-in since 2026-11-23** (`PLATFORM_SYNC_SUPERUSER_TO_TENANTS=true` to enable; default disabled — see the update section below); documented in-source.
- **`ErdMermaidDiagram`** renders mermaid SVG via `dangerouslySetInnerHTML` with `securityLevel: "strict"` — acceptable.
- **`PostgreSQL 16`** engine fallback and the `min` unit suffix: technical/invariant copy.

## Update 2026-11-23 — Madrasa provisioning identity contract

Workspace provisioning (`POST /api/auth/onboard` → `onboardUser`) now enforces a single apex tenant identity:

| Rule | Implementation |
|---|---|
| The admin entered in the wizard is the tenant's **only** `super_admin` | `provisionWorkspaceAdmin` creates the user as `super_admin`, then fails closed (500) unless `listWorkspaceSuperAdminIds` returns exactly that user |
| The admin is the madrasa's **first contact** | `createAdminFirstContact` writes the linked `contacts` row (`name`, primary email, optional phone) and stamps `tenant_users.contact_id` |
| **No platform user is ever added to a tenant** | `createWorkspace` no longer mirrors the platform super-user; the mirror is opt-in (`PLATFORM_SYNC_SUPERUSER_TO_TENANTS=true`) and creation never mirrors even when opted in |
| Platform "Create Admin" / password-reset fallback cannot create a second super_admin | The role is promoted to `super_admin` only when the workspace has no active super_admin; later admins stay `admin` |

Evidence: `apps/backend/src/__tests__/workspaceAdminProvisioning.test.ts`, `workspaceAdminUserRepository.test.ts`, `contactAdminSeedUseCases.test.ts`, `platformSuperUserTenantSync.test.ts`, and the SQL invariant assertions in `e2e/tests/platform/platform-onboarding.spec.ts`.

## Confirmed no-change security decisions (user-approved)

1. Workspace-ops hardening → **leave as-is** (area-grant-only).
2. Session extension → **keep idle-only**.

## E2E consistency

Reviewed `platform-console-critical.spec.ts`, `platform-admin-management.spec.ts`, `platform-onboarding.spec.ts`. None assert on the changed 409/404/error-type behavior; all use super-user or happy paths, so no assertion updates were required. Playwright execution was not run (requires the full Postgres + dev-server stack).

## Modern web best practices audit

Audited `apps/frontend/src/platform` against `mms-core` Baseline (§19), `mms-ui-ux-design` §1, and `mms-performance` §38. **Compliant — no code changes required.**

| Dimension | Result |
|---|---|
| Deprecated APIs / polyfills | none (`document.execCommand`, `XMLHttpRequest`, `navigator.userAgent`, `window.event`, `orientationchange`, `unload`, `core-js`, `regenerator` all absent) |
| Motion scaling | `useReducedMotion()` honored on every animated surface |
| Image priority (LCP) | the only `<img>` (sidebar logo) uses `fetchPriority="high"` + `decoding="async"` + `loading="eager"` |
| Scroll/motion listeners | no raw `scroll`/`resize`/`touchmove`/`wheel` listeners |
| Arbitrary CSS | no `z-[…]`/font-size bracket classes |
| `dangerouslySetInnerHTML` | only mermaid SVG behind `securityLevel: "strict"` |

**Out-of-scope observation:** platform dialogs/popovers/dropdowns/tooltips consume `@shared/ui` **Radix** primitives, not the native declarative **popover/`<dialog>` + `@starting-style` + light-dismiss** pattern `mms-ui-ux-design` §1 targets. This is correct at the platform layer (its architecture test bans native `<dialog>`/`<button>`/…, so it must use shared primitives); the shared `Toast` already exposes the declarative Top-Layer API (`popover="manual"`, `popovertargetaction="hide"`). Migrating the remaining shared overlays is a `packages/ui` cross-cutting task, not a platform-console defect.

> The `modern-web-guidance` CLI could not be invoked during this audit — pnpm `dlx` cache is outside the workspace sandbox (EPERM on `~/Library/Caches/pnpm/dlx`) — so the audit was performed against the rule criteria directly.

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

## Update 2026-11-23 (2) — Provisioning data capture and platform-owned madrasa name

| Rule | Implementation |
|---|---|
| No terms-of-service checkbox when a platform admin creates a madrasa | Removed from the onboarding wizard (`AdminSetup`), its validation, and the `onboarding.agreeTerms` / `onboarding.errorTerms` keys |
| Administrator gender is collected and stored in the tenant contacts record | Required `#gender` select (tenant lookup values `male`/`female`) → `onboardBodySchema.adminGender` → `createAdminFirstContact` writes `contacts.gender` on the linked first contact |
| Collected admin data is stored in the console database as well as the tenant | New nullable `workspaces.admin_name/admin_email/admin_gender` columns written atomically by `createWorkspace`/`insertWorkspaceRow`; the workspace list/summary exposes `adminName`/`adminGender` and prefers the stored admin email (legacy rows fall back to the tenant-user scan) |
| The collected madrasa name is stored in the console database | Already persisted on `workspaces.madrasa_name` at creation (now asserted by unit + E2E checks) |
| Only the platform console can change the madrasa name | Tenant branding writes (`/api/db/objects/branding`) and backup restore now pass `preserveMadrasaName` so `madrasa_name` is omitted from the SQL write; tenant UI renders the name read-only with the managed hint; new platform-only `PATCH /api/platform/workspaces/:subdomain/name` + "Rename Madrasa" row action/dialog (audited as `rename_workspace`) |
| Super-admin parity for the provisioned apex admin | 2FA enforcement, users metrics, restore admin/credential guards, and primary-admin ordering now treat `super_admin`/`super_user` as admin-capable |

## Update 2026-11-23 (3) — Password modes, institution persistence, tenant user hardening

| Rule | Implementation |
|---|---|
| Two ways to give the super admin their first password | Onboarding contract requires `adminPasswordMode`: `email` (we default to no password and email an activation link) or `temporary` (operator supplies password + confirmation). The API rejects a password in email mode and a missing password in temporary mode; the onboarding response reports `inviteEmailSent`/`inviteEmailError` and the wizard warns when the email could not be sent |
| Settings → Institution persists everything to PostgreSQL | Branding writers hydrate the full record from `GET /api/db/objects/branding` at tenant boot (`useHydrateBranding`); branding is no longer title-cased client-side; identity/theme saves merge only the fields the user changed onto a freshly fetched server record (no clobbering of untouched or not-yet-hydrated fields) |
| Tenant admin-created users can sign in with their temporary password | Password-mode creation now marks the address verified (admin-vouched, like invite activation), rejects a password-mode create without a password, and an admin password reset also verifies the address; platform-created admins are verified for the same reason |
| Only the platform console owns the apex super admin | `canAssignRole`/`filterAssignableRoles` reject platform-managed roles for every actor; tenant create/invite/bulk/import/update reject creating, promoting to, or demoting from `super_admin`; the Users module shows the apex account read-only with a "Platform-managed" badge |
