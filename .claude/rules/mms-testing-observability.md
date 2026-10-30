---
description: Testing strategy (unit, API inject, Playwright E2E), coverage gates, isolation, and error reporting
paths:
  - "packages/shared/**/*.test.ts"
  - "apps/backend/src/**/*.test.ts"
  - "apps/frontend/src/**/*.test.ts"
  - "apps/frontend/src/**/*.test.tsx"
  - "apps/backend/vitest*.config.ts"
  - "apps/frontend/vitest*.config.ts"
  - "packages/shared/vitest*.config.ts"
  - "e2e/**"
  - "apps/frontend/src/components/app/ErrorBoundary.tsx"
  - "apps/frontend/src/lib/clientErrorReporting.ts"
---

# MMS Testing & Observability

**Workflow skills:** PR/self-review gates → `mms-code-review` · axe/focus-return smoke → `mms-a11y-smoke` · automated testing workflows → `mms-testing-e2e`.

## 1. Testing Strategy & Execution Invariants
- **Test-first delivery:** Red → Green → Refactor is owned by `mms-tdd.md` (advisory pairing check: `pnpm run check:tdd-pairing`). The rules below govern how that spec is written and run.
- **Workspace Test Execution:**
  - Unit/Integration: `pnpm test` (root turbo) · `pnpm --filter mms-backend test:coverage` · `pnpm --filter @mms/shared test:coverage`.
  - Backend DB/RLS Integration: `pnpm --filter mms-backend run test:db` (requires live PostgreSQL).
  - Browser E2E: `pnpm test:e2e` (root) or `pnpm --filter e2e-tests exec playwright test tests/<spec>.spec.ts`.
- **Deterministic Execution (Zero Skip Latches):** Banned: conditionally-skipping tests (`if (!isDbAvailable) return;`). Mocks use in-memory repository fakes with Fastify `inject()`. Real DB integration tests must fail if database infrastructure is unavailable.
- **Assertion Specificity:** Banned: loose `toBeTruthy()`/`toBeFalsy()`/`toBeDefined()` on knowable primitives. Required: strict type checks, ISO timestamp regexes (`/^\d{4}-\d{2}-\d{2}T/`), exact object structures, and typed DOM instances (`toBeInstanceOf(HTMLInputElement)`).
- **Hermetic & Silent Output:** Spies on `console.error` and `LOG_LEVEL = 'silent'` for negative tests. Hermetic runs require `clearMocks: true`, `restoreMocks: true`, and explicit fixture teardown.

## 2. Test File Organization & Specification Standards
- **Co-Location & Layout:**
  - Unit/Component: `[feature].test.ts` or `[feature].test.tsx` colocated next to `[feature].ts(x)` in `apps/frontend` and `packages/shared`.
  - Backend Unit/Routes: `apps/backend/src/__tests__/**/*.{test,spec}.ts` (or co-located `*.test.ts`).
  - Feature Integration: `features/[feature]/__tests__/[feature].integration.test.ts` or `apps/backend/src/__tests__/db-integration/`.
  - Browser E2E: `e2e/tests/[user-journey].spec.ts`.
  - Fixtures & Factories: `__fixtures__/[model].factory.ts` or typed test factories.
- **Specification Naming Pattern:** Every test must read like a verifiable specification:
  - `describe('EntityOrComponent', () => { it('given [condition], should [expected result] when [action]', () => {}) })`.
  - Vague test names (`it('works')`, `it('renders properly')`) are banned.
- **AAA Format:** Every test must distinctly segment `// Arrange`, `// Act`, and `// Assert` phases separated by a blank line.

## 3. Behavioral Verification & Black-Box Boundaries
- **User-Centric Queries Only:** In DOM, component, and E2E specs, prioritize queries in this exact hierarchy:
  1. Accessibility roles: `getByRole('button', { name: /submit/i })`
  2. Accessible labels: `getByLabelText(/password/i)`
  3. Visible text: `getByText(/welcome/i)`
  4. Test IDs (`getByTestId`) are restricted to dynamic canvases, SVGs, or unlabelled third-party integrations.
