---
trigger: model_decision
description: Authentication session cookies, JWT token scopes, tenant isolation context, RBAC matrices, and threat mitigations
---

# MMS Auth & Security System

**Workflow skill:** `mms-backend-security` (CSRF/Origin, cookies, RBAC, tenant isolation) · audit trail security → `mms-audit-trail`. Route/service wiring → `mms-backend-api`.

## 1. Authentication & Session Management
- **Tenant Workspace Cookies:** HttpOnly `mms_access` (15m JWT, `SameSite=Lax`, `Path=/`) and `mms_refresh` (7d rotated opaque token, `Path=/api/auth/refresh`).
- **Platform Apex Cookies:** HttpOnly session cookie `mms_platform_access` (cleared on browser close). JWT signs `{ id, tokenType: 'platform_access', sessionVersion }` (~8h max). No refresh cookie. Platform login clears tenant cookies.
- **Client Hygiene:** Always `credentials: 'include'`. Never store JWTs in `localStorage`.
- **Platform Session Probe:** `PlatformAuthProvider` calls `GET /api/platform/auth/me` on boot; unauthenticated returns `200 { user: null, isAuthenticated: false }`.
- **Session Revocation:** JWT `sessionVersion` mismatch with DB returns `401 { type: 'session_revoked' }`. Soft-deleting accounts revokes all active sessions immediately; resolvers verify `deleted_at IS NULL`.
- **Auth Artifacts (`auth_artifacts` table):** Ephemeral challenges: `handoff` (2m), `two_factor_challenge` (10m), `refresh_token` (7d, indexed `lookup_key`), `login_email_change` (10m). Purged via scheduled `purgeExpiredAuthArtifacts`.

## 2. Multi-Tenant Routing & Isolation
- **Host Routing:** Apex (`localhost` / `MMS_APP_DOMAIN`) vs Tenant (`{slug}.localhost` / `{slug}.{MMS_APP_DOMAIN}`). Unregistered tenants redirect to `/tenant-not-found?subdomain=…`.
- **Context Binding:** Parse tenant from `Host` or `X-Forwarded-Host` into `tenantStorage` (`AsyncLocalStorage`). Never trust tenant or user IDs from request bodies.
- **Tenant Route Protection:** `authenticateTenant` validates JWT, verifies workspace is enabled, checks 2FA, and binds `userId`. Apex requests to tenant routes return `403`.
- **Platform Route Protection:** All `/api/platform/*` routes require `authenticatePlatform` and apex host (`requireMainDomain`). Capability gates: `requireSuperUser`, `requirePlatformPermission`, and `platformUserCan`.

## 3. Role-Based Access Control (RBAC)
- **Frontend Gates:** Use `can('permission.string')` via `usePermissions`, or `useModulePermissions(MANIFEST)` (`canWrite`, `canDelete`, `canExport`, `canViewSetup`). Never OR write gates with `canEditSetup`. Omit unauthorized elements from DOM (no disabled placeholders).
- **Backend Enforcement:** Enforce in route preHandlers (`canWriteCollection`). Denials return `403 { type: 'forbidden' }`. Soft-delete mutations and trash queries require delete privileges (`canDeleteCollection`).
- **Module Access Gates:** Every module-owned route, UI entry point, and backend operation declares and enforces its module and action requirements; frontend visibility is not a security boundary. Policy SSOT is `@mms/shared` `moduleAccessPolicy.ts` (platform grant → tenant enablement → action permission; denial codes `MODULE_NOT_GRANTED` / `MODULE_DISABLED` / `PERMISSION_DENIED` / `MODULE_ACCESS_UNAVAILABLE`, sent as `403 { type: 'forbidden', code, moduleId }`).
  - **Backend:** module plugins call `registerModuleAccess(fastify, moduleId)` right after `authenticateTenant`; actions default by method and are overridden only in `MODULE_ROUTE_ACTION_RULES` (`lib/moduleRouteActions.ts`) or `config.moduleAction`. Per-request modules use `getModuleAccessDenial` / `enforceModuleAccess`; jobs re-check at execution. Availability comes from the workspace row and the current role matrix, fails closed, and is invalidated through the live-update broadcast.
  - **Frontend:** every app-shell route is classified in `TENANT_APP_ROUTE_ACCESS`; `ModuleAccessRoute`, sidebar, command palette, quick actions, and dashboard widgets all evaluate `useModuleAccess()` (server snapshot, never persisted). Non-module routes are classified explicitly, never exempted by omission.

## 4. Threat Mitigations & Security Checklist
- **IDOR Defense:** Authorize via permissions + transaction RLS (`SET LOCAL app.current_tenant`). Bind IDs strictly from session context.
- **Rate Limiting:** Redis-backed sliding window on public auth, messaging, and destructive routes. Return `429 { type: 'rate_limit_exceeded' }` with `Retry-After`.
- **Credential Redaction:** Passwords, tokens, OTPs, and cookies must never appear in logs or stdout. Fastify enforces `LOG_REDACTION_OPTIONS`. CI scans full git history via `gitleaks`.
- **CSRF & Cookies:** State-changing requests enforce same-origin verification (`Origin` / `Sec-Fetch-Site`). Production cookies require `Secure`, `SameSite=Lax`. CORS requires explicit `ALLOWED_ORIGIN` (no wildcard with credentials).
- **Security Headers:** `@fastify/helmet` with `frame-ancestors 'none'` (`X-Frame-Options: DENY`), `nosniff`, HSTS, and strict CSP.
- **SSRF Defense:** Outbound fetches enforce timeouts and block private/loopback/cloud-metadata IP ranges (`127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.169.254`).
- **Cryptography:** Use `scrypt` + `crypto.timingSafeEqual` for passwords/OTPs; `crypto.randomInt()` for OTP generation (`Math.random()` banned).
- **XSS & Injection:** Ban unsanitized `dangerouslySetInnerHTML`; sanitize formula triggers (`=`, `+`, `-`, `@`) in CSV/Excel/PDF cell exports.
- **Hard-Delete Guard:** Schema `forbid_hard_delete()` trigger blocks SQL deletes. Bypass requires `SET LOCAL app.allow_hard_purge = 'true'`.

## 5. Audit Trail Security, Governance & Trace Context
- **Security & Privilege Hardening:** Audit trail cryptographic chaining, RFC 8785 canonical JSON, and outbox transactions follow `mms-data-layer.md` §5. Propagate W3C `traceparent` via `AsyncLocalStorage` (`AsyncContextFrame`) as `correlation_id`. Database user has `INSERT`-only rights on audit tables; viewing audit logs is an auditable event.

