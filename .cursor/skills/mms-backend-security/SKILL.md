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
- **OAuth Connect Flows (Google Contacts)**: `state` carries a per-attempt random nonce stored one-shot in `sessionStorage` (≤10 min TTL) and verified before the code exchange; a constant `{source: …}` marker is not CSRF protection. Keep the server-side redirect-URI host/path allowlist as the second gate.
- **CORS**: `credentials: true`; production requires explicit domain allowlist (`ALLOWED_ORIGIN`).

### Module gates and self-service carve-outs

- **Reachable denial codes**: `required: true` modules (`dashboard`, `contacts`, `messaging`, …) can never be disabled or un-granted, so they only produce `PERMISSION_DENIED`. A denial test that expects `MODULE_DISABLED` for a required module gets a 500 from the ungated handler instead of a 403.
- **`availability` action**: routes whose handler owns a finer rule (self-service own-record edits, personal preferences) use `MODULE_ROUTE_ACTION_RULES` `action: 'availability'`; the handler must enforce the permission **and** a field whitelist (`OWN_CONTACT_PATCH_KEYS` + `ownContactPatchBodySchema`), never the module write DTO.
- **Server-owned projections**: write permission never implies control of derived/system-managed fields (role tags, computed status, provenance). Strip them before validation and at the write choke point; bulk endpoints reject reserved values with `400` (mass-assignment guard).
- **Cross-module reads**: a module grant authorizes that module's purpose only. Borrowing another module's records requires a lean DTO plus the owner's viewer sanitizer (`sanitizeContactsForViewer`); never return the owner's full read shape. A messaging-only role must not receive contact notes/DOB/addresses.
- **Upload gates**: `/attachment` upload/delete require the owning module action (`canWriteCollection(user, 'contacts')`), not merely a session; tenant sessions must not read root-level non-public uploads.

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
# Cross-module reads + upload gates
cd apps/backend && pnpm test -- src/__tests__/messagingRecipientsService.test.ts src/__tests__/uploadsHardening.test.ts
```

## Related skills

`mms-backend-api`, `mms-backup-restore`, `mms-code-review`.
