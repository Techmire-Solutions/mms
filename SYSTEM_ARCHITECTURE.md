# System Architecture — MMS Monorepo

The Madrasa Management System (MMS) is a multi-tenant enterprise platform architected for educational administration, double-entry financial accounting, student management, academic performance tracking, and communications.

---

## 1. Monorepo Topology & Boundaries

```
mms/
├── apps/
│   ├── backend/        # Fastify 5 + Node.js 24 + PostgreSQL 16 + Drizzle ORM + BullMQ
│   └── frontend/       # React 19 + Vite 8 + Tailwind CSS v4 + TanStack Query v5
├── packages/
│   └── shared/         # @mms/shared: Zod DTOs, interfaces, pure utilities, manifests (SSOT)
├── e2e/                # Playwright end-to-end integration and accessibility suites
├── scripts/            # Build, deploy, ratchet, and validation tooling
└── .agent/             # Tri-mirrored agent configuration (.agent, .cursor, .claude)
```

Repository documentation is indexed in [`docs/README.md`](docs/README.md); decisions live in
[`docs/adr/`](docs/adr/).

### Layer Constraints & Responsibilities

| Layer                        | Path                                          | Responsibilities & Boundaries                                                                                                                    |
| ---------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Shared Contracts (SSOT)**  | `packages/shared/`                            | Strict Zod 4 DTOs, TypeScript interfaces, module manifests, pure math/formatting utils. **Zero** DOM, React, Fastify, or SQL dependencies.       |
| **Frontend UI Primitives**   | `apps/frontend/src/components/ui/`            | Reusable UI chrome, design tokens, Radix UI wrappers. Pure presentation with zero feature-domain imports.                                        |
| **Frontend Shared Lib**      | `apps/frontend/src/lib/`                      | Application-wide apiClient, TanStack Query factories, i18n configurations, currency formatting.                                                  |
| **Frontend Tenant Features** | `apps/frontend/src/tenant/features/{module}/` | Module pages, presentation sub-components, custom hooks. Cross-feature imports are forbidden; communication occurs via facades or `@mms/shared`. |
| **Backend API Routes**       | `apps/backend/src/routes/`                    | HTTP request/response handlers, schema validation via `parseRequest`, route composition roots.                                                   |
| **Backend Clean Domain**     | `apps/backend/src/{module}/`                  | Clean Architecture domain layers: `use-cases/` (business logic) and `repository/` (Drizzle storage adapters).                                    |

---

## 2. Interface Contracts & API Boundaries

MMS enforces end-to-end contract type safety through `@ts-rest` contracts and Fastify REST endpoints backed by Zod schemas in `@mms/shared`.

### Core API Namespaces

- **Tenant Auth & Session:** `/api/auth/*` — Session cookies, password login, OTP verification, 2FA, tenant switching.
- **Tenant Domain Modules:**
  - `/api/students/*` — Student directory, admissions, enrollments, guardianship.
  - `/api/contacts/*` — Canonical contact registry, duplicate detection, profile hydration.
  - `/api/faculty/*` — Teacher registry, designations, employment status.
  - `/api/accounting/*` — Chart of accounts, journal entries, trial balance, P&L, balance sheet, fiscal years.
  - `/api/finance/*` — Student fees, invoices, payments, discounts.
  - `/api/hasanat/*` — Merit point allocations, badge distributions, reward redemption.
  - `/api/attendance/*` — Daily session logs, absence tracking, aggregate attendance percentages.
  - `/api/examinations/*` — Exam terms, grading scales, student grade entry, report cards.
  - `/api/messaging/*` — SMS and WhatsApp campaigns, dispatch queues, template variables.
- **Platform Management:** `/api/platform/*` — System tenant provisioning, platform audit logs, global settings.

---

## 3. Runtime Data Validation & Schemas

Compile-time types are paired 1:1 with runtime Zod schemas. Untyped payloads are rejected at the boundary.

- **Write Operations:** All `POST`, `PUT`, and `PATCH` endpoints enforce strict Zod schemas with `.strict()`.
- **Primary Keys:** Sequential UUIDv7 (RFC 9562) generated via `node:crypto` / UUIDv7 utilities for distributed sorting and index locality.
- **Financial Decimal Strings:** Monetary values are modeled as strict regex strings (`/^\d+(\.\d{1,2})?$/`) to prevent IEEE 754 floating-point rounding errors.
- **Phone Numbers:** E.164 standardization via `parsePhoneNumber`.

