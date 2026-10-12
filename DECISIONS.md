# Architecture Decision Records (ADRs) — MMS Monorepo

This document records the architectural standards, conventions, and design decisions governing the Madrasa Management System (MMS) monorepo.

---

## ADR-001: 300-Line Code Ceiling and Proactive Modular Decomposition

- **Status:** Accepted & Enforced
- **Date:** 2026-09-24 (ceiling revised from 200 to 300 to match the `check:code-norms.mjs` ratchet)
- **Context:** Large monolithic source files decrease readability, complicate git diffs, impair testability, and increase cognitive load.
- **Decision:**
  1. A strict hard cap of 300 lines of code (LOC) is established for all source files (`.ts`, `.tsx`, `.js`), machine-enforced by `pnpm run check:code-norms`.
  2. When any file approaches or exceeds 300 LOC, developers and agentic workflows must proactively decompose logic into dedicated sub-components, custom hooks, use-case interactors, or pure utility services before adding new features. New frontend shells should aim for ≤220 LOC.
  3. Stable barrel exports must be maintained so external consumers do not churn.
  4. Exceptions are strictly limited to unified translation dictionaries (`appTranslations*.ts`), `schema.ts`, and large integration test suites.
- **Consequences:** Highly modular codebase, clear ownership of responsibilities, clean git history with minimal surgical diffs.

---

## ADR-002: Strict Layer Decoupling (Presentation vs State Orchestration)

- **Status:** Accepted & Enforced
- **Date:** 2026-09-24
- **Context:** Coupling React JSX presentation with data fetching, server cache invalidation, business rule derivations, and side effects leads to brittle components and untestable UI.
- **Decision:**
  1. UI components must exclusively handle presentation and render state.
  2. All data fetching, caching, state orchestration, side effects, and calculations must be extracted into dedicated custom hooks, services, or repository adapters.
  3. Presentation sub-components receive clean, serializable props and emit event callbacks.
- **Consequences:** UI components can be tested in isolation using mock props; business logic can be tested without mounting full DOM trees.

---

## ADR-003: Strict Type Safety & Runtime Zod Contracts at Boundaries

- **Status:** Accepted & Enforced
- **Date:** 2026-09-24
- **Context:** TypeScript types are erased at runtime. Relying solely on compile-time types or `any`/untyped dictionaries creates security holes, deserialization bugs, and runtime crashes.
- **Decision:**
  1. Zero tolerance for `any`, untyped object literals/dictionaries, and `unknown` without explicit narrowing type guards.
  2. Double assertions (`as unknown as T`) to bypass validation are forbidden.
  3. All API boundaries, external payloads, and database persistence operations must be validated against runtime Zod schemas defined in `@mms/shared` (using `.strict()` for write DTOs).
- **Consequences:** Total type safety at compile time and runtime integrity at system boundaries.

---

## ADR-004: Protected Infrastructure Zones and Authorization Guardrails

- **Status:** Accepted & Enforced
- **Date:** 2026-09-24
- **Context:** Automated agents or inadvertent modifications to critical infrastructure (migrations, authentication, CI/CD, build tools) can destabilize the entire platform.
- **Decision:**
  1. The following core infrastructure zones are declared Protected Zones and must NOT be modified without explicit, logged user authorization:
     - Database migrations (`apps/backend/src/db/migrations_drizzle/`, `migrations/`)
     - Authentication middleware and session infrastructure (`apps/backend/src/middleware/authenticate*.ts`, `apps/backend/src/services/auth/`)
     - CI/CD pipelines, Dockerfiles, and deployment configs (`.github/workflows/`, `Dockerfile*`)
     - Global build configs (`tsconfig.json`, `tailwind.config.js`, `vite.config.ts`)
  2. Dependency additions are forbidden without prior review; existing workspace catalog dependencies must be inspected first.
- **Consequences:** Protected core systems remain immutable against unintended agentic regressions.

---

## ADR-005: Living Documentation Synchronization and Tri-Mirror Rule Topology

- **Status:** Accepted & Enforced
- **Date:** 2026-09-24
- **Context:** Development teams and AI coding assistants operate across Cursor, Claude Code, and Antigravity. Rule drift causes conflicting agent behaviors.
- **Decision:**
  1. Single source of truth (SSOT) for rules is `.cursor/rules/*.mdc`.
  2. SSOT for skills is `.agent/skills/*/SKILL.md`.
  3. Automated synchronization via `bash .agent/scripts/sync-all.sh` mirrors rules to `.agent/rules/` and `.claude/rules/`, and skills to `.cursor/skills/` and `.claude/skills/`.
  4. CI and pre-commit gates enforce zero drift via `node scripts/verify-rules-integrity.mjs`.
  5. Architectural evolution must be documented immediately in `DECISIONS.md` and `SYSTEM_ARCHITECTURE.md`.
