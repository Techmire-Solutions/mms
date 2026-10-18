# @mms/shared Package Guidelines & Export Standards

This guide outlines runtime purity invariants, domain organization, schema declarations, and export conventions for `@mms/shared`.

---

## 1. Runtime Purity Invariants

`@mms/shared` is consumed equally by Node.js backend processes and browser frontend bundles:
- **Zero Framework Code**: No React (`useState`, `jsx`), no Fastify (`FastifyRequest`, `FastifyReply`), no Express.
- **Zero DOM / Browser Globals**: Never reference `window`, `document`, `localStorage`, `sessionStorage`, or `navigator`.
- **Zero Node Builtins**: Never import `node:fs`, `node:path`, `node:child_process`, or `node:crypto`.
- **Zero Database / ORM Code**: No `drizzle-orm` or `pg` imports.
- **Inversion of Control**: When shared utilities need runtime environment context (e.g., active currency or locale), use dependency injection or provider registration functions (e.g. `registerFinanceCurrencyProvider`).

Machine-enforced by `pnpm run check:shared-purity` and `scripts/check-shared-exports.sh`.

---

## 2. Directory & Domain Organization

The `packages/shared/src/` root contains ONLY `index.ts`. All code belongs to domain subdirectories:
- `packages/shared/src/core/`: Common types, pagination, soft-delete, formatting utils.
- `packages/shared/src/auth/`: User roles, permissions, token payloads.
- `packages/shared/src/contacts/`: Contact DTOs, address schemas.
- `packages/shared/src/finance/`: Monetary amounts, currency math, invoice schemas.
- `packages/shared/src/messaging/`: SMS and WhatsApp campaign DTOs.
- `packages/shared/src/settings/`: Tenant configuration, branding, navigation definitions.
- `packages/shared/src/i18n/`: Translation key schemas and locale enumerations.

---

## 3. Canonical Schema Idioms

Never re-declare canonical date or monetary schemas:
- **Date**: Always use `isoDateSchema` or `isoDateOrEmptySchema`.
- **Money**: Represent money as decimal string (`"125.50"`) or integer cents, validated through shared financial schemas.
- **Write DTOs**: Always append `.strict()` to write schemas to reject unknown payload keys.