---

## 4. Frontend Architecture & State Management

MMS uses React 19 with a strict separation of concerns:

1. **Server State (SSOT):** Managed exclusively by TanStack Query v5 (`@tanstack/react-query`). Query options factories and tuple query keys ensure predictable cache invalidation and background refetching.
2. **Local Client State:** Lightweight Zustand 5 stores for transient UI states (sidebar toggles, modal dialogs, search filters).
3. **Presentation vs Logic Decoupling:**
   - Source files must remain under the **300-line hard cap** (ratcheted by `pnpm run check:code-norms`; prefer ≤220 for new shells).
   - UI components receive render props and trigger callbacks; all data queries, cache invalidations, and computations live in custom hooks.
4. **BiDi & Semantic Styling:** Tailwind CSS v4 design tokens (`bg-primary`, `text-foreground`, `border-success`, `bg-destructive`) and logical spacing (`ms-`, `me-`, `ps-`, `pe-`) support right-to-left (Arabic/Urdu) and left-to-right (English) layouts.

---

## 5. Backend Clean Architecture & Persistence

Backend modules follow Clean Architecture principles:

```
apps/backend/src/{module}/
├── use-cases/
│   ├── {module}UseCases.ts          # Composition root (factory + singleton) & DI wiring
│   └── {concern}UseCases.ts         # Business logic interactors
└── repository/
    ├── {module}Repository.ts        # Port: storage interface (types only)
    └── {module}RepositoryAdapter.ts # Adapter: binds the port to db/repositories SQL
```

- **Ports & Adapters over `db/repositories/`:** the real Drizzle/SQL lives in
  `apps/backend/src/db/repositories/**` — the only layer that imports `drizzle-orm`. The domain
  `{module}/repository/{module}RepositoryAdapter.ts` is a thin binding of that SQL to the module's port
  (it contains no SQL itself). The enforced direction is
  `routes → use-cases → port → adapter → db/repositories`. Route files must not import
  `db/repositories`/`drizzle-orm` (`check:backend-boundaries`, baseline 0); use-case/service storage
  imports are ratcheted down by `check:backend-structure`.
- **PostgreSQL 16 & Drizzle ORM:** Normalized 3NF/BCNF schemas, typed columns, foreign keys with referential integrity.
- **Tenant Isolation:** Transaction-scoped Row Level Security (`SET LOCAL app.current_tenant = ...`).
- **Soft Deletion:** Tenant entity tables implement `deleted_at timestamp with time zone` with partial indexes (`WHERE deleted_at IS NULL`).
- **Compiled Prepared Statements & Column Projections:** High-throughput read lookups utilize compiled PostgreSQL prepared statements via modularized descriptors (`preparedStatements.ts` and `preparedColumns.ts`), enforcing strict typing without `any` and adhering to the 300 LOC ceiling.
- **Relational Soft-Delete Guardrails:** Dynamic query wrappers in `dbClient.ts` inject soft-delete conditions (`isNull(deletedAt)`) across nested relations with strongly typed helper callbacks.
- **Asynchronous Workers:** Long-running exports, imports, and bulk message dispatches are executed in background BullMQ 6 worker queues backed by Redis 7.

---

## 6. Protected Zones & Guardrails

To prevent critical system disruptions, the following infrastructure zones require explicit, logged user authorization prior to modification:

1. **Database Migrations:** `apps/backend/src/db/migrations_drizzle/` and `migrations/`.
2. **Authentication Middleware:** `apps/backend/src/middleware/authenticate*.ts` and `apps/backend/src/services/auth/`.
3. **CI/CD & DevOps:** `.github/workflows/`, `Dockerfile*`, and deployment scripts.
4. **Global Build Tooling:** `tsconfig.json`, `tailwind.config.js`, `vite.config.ts`, `turbo.json`.
5. **Third-Party Dependencies:** New package additions require prior evaluation.

---

## 7. Automated Verification & Quality Gates

All contributions and agent executions must pass the four-tier verification gate:

1. `pnpm typecheck` — Strict TypeScript checking across all workspaces.
2. `pnpm test` / `vitest run` — Unit, component, and API integration suites.
3. `node scripts/check-code-norms.mjs` — Zero new `any` annotations, zero raw hex colors, and file size constraints.
4. `node scripts/verify-rules-integrity.mjs` — Perfect alignment across `.agent/`, `.cursor/`, and `.claude/`.