- **Consequences:** Complete agent alignment across all tools and synchronized living documentation.

---

## ADR-006: Semantic Design Tokens and Design System Enforcements

- **Status:** Accepted & Enforced
- **Date:** 2026-09-24
- **Context:** Hardcoded hex color codes and arbitrary pixel spacing produce inconsistent themes, break dark mode, and degrade accessibility.
- **Decision:**
  1. All UI components must consume semantic design tokens defined in Tailwind CSS v4 and `index.css` `@theme` (`primary`, `secondary`, `destructive`, `success`, `muted`, `accent`, `card`, `popover`).
  2. Raw hex colors outside `@theme` are forbidden and ratcheted via `scripts/check-code-norms.mjs`.
  3. All layouts must use BiDi logical properties (`ms-`, `me-`, `start-`, `end-`) to guarantee bidirectional RTL/LTR support for Arabic and Urdu.
- **Consequences:** Cohesive visual identity, dynamic tenant brand theming, accessible contrast ratios, and flawless BiDi rendering.

---

## ADR-007: Mandatory Automated Verification Gates

- **Status:** Accepted & Enforced
- **Date:** 2026-09-24
- **Context:** Code changes without rigorous automated verification introduce silent regressions in tenant isolation, calculation logic, and UI behavior.
- **Decision:**
  1. Every non-trivial change requires passing verification before being marked complete:
     - Static type safety: `pnpm typecheck`
     - Automated test suites: `vitest run` (frontend, backend, shared)
     - Code norms ratchet: `node scripts/check-code-norms.mjs`
     - Standards integrity: `node scripts/verify-rules-integrity.mjs`
  2. No task may be marked done with failing tests or unaddressed defects.
- **Consequences:** Zero-regression guarantee across all workspaces and packages.

---

## ADR-008: Prepared Statements Modularization & Database Query Strict Typing

- **Status:** Accepted & Enforced
- **Date:** 2026-09-24
- **Context:** `apps/backend/src/db/preparedStatements.ts` had grown to 329 LOC with duplicated SQL prepare boilerplate and loose `any` typing across query builders, statement holders, and client arguments.
- **Decision:**
  1. Decomposed column selections into `apps/backend/src/db/preparedColumns.ts` (102 LOC) to separate projection metadata from statement execution mechanics.
  2. Preserved public column exports in `preparedStatements.ts` as a stable barrel facade to prevent breaking changes in repository consumers.
  3. Eliminated all `any` annotations using strongly typed `PreparedLookupStatement<TRow>` matching table `$inferSelect` types.
  4. Implemented DRY `getOrCompileStatement` helper, reducing `preparedStatements.ts` from 329 LOC down to 166 LOC (well within the 300 LOC ceiling).
  5. Eliminated `any` annotations in `dbClient.ts` soft-delete relational guardrails via typed relational callback interfaces.
  6. Ratcheted down repository-wide `any` baseline from 64 to 51 and files over ceiling from 79 to 78.
- **Consequences:** Strictly typed database read path, zero regressions in hot-path queries, reduced cognitive overhead, and machine-enforced compliance with the 300 LOC hard ceiling.

---

## ADR-009: Prettier Owns Formatting (enforced)

- **Status:** Accepted & Enforced
- **Date:** 2026-10-11
- **Context:** `.prettierrc.json` and `.prettierignore` were committed but Prettier was never installed, so formatting was unenforced and the editor hook (`.cursor/hooks/format-edited-file.sh`) silently no-opped.
- **Decision:**
  1. `prettier` and `eslint-config-prettier` are root devDependencies; `pnpm format` (write) and `pnpm format:check` (verify) are root scripts.
  2. `eslint-config-prettier/flat` is registered last in every `eslint.config.js` (frontend, backend, `@mms/shared`, e2e) so ESLint owns no stylistic rules.
  3. `.prettierignore` excludes agent/scratch trees (`.agent/`, `.cursor/`, `.claude/`, `.commandcode/`, `.superpowers/`, `docs/`) so the tri-mirror rule/skill corpus stays byte-identical for `verify-rules-integrity.mjs`, and the unified translation dictionaries (`packages/shared/src/appTranslations*.ts`, the ADR-001 exemption) which a line-based i18n parity checker (`scripts/i18n/check-translations.ts`) parses one `"key": "value"` per line.
  4. `pnpm format:check` gates the `typecheck-lint` CI job.
  5. **ADR-004 authorization recorded:** this change adds root dependencies and edits `.github/workflows/ci.yml` (both Protected Zones); explicit authorization was granted by the project owner for the remediation program of 2026-10-11.
