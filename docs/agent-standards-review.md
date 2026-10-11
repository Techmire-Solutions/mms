# MMS Agent Standards Review — Rules & Skills

**Scope reviewed:** 21 rules × 3 tool mirrors (`.cursor/rules/*.mdc`, `.agent/rules/*.md`, `.claude/rules/*.md`), **38 skills** × 3 mirrors (30 audited; this review's own application added 8, expanding the inventory to the 38 `AGENTS.md` now documents), 26 skill aux files (`scripts/`, `references/`, `examples/`), the 6 workflows, `.agent/skills-manifest.json`, `scripts/verify-rules-integrity.mjs`, `.agent/scripts/sync-*.sh`, `AGENTS.md`, `CLAUDE.md`, `.claude/settings.json`, `.cursor/hooks.json`, CI wiring.

**Method:** structural inventory + drift diffing + content audit of every rule and SKILL.md + cross-check of every factual claim against the real repo (source, `package.json`, `pnpm-workspace.yaml`, tsconfig, CI, migrations, e2e) + external research on current agent-configuration practice. Every CRITICAL and a sample of HIGH findings were re-verified by hand (see Appendix A).

**Corpus size:** 26,690 words of rules (~36k tokens), 23,890 words of skills (~32k tokens), 3,064 lines of SKILL.md.

---

## 0. Status: APPLIED (2026-09-15)

> **Historical snapshot (2026-09-15).** Counts and defect rows below reflect that date. The skill inventory has since grown to **39** (verified live by `node scripts/verify-rules-integrity.mjs`). Treat this section as a point-in-time record, not live state.

This review was executed, not just written. Current state:

| Area | Result |
|---|---|
| Verifier | `scripts/verify-rules-integrity.mjs` rebuilt from a path/format checker into a standards linter (43 real defects found on first run, all now fixed) |
| Rules | 21 rules corrected; always-on set cut from 2,573 → 2,056 words (the ownership matrix and the 25-row fix table moved to `.cursor/rules/README.md` and the `mms-code-review` skill reference); `mms-performance.mdc` globs narrowed from 97.4% of the tree to `*/src/**`; 7 zero-match globs fixed; 8 phantom `§7` citations repointed |
| Rules added | migration lock safety (§7), business-date/timezone semantics (§8), API versioning/deprecation, client error surface + correlation, table/live-region/contrast a11y, env-var & secret lifecycle, job contract, review criteria + a defined "change boundary" |
| Skills | 30 corrected in place (canonical scaffold now compiles, 5 broken/misleading example files repaired, 5 false-green scripts made to actually fail, 7 orphan scripts wired in, the 5 largest skills split into `references/`), 8 new skills added → **38** (3,471 SKILL.md lines) |
| Frontmatter | all 38 skills carry `license` + `metadata.owner` + `metadata.last-verified`; 6 carry `allowed-tools`; 5 carry `compatibility`; 6 colliding trigger descriptions rewritten |
| Tooling | `CLAUDE.md` is now a thin `@AGENTS.md` import; 6 slash commands × 2 tools; 4 Claude subagents; real hooks (format-on-edit, shell guard) replacing the empty `hooks.json`; committed deny-list permissions |
| Enforcement | new `pnpm run check:code-norms` ratchet (55 `any`, 37 hex-colour files, 77 files > 300 lines baselined); `check:i18n` wired into CI for the first time; `sync-*.sh` gained `--dry-run` and a context-aware reference rewrite that no longer corrupts `.cursor/rules/*.mdc` paths |
| Gate | `node scripts/verify-rules-integrity.mjs` green — 38 skills, 21 rules, zero warnings; `pnpm run check:code-norms` green; `pnpm typecheck` green; mirrors byte-identical after `sync-all.sh` |

**Deliberately not done**

- The four discovered defects below are *application* defects, not standards defects: they are reported and recorded in the debt register rather than fixed here (an RLS migration and a shared-package refactor each deserve their own reviewed change).
- `.cursor/hooks/_common.py` (0-byte leftover) was **removed on 2026-10-11** once the deletion guard in `mms-agent-universal.mdc` was satisfied with explicit confirmation. The same pattern was fixed for `.cursor/hooks.json`, which is now a valid hook manifest.
- The `mms-messaging` skill overlaps its rule on a handful of lines, but its content is operational (paths, workflow, checklist) rather than restated norms, so it was kept; the row-for-row BiDi table duplication *was* removed.

### Defects discovered while applying (not agent-standards issues — surfaced by the new checks)

1. **Tenant RLS coverage gap — CLOSED.** The original sweep found **27 tenant tables** with no `ENABLE ROW LEVEL SECURITY` anywhere in the migration set, so their `tenant_isolation_policy` was inert (`FORCE` alone does not enable policies). The same-day correction in the Open Gaps Register (`mms-migration-status.mdc`) cut this to **17 real tables + 1 false positive**: 9 of the 27 were covered by the dynamic `DO`-block in `0093_finance_accounting_complete.sql` that the checker could not then parse, and `custom_tabs` had already been dropped by `0043_drop_custom_fields_and_tabs.sql`. The dedicated fix pass shipped as migration `0116_force_rls_missing_tenant_tables.sql` on **2026-09-18** (journal idx 116): per-table `ENABLE` + `FORCE` + `tenant_isolation_policy` for the 15 `FORCE`-only tables from `0082_new_modules.sql` plus `audit_trail_events` / `audit_verification_runs` from `0102_modern_audit_trail.sql`. The register row remains the live record; `bash .agent/skills/mms-schema-migrate/scripts/check-migrations.sh` still exits non-zero on this class — it now parses dynamic DO-block DDL and (Pass 1b) excludes dropped tables.
2. **`@mms/shared` is not environment-pure — CLOSED (2026-10-11).** At this review, 9 source files touched `window`/`document`/`localStorage` (`tenantUrlUtils.ts`, `utils.test.ts`, `moneyFormatUtils.ts`, `sessionPolicy.ts`, `settingsDateProvider.ts`, `tenantStorage.ts`, `backupEnvelopeUtils.ts`, `languageUtils.ts`, `imageOptimizationUtils.ts`), and `tenantUrlUtils.ts:24` dereferenced `window.location.hostname` unguarded. Now fixed: the browser-only helpers moved to `apps/frontend` (`lib/imageOptimization.ts`, `lib/documentLanguage.ts`), runtime reads are injected (`registerSettingsProvider`, `registerFinanceCurrencyProvider`), `tenantUrlUtils` no longer touches `window`, and `check-shared-exports.sh` runs in CI as `pnpm run check:shared-purity`.
3. **`prettier` is configured but not installed** (`.prettierrc.json` + `.prettierignore`, no dependency, no CI step), so the format hook falls back to `eslint --fix` and formatting is unenforced.
4. `apps/backend/src/app.ts` sets `keepAliveTimeout` but never `headersTimeout`, so the 502-prevention pair described in `mms-ops-infrastructure.md` is only half-applied.

---


## 1. Verdict

The framework is **structurally excellent and factually stale**. The scaffolding — three-tool mirrors, generated bodies, CI drift gate, integrity verifier, rule→skill routing, "Do NOT use for…" trigger boundaries, progressive-disclosure folders — is better than most repositories have. What it lacks is (a) **correctness maintenance**, (b) **enforcement** of the norms it declares, and (c) **context discipline**.

| Dimension | Grade | Evidence |
|---|---|---|
| Structure & mirroring | **A** | 21/21 rule bodies byte-identical across mirrors; 0 always-on parity mismatches; CI regenerate-then-diff gate works |
| Trigger design (skills) | **A−** | All 30 have enforced "Do NOT use for…" boundaries; 6 descriptions still collide |
| Factual accuracy | **D** | ~40 stale claims: phantom sections, dead paths, inverted config statements, numbers that contradict the scripts they cite |
| Enforcement of "forbidden" | **D** | Most bans are `warn`-level or absent; the verifier passes green through all of the above |
| Context economy | **C−** | A single form edit loads 9 of 21 rules (~10.2k words); the always-on set is ~45–50% restatement |
| Coverage vs. repo reality | **C** | BullMQ/Redis, index-lock safety, coverage floors, queue ops are unowned |
| Tooling modernisation | **C** | No hooks, no subagents, no slash commands, no MCP, empty committed settings, dead `.cursor/hooks.json` |

The single highest-leverage observation: **`scripts/verify-rules-integrity.mjs` reports "✨ All rules and skills integrity checks passed successfully" while every defect in §3 is present.** The gate is real and well-built; its path allowlist and section regex simply cannot see the failures that matter.

---

## 2. What already works — do not churn

- **Mirror integrity is real.** Rule bodies are byte-identical across `.agent`/`.cursor`/`.claude` after the documented `.md`↔`.mdc` rewrite; Cursor `alwaysApply` ↔ Antigravity `trigger` parity is exact; CI regenerates and fails on `git diff --exit-code` — the strongest available drift gate.
- **Rule→skill routing is complete.** Zero dangling rule references, zero unknown skills, 30 directories == manifest == docs.
- **Skill descriptions follow the modern trigger formula** (what it does + "Use when…" + "Do NOT use for… (use X)"), and the verifier enforces the negative boundary. This is above-average practice.
- **Version pinning is accurate.** Every catalog/version claim in `mms-dependencies.md` matches the manifests exactly, including app-vs-catalog attribution.
- **Ports, env names, script names, Docker/CI claims** in the rules are correct (5002/3000/5173, `serverPorts.ts` guard, gitleaks, pg16, deploy flags).
- **Two norms are genuinely enforced** at `error` level: `mms-boundary/no-cross-feature-imports` and `mms-bidi/no-physical-directional-classes`.
- **The axe smoke really runs** (`e2e/tests/a11y-shell.spec.ts`, 375/1440, LTR+RTL) — only the "conditional gate" framing is wrong.

Fix the defects below; do not rewrite the architecture.

---

## 3. Priority 0 — defects that actively mislead agents

Each of these makes an agent do the wrong thing today.

### P0-1. A rule forbids the queue the repo runs on
`.agent/rules/mms-module-architecture.md:54` — *"Current runner is in-process — do **not** pretend a Redis/durable queue exists."*
**Reality (verified):** `apps/backend/src/worker/queues/index.ts:1` imports `Queue` from `bullmq`; `apps/backend/src/worker/processors/jobProcessor.ts:1` imports `Job`; `docker-compose.yml` runs a dedicated `worker` service against `redis:7-alpine`; `ecosystem.config.cjs` runs `mmsv2-worker`; `mms-core.md:16`, `mms-data-layer.md:64`, `mms-dependencies.md:54` all say BullMQ 6 + Redis. `mms-core.md:72` makes `mms-module-architecture.md` §5 the *owner* of background jobs, so the wrong file owns the false claim.
**Fix:** §5 owns job UX only; queue mechanics → `mms-data-layer.md`; delete the "do not pretend" sentence.

### P0-2. Six rules cite a section that does not exist — and the verifier says citations are valid
`mms-ui-ux-design.md` has exactly four sections: `## 1.` `## 2.` `## 3.` `## 4. Mobile-First Responsiveness & Breakpoints (§7 Layout)`. There is **no §7**, yet six sites cite "`mms-ui-ux-design.md` §7": `mms-completion-review.md:26`, `mms-testing-observability.md:42`, `mms-ops-infrastructure.md:105`, `mms-form-architecture.md:24`, `README.md:40`, `README.md:137`, plus `mms-migration-status.md:40`.
**Root cause (verified):** `verify-rules-integrity.mjs:156,245` uses `hasSection = /(^#+\s*7\.|§\s*7\b)/`, which the stale literal `(§7 Layout)` inside the §4 heading satisfies.
**Fix:** rename the heading (drop `(§7 Layout)`), then bound section matching to the heading's own number — a citation must not be satisfied by prose.

### P0-3. Verification commands that cannot run (2 skills)
`mms-audit-trail/SKILL.md:82,85` → `pnpm --filter @mms/backend typecheck` / `test:inject`; `mms-soft-delete/SKILL.md:125` → `pnpm --filter @mms/backend test:inject`.
**Verified:** the backend package is `mms-backend` (`@mms/` is only `@mms/shared`), and **no** `package.json` in the repo defines `test:inject`. Both skills' entire verification section is dead.

### P0-4. The canonical module-page scaffold does not compile (5 errors)
`mms-module-page/SKILL.md` — the skill every new module starts from.
| Line | Says | Reality (verified) |
|---|---|---|
| 24 | `@/tenant/hooks/useFilteredModuleTierTabs` | file does not exist; real: `@/tenant/hooks/useModuleTierTabs` |
| 26 | `@/components/ui/LoadingSpinner` | no such component |
| 34 | hook returns `{ activeTab, setActiveTab, visibleTabs }` | returns `ModuleTierTab[]`; tab state comes from `usePersistedTabState` |
| 46-50 | `onChange={setActiveTab}` | real prop is `onTabChange` (`ResponsiveAccordionTabs.tsx:19`) |
| 15 | lazily imported in `AppRoutes.tsx`/`PlatformRoutes.tsx` | neither exists; real: `components/routing/HostRoutes.tsx` |

Its own `examples/TemplateModulePage.tsx` uses `onTabChange` correctly and imports a different `PageHeader` path than the body — the example and the body contradict each other.

### P0-5. Other shipped code samples that cannot run
- `mms-form-architecture/SKILL.md:56-61` documents `<FormModal isOpen isSubmitting onSubmit>`; real props are `open`/`onSave`/`saving` (`FormModal.tsx:13,33,35`). Its own example sidesteps `FormModal` for raw Radix `Dialog` — violating `rules/mms-form-architecture.md:14`.
- `mms-backup-restore/SKILL.md:40-43`: INSERT into `audit_trail_events` names a nonexistent `details` column and omits five NOT-NULL columns; L21 uses the frontend-only `@/` alias in backend code.
- `mms-backend-api/examples/clean-architecture-route.ts`: 3 wrong module paths, and calls `registerStandardTenantRoutes` while the body prescribes `registerResourceRoutes`.
- `mms-testing-e2e/examples/fastify-inject.test.ts`: imports nonexistent `../server.js` (real `buildApp` in `app.ts`); uses cookie `mms_tenant_session` (real: `mms_access`).
- `mms-testing-e2e/examples/tenant-rls-concurrency.test.ts`: inserts `tenantId` into `students` (real column is `workspaceSubdomain`) and requires live Postgres, contradicting its own SKILL §2.1.
- `mms-reports-export/examples/ModuleReportCharts.tsx`: imports `react-i18next` (not a dependency), `@/lib/reports/chartUtils`, `@/components/ui/Skeleton` — none exist.
- `mms-query-factories/examples/templateQueryFactory.ts:8`: imports a nonexistent `apiClient` object; omits the `placeholderData` its own checklist mandates.

### P0-6. Numbers that contradict the scripts they cite
`mms-performance.md:18` — *"18 pre-existing sites … (17 in `sessionRepositoryHydrate.ts`, 1 in the outbox CDC processor)"*.
**Verified:** `node scripts/check-db-projections.mjs` → `count: 13 (baseline 13)`, all 13 in `sessionRepositoryHydrate.ts`; `BASELINE = 13` (line 38); no outbox-CDC site exists; the script's own header comment says 17. Rule=18, comment=17, code=13, actual=13. The sentence also ends mid-thought ("nothing to catch it boundaries").
**Fix:** pointer only — "no new wildcard projections; `pnpm run check:db-projections` is the ratchet".

### P0-7. Config statements inverted or unenforced
- `mms-testing-observability.md:27` claims Vitest runs *non-isolated* (`threads: { isolate: false }`). **Verified:** `apps/backend/vitest.config.ts:26` sets `isolate: true`; nothing sets `false`; `threads.isolate` is not a Vitest option.
- `mms-testing-observability.md:18` prescribes **MSW**, which is not a dependency of any workspace package — while `mms-agent-universal.md:66` forbids inventing dependencies.
- `mms-dependencies.md:92` lists `node:test` as "Enforced". **Verified:** zero occurrences repo-wide.
- `mms-migration-status.md:16` says WCAG **2.1** AA; `mms-ui-ux-design.md:49` says **2.2** AA.
- `mms-ops-infrastructure.md:114` requires `headersTimeout` 66,000 ms; **verified** `apps/backend/src/app.ts` sets only `keepAliveTimeout: 65000` — `headersTimeout` appears nowhere, so it defaults to 60,000 ms and does not exceed the proxy.
- `mms-hooks.md:54` routes agents to `useContactStandardConfig`, `useContactConfigPrefs`, `useContactsConfigEnhance` — **verified 0 occurrences** in `apps/frontend/src`.
- `Shared` component names cited but absent: `ArchivedBanner` (**verified:** 0 `<ArchivedBanner` usages; only per-module `{Module}ArchivedBanner` + `DetailDrawerArchivedBanner`), `ArchivedBanner` in 3 skills, `ModuleFilterDropdown`/`ModuleFilterCheckboxGroup`/`ModuleFilterRadioGroup`/`DrawerSyncStatusFooter` (real primitive: `ModuleFiltersMenuButton`), `runAuditVerificationJob` (real: `startAuditVerificationScheduler`), `ContactsSettingsPanel.tsx`, `ContactsCountryCodesSection.tsx`, `handleContactSaveOrUpdate`, `whatsAppService`, `lib/backup/`.

### P0-8. Two worker paths that do not exist
`mms-module-architecture.md:52,53` cite `worker.ts` and `jobRunnerProcess.ts`. Neither exists anywhere in the repo; the real entry point is `apps/backend/src/worker/index.ts`.

### P0-9. Contradiction between two always-on rules
`mms-agent-universal.md:62` — *"❌ NEVER execute `cd` in tool commands"*. `mms-completion-review.md:21-22` — *"`cd apps/frontend && pnpm lint`"*. **15+ files** use `cd apps/...`, including `mms-dev-setup`, `mms-code-review`, `mms-frontend`, `mms-migration-fixes`. An agent following the ban cannot run the mandatory verification table.
**Fix:** the ban is Antigravity-specific tool semantics. Either scope it to Antigravity frontmatter or delete it and mandate `--filter`/absolute paths consistently.

Related tool leakage in the same "universal" file: `replace_file_content` (L36) and the `Cwd` parameter (L62) are not tools in Claude Code or DSH. A rule titled "Universal … across Cursor, Antigravity, and Claude Code" should not name one tool's API.

### P0-10. The feature-firing command is wrong in 3 documents
`mms-code-review/SKILL.md:62`, `mms-frontend/SKILL.md:38`, `mms-testing-observability.md:19` prescribe `pnpm exec playwright test`. **Verified:** `node_modules/.bin/playwright` does not exist at the root and `@playwright/test` is only in `e2e/package.json`, so `pnpm exec` from the root fails; `mms-frontend:38` compounds it by `cd apps/frontend` first. The working forms are `pnpm test:e2e` (root script) or `pnpm --filter e2e-tests exec playwright test tests/<spec>`.
Also: `mms-code-review:62` and `mms-migration-fixes:55` cite `e2e/tests/onboarding-login.spec.ts`, which does not exist (the real spec is `platform-onboarding.spec.ts`).

### P0-11. The CI verifier's blind spots (the meta-defect)
`verify-rules-integrity.mjs:254` only validates backticked paths matching `(apps|packages|scripts|docs|\.agent|\.cursor|\.github)/`. Therefore it cannot see:
- anything under `e2e/` (why P0-10 passes),
- alias paths (`@/…`) and bare filenames (why P0-4 passes),
- fenced code blocks and markdown-link targets (why P0-3 passes),
- the **contents** of `examples/` and `references/` (why P0-5 passes),
- whether a script in `scripts/` is reachable from SKILL.md (why 8 orphan scripts pass),
- `globs:` frontmatter (never parsed at all),
- phantom sections (P0-2's regex problem).
It also hardcodes `30` in three places (lines 25, 32, 266), so adding a skill requires editing the verifier.

---

## 4. Priority 1 — make "forbidden" mean forbidden

Modern guidance is unambiguous and consistent across vendors: prose is a request; hooks and linters are enforcement.

> "Unlike CLAUDE.md instructions which are advisory, hooks are deterministic and guarantee the action happens… If a rule must hold every time, make it a hook rather than a prompt instruction." — [Claude Code best practices](https://code.claude.com/docs/en/best-practices)
> "Copying entire style guides: **Use a linter instead.**" — [Cursor rules](https://cursor.com/docs/rules)
> "One-off incident. **Prefer a code-level fix (lint rule, CI check, test assertion) over a new doc rule.**" — [vLLM contributor docs](https://raw.githubusercontent.com/vllm-project/vllm/main/docs/contributing/editing-agent-instructions.md)

### Current enforcement gap

| Norm (declared) | Current enforcement | Reality |
|---|---|---|
| `any` forbidden (`mms-dry.md:66`) | `no-explicit-any: "warn"` + `eslint --quiet` (drops warnings) | **154** `: any` in `apps/frontend/src` |
| Zero raw hex colors (`mms-ui-ux-design.md:39-41`) | 5 `warn`-level selectors, `bg-gray-100`/`rounded-[2rem]` have none | **31** `.tsx` files with 6-digit hex |
| File size ≤300 hard / ≤220 soft (`mms-structure-naming.md:81-82`) | none | **75** files >300 lines, 7 >500 |
| Zero non-erasable syntax (`mms-agent-universal.md:52`) | none (`erasableSyntaxOnly` not set; only `verbatimModuleSyntax`) | review-only |
| `node:` prefix (`mms-structure-naming.md:60`) | none | review-only |
| No hardcoded strings (`mms-settings-i18n.md:61`) | `pnpm check:i18n` exists — **runs in no workflow** | key parity only |
| Coverage floors | exist in `vitest.config.ts` (FE 41/39, BE 45/27) — stated in no rule | silent-regression risk |
| Lock-safe index migrations | `check:migration-indexes` **runs in CI** (`ci.yml:94`) — named by **no rule** | best value/cost fix in this document |

### Recommended enforcement ladder

1. **Promote to `error` and drop `--quiet`** for norms already expressible in ESLint (hex colors, bracket tokens, `any`, `bg-white`). Add the missing selectors (`bg-gray-100`, `rounded-[2rem]`, raw JSX `<button>|<input>|<select>|<textarea>`).
2. **Wire the checks that already exist** into `ci.yml`: `pnpm check:i18n`; cite `check:bundle` and `check:migration-indexes` from the owning rule and state their budgets in one line each.
3. **Add ratchet scripts** in the pattern the repo already uses (`check-db-projections.mjs`): `check-file-size.mjs`, a banned-dependency manifest check, an assertion-specificity rule for tests.
4. **Add hooks** (see §6.3) for the norms that must hold every time: block edits to `.env*`, run prettier/eslint on edited files, block `git push`.
5. **Relabel the remainder** as review-only so "forbidden" stops being decorative.

Set an explicit policy in `mms-agent-universal.md`: *a norm either has a machine check or is labelled advisory* — and add the check to the rule in the same commit.

---

## 5. Priority 2 — context budget

### Measured cost

| Editing… | Rules auto-attached | Words (~tokens) |
|---|---|---|
| a module form (`StudentForm.tsx`) | 9 of 21 | 10,214 (~13.8k) |
| a module page | 8 of 21 | 8,883 (~12.0k) |
| a backend route | 8 of 21 | 10,347 (~14.0k) |
| always-on floor | 3 | 2,576 (~3.5k) |

Two structural causes:

**(a) `mms-performance.mdc` globs match 97.4% of the source tree** (`apps/backend/**`, `apps/frontend/**`, `packages/shared/**` — 4,078 of 4,185 files) while declaring `alwaysApply: false`. **12 of the 18 "scoped" rules are strict subsets of it.** It is a fourth always-on rule in disguise, and it also matches build output (`dist/`).
Additionally **17 glob strings are byte-identical across 2–3 rules**; `apps/frontend/src/tenant/features/**` (1,502 files) is declared by three rules at once.
**Fix:** narrow `mms-performance.mdc` to the paths where the performance norms actually apply (DB/repository/query files, virtualized tables, bundle entries), and delete duplicate globs so each path loads one owner.

**(b) The always-on set is ~45–50% restatement.**

| Block | Words | Already owned by |
|---|---|---|
| `mms-core.md:58-85` Standards Index (26 rows) | 332 | `.cursor/rules/README.md` + `AGENTS.md` (a 3rd copy) |
| `mms-completion-review.md:34-60` "Fix before done" (25 rows) | 399 (54% of file) | each row's own rule; 2–3 rows ever apply |
| `mms-core.md:45-56` tenant/platform invariants | ~300 | data-layer / auth-security / module-architecture |
| `mms-agent-universal.md:50-53` Node 24 / ERM / TS | ~150 | `mms-dependencies.md:77-95` (canonical) |
| `mms-core.md:12-22` stack + pins | ~160 | `mms-dependencies.md:14-61` |
| `mms-core.md:87-93` performance & edit discipline | 120 | `mms-performance.md` §4–§5 |

`mms-agent-universal.md:23` is a near-verbatim twin of `mms-core.md:90` — **inside the same always-on set**. Memoization appears 5× across rules (189 words).

**Fix:** always-on keeps only what every task needs (plan → verify → never commit → secrets → tool discipline). The ownership matrix moves to `.cursor/rules/README.md` (already exists); the 25-row fix table becomes part of the `mms-code-review` skill.

**Calibration note:** the widely-cited "150–200 instructions" limit is folklore — it traces to a blog's interpretation of the IFScale paper ([arXiv 2507.11538](https://arxiv.org/abs/2507.11538), which reports 68% accuracy at *500* instructions and contains no such threshold), and a 1,650-session factorial study found **no detectable effect** for file size, position, or contradictions ([arXiv 2605.10039](https://arxiv.org/abs/2605.10039)). The only surviving effect is **within-session** compliance decay (~5.6% per additional generated function). Practical reading: shrink the always-on set because it is *wasted* every turn, not because a magic number was breached — and treat session length as the real risk factor.

### Progressive disclosure (skills)

18 of 30 skills are a single SKILL.md. Concrete extraction targets for the largest:

| Skill | Lines | Move to `references/` |
|---|---|---|
| `mms-code-review` | 218 | the 29-row "Modern practices" table (L14-42) and the ~140-line checklist (L64-206, 64% of the file) |
| `mms-backend-api` | 161 | the 40-item "New route checklist" (L90-126); note L70-74 is **byte-identical** to `mms-schema-migrate` L83-88 — dedupe, don't move twice |
| `mms-backend-security` | 155 | merge the two overlapping checklists (L100-109 + L132-143); delete the RBAC table (L43-54), which duplicates `references/auth-rbac-matrix.md:7-18` verbatim |
| `mms-reports-export` | 147 | ~55 lines of checklists (L86-143) |
| `mms-migration-fixes` | 145 | the 61-row "Resolved" table (L19-79, 42% of file) — its own L12 says that content belongs in `docs/migration-milestones.md` |

Spec ceiling is **<500 lines per SKILL.md** ([agentskills.io spec](https://agentskills.io/specification)) — all are inside it, so this is about token economy on activation, not compliance.

### Rules↔skills duplication

Rules are supposed to be the norm SSOT. Confirmed duplicates:

- BiDi matrix duplicated row-for-row: `mms-ui-ux-design/SKILL.md:104-110` ≡ `rules/mms-ui-ux-design.md:62-72` (a third copy at `mms-frontend:31-36`).
- `mms-messaging/SKILL.md` is a 50-line subset of its 56-line rule (SKILL:42 ≡ rule:30; :34 ≡ :46; :40 ≡ :24 verbatim).
- "Virtualize >30 items" in **7 locations across 6 skills** while `mms-performance.md:87` + `mms-ui-ux-design.md:91` own it.
- `crypto.hash()` in 4 skills vs 3 rules; banned-dependency list in 2 skills vs 2 rules; ~20 restated security-checklist items between `mms-code-review` and `mms-backend-security`.
- Rule bodies also duplicate each other: Node-24/`node:`/`using` spans 7 files (~440 words, owner `mms-dependencies.md` §3); soft-delete Work UX ~330 words across 3; partial-unique-index + 23505 across 6 files; money regex in 3 files. Estimated **12–15% of the corpus is restatement**, against `rules/README.md:57`'s own policy ("Single prose owner per topic").

---

## 6. Priority 3 — modernise the tooling layer

### 6.1 `AGENTS.md` as the real source of truth

`AGENTS.md` is now the cross-tool standard (Linux Foundation–stewarded), read natively by Cursor, Codex, VS Code/Copilot agents, Windsurf and Zed. **Claude Code does not read it** — it reads `CLAUDE.md` only, and the sanctioned bridge is an `@AGENTS.md` import ([Claude Code memory](https://code.claude.com/docs/en/memory)).

Current state: `CLAUDE.md` duplicates `AGENTS.md` prose and links to it, so the two can drift (and `verify-rules-integrity.mjs` had to grow a check for exactly that).
**Fix:** make `CLAUDE.md` a thin wrapper — `@AGENTS.md` on line 1, then Claude-only content (`paths:` semantics, hook notes). Target **<200 lines** for the always-on file (Anthropic's "target under 200 lines per CLAUDE.md"; vLLM states the same for AGENTS.md independently).

Also: `AGENTS.md:34` documents the sync policy as "update `.cursor/rules/` **and** `.agent/rules/`", but `sync-rules.sh` **generates** `.agent/rules/` from `.cursor/rules/` and *deletes* anything not present there (line 24, `fs.unlinkSync`). Following the documented instruction destroys the edit. `CLAUDE.md` states the correct flow. Pick one direction — recommended: `.cursor/rules/*.mdc` and `.agent/skills/*/SKILL.md` are canonical (as today) — and state it once, plus add a `--dry-run` to the destructive prune.

While in there: `sync-rules.sh:38` rewrites `.mdc` → `.md` **context-blind**, which corrupts the Cursor-directory reference (`.agent/rules/mms-agent-universal.md:58` now says `.cursor/rules/*.md`, which does not exist). Make the rewrite path-aware or leave `.cursor/...` strings alone.

### 6.2 Fill the empty tooling surfaces

| Surface | State | Recommendation |
|---|---|---|
| `.cursor/hooks.json` + `.cursor/hooks/_common.py` | **0 bytes** (both) — **resolved**: `hooks.json` is now a valid manifest; `_common.py` deleted 2026-10-11 | Empty files are broken config, not placeholders |
| `.claude/settings.json` | committed with `"allow": [], "deny": []` | Commit a real team baseline: `deny` rules apply immediately (unlike `allow`, which waits for workspace trust) — e.g. deny `Read(./.env*)`, `Bash(git push *)`, `Bash(rm -rf *)` |
| `.claude/settings.local.json` | 88 personal `allow` entries, 0 `deny`, no hooks (gitignored) | Symptom of permission fatigue — replace repeated one-off allows with hooks and a small deny list |
| `.claude/commands/` | absent | 7 skills reference `/feature-module` and `/code-review` as slash commands (47 such references) but the commands exist in **no** tool. Expose the 6 `.agent/workflows/*.md` as command/skill entrypoints, or change the references to file paths |
| `.claude/agents/` | absent | Add read-only subagents for context isolation — the official decision rule is "use a subagent when you need context isolation or your context window is getting full" ([features overview](https://code.claude.com/docs/en/features-overview)). Best candidates: code review, a11y audit, test-run triage, dependency audit |
| `.mcp.json` / `.cursor/mcp.json` | absent | Optional; if Playwright/Postgres/Sentry MCP servers are used locally, commit `.mcp.json` (team scope) with `${VAR}` interpolation, never secrets |

### 6.3 Hooks: make the mandatory steps automatic

Claude Code hooks are **portable to Cursor natively** (Cursor loads `.claude/settings.json` hooks and maps `PreToolUse`→`preToolUse`, `Edit`→`Write`), which means one hook layer serves two tools while the prose layer stays minimal.

Recommended set:
- `PostToolUse` matcher `Edit|Write` → prettier + `eslint --fix` on the edited file (the documented auto-format pattern; catches the formatting norms without prose).
- `PreToolUse` → block writes to `.env*`, `.gitleaks.toml`, `apps/backend/src/db/migrations_drizzle/**` without explicit confirmation.
- `PreToolUse` → block `git push` (the user handles pushes per `mms-agent-universal.md:56`).
- Optional `Stop` hook (`type: "prompt"`) → "did the change run typecheck/lint?" — judgment-based gates. **Note:** exit code `2` blocks; exit code `1` does **not** — a policy hook that exits 1 silently allows the action.
- `InstructionsLoaded` (Claude Code) → log which rule files actually loaded; this is the first-party way to prove scoping works.

### 6.4 Skill frontmatter: use the optional fields

All 30 skills use only `name` + `description`. The Agent Skills spec supports `license`, `compatibility`, `metadata` (string→string), and experimental `allowed-tools`; Claude Code also supports `model`, `context: fork`, `disable-model-invocation`. Concrete additions:

- `metadata.last-verified` + `metadata.owner` on all 30 — this review found ~40 stale claims and 8 broken/unreachable code samples, and **nothing in the repo records freshness**. Add a CI check that fails when `last-verified` is older than N months *and* the file changed since.
- `allowed-tools` on read-only skills (`mms-code-review`, `mms-a11y-smoke`, `mms-testing-e2e`, `mms-migration-fixes`, `antigravity-workspace`) — e.g. `allowed-tools: Read Grep Glob Bash(pnpm typecheck) Bash(pnpm test)`.
- `compatibility` on skills needing live infra (`mms-testing-e2e`, `mms-a11y-smoke`, `mms-dev-setup`, `mms-ops-deploy`).
- `license: Proprietary` (private repo).

Description hygiene: all 30 are within the 1024-char spec cap (longest 478). Six descriptions collide as triggers — most importantly `mms-a11y-smoke` ("Use when authoring or refactoring UI components…") fires on *all* UI work and collides with `mms-ui-ux-design` and `mms-frontend`; rewrite around the verification act. Others: `mms-code-review` vs `mms-backend-security` on "security review of a PR"; `mms-linux-compatibility` vs `mms-ops-deploy` on "preparing deploy"; `mms-migration-fixes` has no path anchor. Also trim `mms-backend-security`'s 10-keyword enumeration — descriptions are loaded for all 30 skills on every turn.

**Ownership conflict to settle first:** `mms-fields-registry` claims "module Setup Fields UI" while `mms-module-setup` owns the Setup tier and lists "custom field definitions (use mms-fields-registry)" as its Do-NOT — and `README.md:18` + `rules/mms-fields.md:8` side with `mms-module-setup`. Two skills claim one job, so the wrong one will fire.

### 6.5 Verify that rules actually fire

Nothing currently measures whether a rule or skill is ever invoked. Available now: `claude plugin eval` with a deterministic `tool_used: Skill` + `input_match` grader (the official answer to "my skill isn't triggering"); `/skill-doctor` for per-skill context cost and invocation counts; the `InstructionsLoaded` hook for load-time evidence. Cursor has no first-party equivalent — another argument for keeping trigger-critical logic in the Claude-readable layer and enforcing via portable hooks.

---

## 7. Priority 4 — governance & CI validation

Upgrade `scripts/verify-rules-integrity.mjs` from a path/format checker to a **standards linter**. It already has the machinery; extend it:

1. Parse `globs:`/`paths:` frontmatter and assert every glob's base directory exists. (Two globs target nonexistent directories today: `apps/backend/drizzle/**` — real path is `src/db/migrations_drizzle/`; `scripts/pm2/**` — real artifact is `scripts/production/setup-pm2-startup.sh`. Five more globs match zero files: both `platform/**/hooks/use*Write|Form*.ts`, `platform/**/*hook*`, `tenant/features/**/reports/**`, `platform/**/*Analytics*`. `docs/migration-*` misses `docs/MigrationPlan.md` / `MigrationPhases.md` because of case.)
2. Validate referenced paths in **all** skill files, not just SKILL.md — `examples/` and `references/` are unvalidated today, which is why 8 broken samples pass.
3. Type-check-adjacent validation for `examples/*.ts(x)`: at minimum assert every import specifier resolves (alias-aware) — that alone would have caught P0-4 and P0-5.
4. Assert every `scripts/*` file is referenced from its SKILL.md (7 are orphans today) and that referenced scripts are executable.
5. Bound section matching to the heading's own number (kills P0-2).
6. Replace the hardcoded `30` with a derived count.
7. Add a freshness check driven by `metadata.last-verified`.

Governance additions:
- **Offset-the-addition rule** (from vLLM): every new rule/skill instruction must remove or consolidate something, or justify why not. This is the only bloat control that has held up in practice.
- **Prefer a code-level fix over a new doc rule** — one-off incident → lint rule / CI check / test assertion, not prose.
- **Review on failure, not on a calendar** (vendor guidance) *plus* the freshness check above, since 58% of agent-config files in the wild are single-commit and never revisited.
- **Enforcement registry:** a table in `rules/README.md` mapping each norm → its enforcing check (or "advisory"). Makes the §4 gap visible and reviewable.

---

## 8. Gaps — norms and capabilities with no owner

**Missing rules**
1. **Migration lock safety / zero-downtime DDL** — `ci.yml:91-95` encodes it and `create-index-concurrently.ts` implements it, but `grep CONCURRENTLY .agent/rules/` = 0 hits. Highest-impact omission: an agent adding an index to a large table writes a write-blocking migration.
2. **Secrets & env-var lifecycle** — nothing requires updating `apps/backend/.env.example` when an env var is added; no rotation cadence or per-env scoping.
3. **Coverage floors** — they exist (FE 41/39, BE 45/27) and gate CI, and no rule names them or forbids lowering them.
4. **Error handling / observability beyond logging** — FE non-API failures, `ErrorBoundary` granularity, retry/backoff beyond 429, and surfacing `x-request-id`/`traceparent` in UI error reports.
5. **Queue/job contract** — retry/backoff, dead-letter, concurrency, priority (BullMQ is live; only "use an idempotency key" exists).
6. **Business-date/timezone semantics** — which dates are tenant-local calendar days, DST boundaries, and what "Gregorian only" means for stored values.
7. **API versioning/deprecation**; **alerting/SLO ownership**; **code-review criteria** (PR size, second reviewer, treatment of pre-existing violations — "change boundary" is used 10+ times and never defined); **a11y beyond the current set** (table `aria-sort`/`scope`, live regions for jobs, `forced-colors`).

**Missing skills**
1. **Incident → rollback runbook** — `deploy-rollback.sh`, `server-diagnose.sh`, `deploy-recover-backend.sh`, `.deploy-releases/` each appear once in a table, with no diagnose→rollback→verify procedure.
2. **DB performance triage** — `docs/db-performance-audit.md`, `benchmark:worker`, `audit:partitions`, `check:db-projections` exist with no playbook; `mms-schema-migrate` is DDL-authoring only.
3. **Worker/queue ops triage** — job stuck/failed → inspect → replay.
4. **Error-tracking triage** — Sentry is wired and `traceparent → correlation_id` is mandated in 5 skills, but nothing covers "Sentry issue → trace → audit row".
5. **Dependency-vulnerability response** — `pnpm-workspace.yaml` already contains a hand-written CVE reachability/why-not-override rationale (ts-deepmerge) that is a norm with no owner.
6. **Agent-standards maintenance itself** — authoring/validating SKILL.md, designing triggers, keeping examples compiling, detecting the verifier's blind spots.
7. **i18n completeness** (`check:i18n` is mentioned once and runs in no workflow); **platform-apex console/onboarding**; **release/versioning/changelog**; **feature flags**.

---

## 9. Proposed target architecture

```
AGENTS.md                     ← single human-readable SSOT for behaviour (<200 lines)
CLAUDE.md                     ← "@AGENTS.md" import + Claude-only notes (thin wrapper)
.cursor/rules/*.mdc           ← canonical scoped rule bodies (globs + alwaysApply)
  └─ .agent/rules/*.md, .claude/rules/*.md   ← GENERATED (never hand-edited; dry-run prune)
.agent/skills/*/SKILL.md      ← canonical skills (SKILL.md <500 lines + references/ + scripts/)
  └─ .cursor/skills, .claude/skills          ← GENERATED
.claude/settings.json         ← committed baseline: deny-list + shared hooks (team)
.claude/agents/*.md           ← read-only subagents: code-review, a11y, test-triage, deps
.claude/commands/*.md  (or skill entrypoints for the 6 workflows)
hooks (Claude + Cursor)       ← format-on-edit, guard .env/migrations/git-push
scripts/verify-agent-standards.mjs  ← extended verifier (globs, examples, scripts, freshness)
```

Principle to add to `mms-agent-universal.md`: **every norm is either machine-enforced or explicitly labelled advisory**, and every rule change is net-neutral in size.

---

## 10. Ordered roadmap

Each step is independently verifiable; stop anywhere and the repo is better.

| # | Change | Verification |
|---|---|---|
| 1 | Fix P0-1..P0-3 (queue contradiction, phantom §7, dead verify commands) | `grep -rn "§7" .agent/rules`; run both skills' verify commands |
| 2 | Fix the broken examples (P0-4, P0-5) — repair or delete | import-resolution check |
| 3 | Fix P0-6..P0-10 numbers, config claims, symbols, paths, `cd` contradiction, playwright command | re-run each cited script; grep each symbol |
| 4 | Extend `verify-rules-integrity.mjs` (§7 items 1–7) | inject a bad glob/example and confirm CI fails |
| 5 | Promote ESLint norms to `error`, drop `--quiet`, wire `check:i18n` into CI (§4) | `pnpm lint` fails on a hex colour and an `any` |
| 6 | Shrink the always-on set (§5) — move matrix and fix-table out | always-on ≤ ~1,300 words |
| 7 | Narrow `mms-performance.mdc` globs; de-duplicate shared globs | re-run the attach-count script (§5 table) |
| 8 | Make `CLAUDE.md` an `@AGENTS.md` wrapper; fix the AGENTS.md sync-policy text; add `--dry-run` to prune | `sync-all.sh` idempotent; no drift in CI |
| 9 | Add hooks + committed `settings.json` deny-list; delete or implement `.cursor/hooks.json` | attempt a `.env` write and a `git push` → blocked |
| 10 | Add `metadata.last-verified`/`owner`; add `allowed-tools` to read-only skills; fix colliding descriptions; settle fields-registry vs module-setup | verifier freshness check |
| 11 | Add the 4 subagents and expose the workflows as commands/skills | `/feature-module` resolves; subagent keeps review context isolated |
| 12 | Add the missing rules/skills (§8) — start with migration lock safety and the incident runbook | each lands with its enforcement check |

---

## Appendix A — verification status

Independently re-verified by hand in this session (all confirmed): the phantom §7 section and its six citations; `check-db-projections` baseline 13 vs rule 18; `node:test` = 0 occurrences; `useContactStandardConfig`/`useContactConfigPrefs`/`useContactsConfigEnhance` = 0; `isolate: true` and no `isolate: false`; missing `headersTimeout`; BullMQ/Redis/worker-service contradiction; `--filter @mms/backend` + nonexistent `test:inject`; the five broken `mms-module-page` imports and the `onTabChange` prop; `FormModal` real props; zero `<ArchivedBanner` usages vs per-module variants; 7 orphaned skill scripts; 13 absolute `file:///Users/…` links; `audit-deps.sh` `|| true` false-green; `smoke-a11y.sh` unconditional `exit 0`; missing `e2e/tests/onboarding-login.spec.ts`; no root `playwright` binary; the `cd` ban vs 15+ `cd apps/...` usages; `replace_file_content`/`Cwd` tool leakage; empty `.cursor/hooks.json` and empty committed `.claude/settings.json`; 88 allow / 0 deny / no hooks in `settings.local.json`; absent `commands`/`agents`/`.mcp.json`; the `sync-rules.sh` prune + context-blind `.mdc` rewrite; hardcoded `30` in the verifier; glob attach counts and token costs; 154 `any` / 31 hex / 75 files >300 lines; 27 files with `forwardRef`.

Reported by the deep audits and spot-checked, but not individually re-verified line-by-line: the remaining stale-identifier list (§3 P0-7 second half), the rules↔skills duplication line numbers (§5), the `examples/`/`references/` content defects (P0-5 tail, `query-ast-filter.ts` vs `docs/soft-delete.md` §2.7, `audit-partitions.sql` vs the Drizzle schema, `cdc-outbox.ts`), the script tautology/false-skip findings (`check-migrations.sh`, `verify-soft-delete-schema.sh`), and the CI-description drift in `mms-ops-infrastructure.md:92-100`. Treat these as high-confidence leads to confirm at fix time.

## Appendix B — best-practice sources

- AGENTS.md standard — [agents.md](https://agents.md/) (closest-file-wins; nesting; Linux Foundation stewardship)
- Claude Code memory/CLAUDE.md, `@path` imports, 4 MiB skip limit — [code.claude.com/docs/en/memory](https://code.claude.com/docs/en/memory)
- Agent Skills spec — [agentskills.io/specification](https://agentskills.io/specification) (name ≤64, description ≤1024, SKILL.md <500 lines, references one level deep)
- Claude Code skills (frontmatter fields, 1,536-char listing truncation, `/skill-doctor`) — [code.claude.com/docs/en/skills](https://code.claude.com/docs/en/skills)
- Subagents (context isolation; 15k-token description warning) — [code.claude.com/docs/en/sub-agents](https://code.claude.com/docs/en/sub-agents)
- Hooks (deterministic enforcement; exit 2 blocks, exit 1 does not; Cursor loads Claude hooks) — [code.claude.com/docs/en/hooks](https://code.claude.com/docs/en/hooks), [cursor.com/docs/reference/third-party-hooks](https://cursor.com/docs/reference/third-party-hooks)
- Permissions (deny → ask → allow; deny applies before workspace trust) — [code.claude.com/docs/en/permissions](https://code.claude.com/docs/en/permissions)
- Cursor rules (`.mdc` required, four rule types, <500 lines, "use a linter instead") — [cursor.com/docs/rules](https://cursor.com/docs/rules)
- Rule-firing evals — [code.claude.com/docs/en/plugin-evals](https://code.claude.com/docs/en/plugin-evals)
- Instruction-count evidence — [arXiv 2507.11538 (IFScale)](https://arxiv.org/abs/2507.11538), [arXiv 2605.10039 (factorial study)](https://arxiv.org/abs/2605.10039)
- Prose→linter conversion, offset-the-addition — [vLLM agent-instructions guide](https://raw.githubusercontent.com/vllm-project/vllm/main/docs/contributing/editing-agent-instructions.md)