- **Strict Black-Box Boundary:**
  - Never assert on component internal state, hook internal values, or CSS class names.
  - Never expose private functions solely to make them testable; verify observable effects through the public interface.
- **Realistic Interactions:** Use user-event dispatchers (`userEvent` over `fireEvent`) in happy-dom/DOM tests to preserve complete event lifecycles. In Playwright, use web-first user actions (`page.getByRole().click()`).

## 4. Isolation, Mocking & Factory Boundaries
- **Comprehensive Unit & Logic Isolation:**
  - **Coverage Scope:** Every domain service, helper utility, custom hook, use-case function, and repository mapper must have unit coverage.
  - **Dependency Isolation:** Mock all I/O boundaries (PostgreSQL/Drizzle queries, Redis/BullMQ instances, external HTTP clients, file storage, email gateways) using Vitest mocks (`vi.fn()`, `vi.spyOn()`). Unit tests must execute deterministically in milliseconds without network or database dependencies.
  - **Boundary & Contract Coverage:**
    - *Happy Path:* Valid input scenarios and expected return payloads.
    - *Schema & Boundary Conditions:* Null, undefined, empty strings, boundary integers, invalid date strings, and malformed payload structures validated against `@mms/shared` Zod schemas.
    - *Error Contracts:* Ensure custom domain exceptions (`ContractError`, `HttpError`, RBAC rejections) throw with expected HTTP status codes, structured error payloads, and diagnostic codes.
- **Transport-Level Mocking:** Intercept network calls at the transport layer (Fastify `inject()` for backend; transport/network interception or isolated facade boundaries for frontend). Never mock raw `fetch`, `axios`, or internal API client classes directly with ad-hoc stubs.
- **Typed Factories over JSON:** Never create static `.json` fixtures for mutable domain models. Use typed factory builders exporting pure functions with sensible `@mms/shared` defaults that accept partial overrides.
- **Zero Shared Mutable State:**
  - Prohibit `let` variables in outer `describe` scopes that mutate across tests.
  - Reset all mocks, handlers, stores, and storage in lifecycle hooks (`beforeEach`/`afterEach`).
  - Strictly ban arbitrary delays (`sleep(1000)`, `waitForTimeout(500)`). Use deterministic async awaiters (`findBy*`, `waitFor`, Playwright web-first assertions).

## 5. Code Coverage Thresholds & Quality Gates
The per-workspace `thresholds` blocks are the only authoritative floors — never restate or invent percentages. The snapshot below is dated; re-read the configs when a floor changes:

| Workspace | Config (SSOT) | lines / statements / functions / branches |
| :--- | :--- | :--- |
| Frontend | `apps/frontend/vitest.config.ts` | 42 / 41 / 34 / 40 |
| Backend | `apps/backend/vitest.config.ts` | 46 / 43.5 / 41 / 33 |
| `@mms/shared` | `packages/shared/vitest.config.ts` | 79 / 75 / 72 / 57 |

- **The Ratchet Rule:** A pull request or code generation task must never lower the configured floors to make a change pass; raise a floor only with the measured value from a green run.
- **Branch Coverage Over Line Coverage:** Line coverage alone is insufficient. All edge cases (early returns, error catches, fallback defaults) must have explicit branch coverage.
- **No Vanity Tests:** Tests written without actionable assertions purely to execute code paths are banned. Every test must include at least one visible or structural behavioral assertion.
- **Coverage Exclusions:** Only exclude type definitions (`*.types.ts`, `*.d.ts`), re-export barrels (`index.ts`), configs (`*.config.ts`), and static test fixtures (`__fixtures__/**`).