- **Consequences:** Consistent formatting repo-wide, machine-enforced in CI; the one-time reformat landed as an isolated commit.

---

## ADR-010: Single Typed Escape Hatch for the ts-rest React-Query Client

- **Status:** Accepted & Enforced
- **Date:** 2026-10-11
- **Context:** `@ts-rest/react-query@3.52.1`'s recursive `TsRestReactQueryHooksContainer` + `ClientInferResponses` conditionals fail to instantiate against the 24-domain `rootContract` (and even single heavy domains) under this TS toolchain. Every `tsrClient.<domain>.<route>.useQuery/useMutation(...)` call degraded to a non-callable union, forcing **288** per-call `@ts-expect-error - TS union discrimination limit with ts-rest` suppressions across 45 feature hook files. Because those calls degraded to `any`, ~30 consumer files read the response envelope and arbitrary result fields with no narrowing, so a strict `unknown`-typed replacement cascades into those consumers.
- **Decision:**
  1. Widen the client **once**, in `apps/frontend/src/lib/api.ts`, via `TsrHooksContainer` — a structural type whose `useQuery`/`useMutation` take a permissive options record and return `any`.
  2. The runtime is unchanged: the hooks still call the real `initTsrReactQuery` client through the shared `tsrApiFetcher` transport (CSRF / auth-refresh / request-id preserved). Only the static types are loosened.
  3. The dead `tsr` per-domain accessor (a previous, ineffective attempt) is removed; its three call sites use `tsrClient.<domain>` directly.
  4. This is the single, reviewed escape hatch: it replaces **288** `@ts-expect-error` suppressions with two `eslint-disable`-annotated `any` aliases (invisible to the code-norms `any` ratchet, which matches `: any` / `<any>` / `as any` only).
- **Alternatives considered:** the typed `apiContract` + `unknown` seam (rejected — cascades into ~30 consumer rewrites and the response-envelope/body ambiguity); per-domain typed accessors (rejected — do not resolve under this TS).
- **Consequences:** Zero ts-rest suppressions and no per-call escapes; the type loosening is centralized and documented. Residual `any` is confined to `api.ts`.

---

## ADR-011: Backend Route→Storage Boundary (enforced ratchet)

- **Status:** Accepted & Enforced
- **Date:** 2026-10-12
- **Context:** The documented chain is routes → use-cases → repository interface → Drizzle adapter (`SYSTEM_ARCHITECTURE.md` §5), but 19 route files imported `db/repositories/**` or `drizzle-orm` directly — the handler owned SQL, bypassed the module's repository seam, and could not be unit-tested with a fake repository. A dynamic `await import("…/db/repositories/…")` had gone unnoticed by static review.
- **Decision:**
  1. Route files reach storage only through their module's `use-cases`/`repository` seam; each migrated module exposes `create<Module>UseCases(repo = adapter)`.
  2. `scripts/check-backend-boundaries.mjs` enforces this as a ratchet at **baseline 0** — any new static **or dynamic** `db/repositories` / `drizzle-orm` import in `apps/backend/src/routes/**` fails.
  3. It runs from `pre-pr-review.sh` in both scopes, gating every local push.
- **Consequences:** All 19 offenders migrated (tasks, savedReports, faculty catalog, audit, platform, users/workspace bridges). Future route→storage shortcuts fail immediately. Wiring into `.github/workflows/ci.yml` is still pending — see Open items.

---

## ADR-012: Canonical Date/Month Schemas and SSOT Idiom Guard

- **Status:** Accepted & Enforced
- **Date:** 2026-10-12
- **Context:** `isoDateSchema` existed to replace shape-only `/^\d{4}-\d{2}-\d{2}$/` checks (which accept impossible dates such as `2026-02-31`), yet inline copies drifted into several modules; nine identical `monthKey` regexes and two strict `YYYY-MM` billing-period regexes were duplicated, and a canonical `widgetAggregateResultSchema` was re-declared in three contracts.
- **Decision:**
  1. `isoDateSchema`, `monthKeySchema` and `billingPeriodSchema` are the only definitions of those date/month rules.
  2. Canonical schemas (e.g. `widgetAggregateResultSchema`) have a single definition; contracts import them.
  3. The shared SSOT auditor fails any inline `z.string().regex(/^\d{4}-…` outside the canonical files, and any contract that re-declares a canonical schema.
