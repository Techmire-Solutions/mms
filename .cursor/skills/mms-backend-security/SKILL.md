---
name: mms-backend-security
description: Finds and fixes MMS backend auth weaknesses — tenant isolation, RBAC gaps, cookie/CSRF/Origin handling, rate limits, and session flows. Use when hardening or auditing a security mechanism (correctness of the control itself). Do NOT use for general route implementation (use mms-backend-api), for reviewing an unrelated change set (use mms-code-review), or for encrypted backup crypto (use mms-backup-restore).
license: Proprietary
metadata:
  owner: mms-platform
  last-verified: 2026-10-16
---

# MMS Backend Security Workflow

**Rules (norms SSOT):** `mms-auth-security.mdc` · `mms-data-layer.mdc` §5–§6. Route checklist → `references/route-audit-checklist.md`. RBAC surfaces → `references/auth-rbac-matrix.md`.

## When to use

- Hardening or auditing auth, CSRF, cookies, Origin, rate limits, or session flows
- Verifying tenant isolation / RBAC correctness of a control (not general route CRUD)

## Checklists

| Topic | File |
|-------|------|
| Route audit | `references/route-audit-checklist.md` |
| RBAC matrix | `references/auth-rbac-matrix.md` |

Token persistence: `authArtifactService`. Cookie names below are authoritative.

## 1. Middleware Architecture & Routing Gates

- **Tenant Protected Routes**: Enforce `authenticateTenant` (`middleware/authenticate.ts`). Validates JWT, verifies `user.workspaceSubdomain === tenant`, checks `twoFactorVerified !== false`, and confirms non-refresh token type.
- **Platform Protected Routes**: Enforce `requireMainDomain` + `authenticatePlatform` (`middleware/authenticatePlatform.ts`). Binds strictly to apex host, validates `mms_platform_access` cookie, checks `tokenType === 'platform_access'`, and verifies user is active against database.
- **Ban Raw Verification**: Raw `request.jwtVerify()` calls in route handlers are strictly banned.
- **Mutual Exclusion**: Issuing/clearing a platform session immediately clears tenant cookies; logout clears both.

## 2. Session Cookies & CSRF Standards

- **Cookie Hygiene**:
  - `mms_access`: Tenant JWT, HttpOnly, 15m lifetime, `SameSite=Lax`, `Secure`, `Path=/`.
  - `mms_refresh`: Opaque refresh token hash, HttpOnly, `Path=/api/auth/refresh`.
  - `mms_platform_access`: Platform session JWT, HttpOnly, `Path=/` (must be `/` so the cookie is sent to `/api/auth/onboard` and apex `/api/uploads`, not only `/api/platform`).
- **CSRF Protection**: Double-Submit Token. Mutating requests (`POST`/`PUT`/`DELETE`) must match CSRF cookie via `X-CSRF-Token` header.
- **CORS**: `credentials: true`; production requires explicit domain allowlist (`ALLOWED_ORIGIN`).

## 3. Cryptographic & Storage Invariants

- **Ephemeral Auth State**: Persist tokens in `auth_artifacts` table via `authArtifactService` (handoff: 2m, 2FA challenge: 10m, refresh token: 7d with single-use rotation). In-memory token storage is banned.
- **Timing Safety**: Use `crypto.timingSafeEqual` for all password, token, and OTP comparisons.
- **Hashing**: Use native single-shot `crypto.hash()` from `node:crypto`.
- **Rate Limiting**: Protect auth endpoints (`/login`, `/onboard`, `/2fa/*`) with 10 req/min limits; emit `Retry-After` on 429.
- **Zero Secret Leakage**: Never log passwords, tokens, OTP codes, or PII payloads.

## 4. Security Verification

Execute the backend security test matrix when modifying auth or route handlers:

```bash
cd apps/backend && pnpm test -- src/__tests__/app.security.test.ts src/__tests__/auth.integration.test.ts src/__tests__/rbacService.test.ts
```

## Related skills

`mms-backend-api`, `mms-backup-restore`, `mms-code-review`.