## 6. API Error Expectations
- Assert production-safe JSON `{ type, message }` in API tests. Never leak SQL syntax, raw database errors, or stack traces in responses.

## 7. Telemetry & Logging Hygiene
- **Context Propagation:** Use `AsyncLocalStorage` for request and trace ID propagation across asynchronous call stacks (the experimental `AsyncContextFrame` flag is not enabled).
- **Structured Logs:** Emit JSON logs to stdout via Pino. Never log passwords, tokens, OTP codes, session cookies, or PII.
- **Telemetry & Sentry:** Name log fields after OpenTelemetry semantic conventions (advisory — no OTel SDK is installed). Scrub PII in Sentry; do not double-report handled `notify.error` paths as unhandled exceptions.

## 8. Frontend Resilience & Boundaries
- **Boundary Isolation:** Central `ErrorBoundary` wraps lazy route modules and heavy tiers to catch render crashes. Fetch failures are handled by TanStack Query `isError` (`ErrorState` with retry), never thrown render crashes.
- **Zero Silent Catches:** Never use empty `catch` blocks. Map user-facing errors via `notify.error(t(...))`. Render gracefully from Query `isPending`, `isFetching`, and `isError`.

## 9. Audit Trail & Verification Testing
- **Chain Integrity:** Test hash-input framing and RFC 8785 canonicalization against known vectors.
- **Tamper Simulation:** Test audit verification jobs with synthetic broken chains, altered payloads, and sequence gaps; assert transitions to `BROKEN_CHAIN` or `TAMPERED`.
- **Governance:** Confirm reading audit tables emits an immutable `action_type: 'VIEW'` audit row. Verify crypto-shredding and redact-and-append compliance.

## 10. Soft-Delete Verification Testing
- **404 Invariants:** Assert `GET /:id` returns 404 for archived entities; 200 on `?includeDeleted=true` only when caller has `canDeleteCollection`.
- **Conflict Trapping:** Verify pre-validated domain uniqueness conflicts return `400` (`validation_error`) via `mapRestoreError`; verify concurrent race conditions trap DB error `23505` and return `409 Conflict`.
- **Session Revocation:** Confirm soft-deleting an account immediately invalidates active sessions in Redis and prevents subsequent authentication.
- **Relational Guards:** Verify relational queries (`db.query.*`) explicitly filter child relations (`deletedAt IS NULL`).

## 11. Client Error Surface & Retry Policy
- **Correlation Tracing:** Surface `x-request-id` (or Sentry event ID) in user-facing error UI to allow direct trace lookup.
- **Safe Retries:** Query retries idempotent GETs; mutations never auto-retry. On 429, honor `Retry-After`. Failed dynamic chunk imports must provide a reload affordance.

## 12. Multi-Tenant Integration & Contract Testing
- **Database & Persistence Verification:** A change touching Drizzle schemas, migrations, relations or SQL queries needs an integration test (`*.integration.test.ts` or `vitest.db.config.ts`) against a real test database. Run the DB bucket locally with `pnpm ci:local --with-db` (`pnpm --filter mms-backend run test:db`); CI runs `test-backend-db` on the same path filter. Review-gated: no gate can prove the test exists.
- **Multi-Tenant RLS & Boundary Verification:**
  - Explicitly test Row-Level Security (RLS) enforcement and `tenant_id` scoping.
  - Execute cross-tenant isolation assertions: verify that Tenant A cannot read, mutate, or soft-delete records belonging to Tenant B under any circumstance.
  - Validate transaction rollbacks on failure to ensure atomic consistency across multi-table writes.
- **API Route & Serialization Integrity:** Validate Fastify route handlers, authentication/session cookies, CSRF guards, and response payload serialization against their corresponding `@mms/shared` contract schemas.
- **Zero Regression Suite:** Run the dependent subsystem suites (`pnpm --filter mms-backend run test:db` and `pnpm test`) to guarantee modifications do not introduce regressions across related modules.