- **Consequences:** One definition per rule; drift is machine-caught. Two deliberate tightenings: faculty/tasks/accounting ISO-date fields now reject impossible dates, and the accounting fee/pay period message is unified.

---

## ADR-013: Frontend Feature Isolation Across All Layers

- **Status:** Accepted & Enforced
- **Date:** 2026-10-12
- **Context:** `no-cross-feature-imports` only constrained importers inside `src/tenant/features/**`, so shared-layer modules (`hooks/`, `components/`, `lib/`, `tenant/hooks/`) still reached into feature internals.
- **Decision:**
  1. Feature→feature imports stay banned (`reports`/`settings` are sanctioned cross-cutting targets).
  2. The same rule now also bans shared-layer → feature imports, so those layers consume `@/tenant/hooks/collections/*` facades.
  3. Sanctioned bridges are enumerated in `feature-internal-imports-baseline.json` (four entries) with a `stale` check; route wiring (`lib/routing/**`) and `components/ui|common` stay out of scope.
- **Consequences:** The layering contract is enforced everywhere; the four remaining bridges are visible and must be justified.

---

## Open items (status)

Recorded so they are not lost, with the evidence gathered since.

1. **P1-5 — permission fallbacks (`export → read`, `delete → write`).** _Investigated: deliberate._ The
   mapping is pinned by tests as intended, and the actionable half (the raw `WRITE_ROLES` fallback) was
   already replaced by an explicit allow-list. Tightening further means introducing explicit
   `export`/`delete` permissions across all 16 manifests plus the role matrix — a product decision, not a
   defect. **Left as-is.**
2. **P1-6 — empty/null grant map ⇒ all modules.** _Investigated: deliberate, forward-compatibility._
   `workspaces.granted_modules` is a nullable jsonb (`apps/backend/src/db/schema/platform.ts`) that
   provisioning writes as a **full** map (`apps/backend/src/services/workspaceService.ts:251-272`), and the
   "granted unless explicitly `false`" rule — including migration `086`'s backfill — is what lets a
   **newly introduced module reach existing workspaces**. Pinned by
   `apps/backend/src/__tests__/workspaceRepositoryGrantedModules.test.ts` ("returns all system modules when
   grantedModules is null or empty"). Changing it would break module roll-out. **Left as-is.**
3. ~~Backend coverage floors unenforced.~~ **RESOLVED** — CI now runs the backend shards with coverage and a
   `test-backend-coverage` merge job enforces the thresholds (measured Stmts 47.29 / Branch 35.76 /
   Funcs 46.43 / Lines 49.63 against 43.2 / 27 / 37.5 / 45 before enabling).
4. ~~`check:backend-boundaries` not in CI.~~ **RESOLVED** — now a ratchet step in the `typecheck-lint` job.
   A `sensitive-file-guard` job also landed (whole-tree sensitive-filename blocklist, at any path depth).
5. **Fat-file debt.** **69 → 62** files over the ADR-001 300-LOC cap (baseline ratcheted down via
   `check-code-norms --update-baselines`, never by hand). Seven splits landed, all one shape: extract a
   cohesive block into its own module and keep the origin working — a **barrel re-export** when the block
   was public (`crud*`, `livePush`, `contacts.dto`), or a plain **import** when it was module-private
   (`financeListQueryBuilders`, `attendanceListQueryBuilders`, `attendanceReportOverview`), which leaves the
   public surface untouched by construction. Composition of the remaining 62: **42 backend,
   16 `@mms/shared`, 4 frontend**; four are the ~8.4k-line generated `appTranslations*.ts`.
   Prioritisation (the part that matters): a split only lowers the count when **every** part lands under
   300 with headroom, so the lane is the 300–321 band — now down to **7 files**
   (`accountingFiscalYearsRepository.ts` 321, `obligationsUseCases.ts` 318, `messagingUseCases.ts` 314,
   `routes/tenant/enrollments.ts` 308, `sessionRepositoryPersistClasses.ts` 306,
   `contactFormNormalizeEdit.ts` 304, `examinationQuestionBankTables.ts` 303). Rejected as-is, because a
   _move_ cannot fix them: `obligationsUseCases.ts` (one 270-line factory), the `*UseCases.ts` /
   `*ContractRouter.ts` monoliths, `invoiceTemplatePresets.ts` (863 — its `buildFormalA5Preset` alone is
   ~314 lines, so it needs a second split inside the extracted part), and
   `accountingFiscalYearsRepository.ts` lands at ~267 with only ~33 lines of headroom.
   _Needs:_ a call on whether to keep going.
6. ~~Migration DDL duplication · legacy `teachers` DDL names.~~ **RESOLVED — false positive, and no
   migration was touched.** `0108` deliberately **supersedes** `0104`: it `CREATE OR REPLACE`s
   `forbid_hard_delete()` with a better message (`…or set app.allow_hard_purge = true in maintenance
transactions.`) and re-attaches triggers for **19** tables against 0104's **14**, each guarded by
   `DROP TRIGGER IF EXISTS` — idempotent by construction. Deleting 0104's copy would retcon an applied
   migration and gain nothing. The `teachers` names are likewise already remediated: `0112` renames the
   table **and all 17 `teachers_*` indexes** (plus compat views), and `0119:52-61` replaces
   `trg_teachers_forbid_hard_delete` with `trg_faculty_forbid_hard_delete` while renaming the constraints.
   0104's `teachers` references are _historically correct_ for its index in the sequence — which is exactly
   what `softDelete0104Regression.test.ts` pins. What was genuinely missing was **enforcement**, so
   `pnpm run check:migrations-forward-only` now fails on any modification, rename or deletion of an
   already-applied migration (CI `typecheck-lint` + pre-PR gate); adding a new migration is always allowed.
7. ~~Class-level branding contrast.~~ **RESOLVED — the palette itself was failing.** Measured before the
   change: **5 of 22** preset×mode combinations below the 4.5:1 AA floor inside brand tints, including two
   _curated_ presets (`emerald` 4.47, `teal` 4.46) and the synthetic light brands (down to 4.17) — so this
   was not just a call-site mistake. `--muted-foreground` and `--sidebar-muted-foreground` are now fitted
   against **every** brand fill's resting tint via a single `restingTintedSurfaces` helper that the contrast
   matrix also calls, so the guarantee and its test cannot drift; the matrix asserts both tokens in both
   modes. Worst case is now **5.15:1**. Change range, verified by diffing all **858** generated tokens
   against the previous implementation: **44** entries, only the two muted tokens, lightness only
   (light `37 → 32-35`); every fill, foreground, chart and border is byte-identical.
   A follow-up sweep proved the class is closed rather than just this instance: `--foreground` /
   `--card-foreground` read inside every fill tint measured **11.89** (light) / **12.24** (dark) worst case
   — zero failures — confirming that mid-lightness was the exposure, which is now a permanent test.
   Sweeping the _assumption the guarantee rests on_ then found a second, independent defect: the tint bound
   `MAX_RESTING_TINT_BY_MODE` was **stale in three copies**, all claiming dark tops out at `/10`. Reality
   (and the documented contract in `index.css`, "solved against a `/15` tint … stronger than `/15` must use
   `-foreground`") is `/15` in both modes. Fixed by (a) setting the dark bound to `/15` and replacing the
   false docstring with cited evidence, (b) single-sourcing it through `@mms/shared` (both tests import it),
   (c) lowering **ten** `/20` call sites that breached the contract — one of which only the new scan found —
   (d) re-tuning the static dark `--destructive`/`--warning` to `71%`/`52%`, which measured **4.38:1** on
   their own `/15` tint and so were never compliant with their own contract, and (e) making the prose
   executable: a scoped tint-strength scan in `designTokens.contrast.test.ts`. Generated-token blast radius:
   **139 of 858**, all dark mode.
   I first recorded `hover:` tints as out of scope ("the contract is AT-REST"), then measured them and that
   was **wrong**: same-token text on its own tint scores 4.50:1 (light) / 4.51:1 (dark) at `/15` but
   **4.13 / 4.12 at `/20`** and 3.80 at `/25` — and `bg-<token>/10 … hover:bg-<token>/20` is a repeated UI
   convention, not a few outliers. Fixed **27 sites**: 24 hover tints lowered to the bound across 15 files,
   the two offline-banner CTAs kept their strong wash and dropped the same-token hover text (the contract's
   other remedy), and one range cell's now-dead hover class removed. The scan now covers **every interaction
   state**, with that measurement cited in the test so hover is not re-litigated.
