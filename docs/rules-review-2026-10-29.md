# MMS Agent Standards Review — 2026-10-29

Read-only audit of the 22-rule agent standards corpus (`.cursor/rules/*.mdc`, mirrored to
`.agent/rules/` and `.claude/rules/`), plus the index that governs it
([`.cursor/rules/README.md`](../.cursor/rules/README.md)). Findings are evidence-backed against
the tree at `a729f0b9e` **plus the uncommitted TDD/adversarial-audit change set** (9 rule files,
`AGENTS.md`, PR template).

**Verdict: the corpus is mechanically sound but factually drifted.** Integrity, mirror sync,
glob liveness and the rule/skill counts all pass; the enforcement registry matches real scripts.
What does not hold is the *content*: 6 contradictions with the codebase or between rules, 12
medium drift/ownership defects, and 4 low polish issues. The riskiest cluster is the newest
change (Strict TDD + Adversarial Audit), which is stated as mandatory but is enforced by nothing
and is attached to a rule that only loads for test files.

> **Status:** all 22 findings were fixed in a follow-up pass the same day — see
> [§5 Resolution log](#5-resolution-log-fix-pass-same-day). §1–§4 are the as-found record; the
> corpus is now 23 rules (2 always-on + 21 scoped) with `mms-tdd` owning test-first delivery.

---

## 1. Method & mechanical state

| Check | Command | Result |
| --- | --- | --- |
| Standards integrity gate | `node scripts/verify-rules-integrity.mjs` | **pass** — 49 skills, 22 rules, frontmatter/imports/citations/globs clean |
| Mirror drift | `bash .agent/scripts/sync-all.sh --dry-run` + body diff across the 3 trees | **in sync** — 18/22 bodies differ only by the sanctioned `.mdc`→`.md` reference rewrite |
| Glob liveness | every `globs:` entry expanded against `git ls-files` | **0 dead globs**; match counts range 18 (`mms-dependencies`) → 2,272 (`mms-ui-ux-design`) |
| Always-on surface | frontmatter scan | **1** (`mms-core`) — matches `AGENTS.md` and the README |
| Enforcement artefacts | 30 spot-checked symbols + 8 files/scripts | 29/30 resolve; the 1 miss is H3 (`crypto.randomUUIDv7`) |
| Rule/skill counts | `AGENTS.md`, `.agent/skills/README.md` | **22 rules / 49 skills** — accurate |

Not re-run here: full `pnpm ci:local` (this change is docs-only; the rules are not executable).

---

## 2. Findings

Severity: **H** breaks a decision or makes an agent write wrong code · **M** misleads, drifts, or
creates an unenforceable mandate · **L** polish / wording.

### H1 — Strict TDD is mandatory, unenforced, and scoped to test files

* `.cursor/rules/mms-testing-observability.mdc:12-16` (new) makes Red→Green→Refactor mandatory
  for "any business logic, use-case handler, service, or repository code".
* That rule's `globs:` (`:3`) match **only** test files, vitest configs, `ErrorBoundary.tsx` and
  `clientErrorReporting.ts`. A diff to `apps/backend/src/finance/use-cases/*.ts` never attaches it.
* `mms-core.mdc:24` and `AGENTS.md:70` repeat the mandate, but the corpus' own law
  (`mms-agent-universal.mdc:33`, `README.md:112`) is: *a norm is machine-enforced or explicitly
  labelled advisory*. TDD is neither. No script, hook, test or CI job can detect test-first.
* "Confirm and document that the test fails specifically for the targeted reason" names no
  artefact; the PR-template checkbox is self-attestation, not evidence.

**Fix:** pick one — (a) attach the norm to a source-scoped rule (add the service/use-case/repo
globs) **and** land a real signal: a `--changed` ratchet that fails when a changed
`src/**/{services,use-cases,repository}/**` file has no added/updated sibling `*.test.ts` in the
same diff; or (b) keep the prose and label it **advisory** in the rule and the registry. Also
state where the Red evidence goes (PR body bullet, not a checkbox).

### H2 — Coverage floors: three incompatible truths

* `mms-testing-observability.mdc:66-72` mandates 95/90/95 for domain logic and "80/75/80" as the
  global package minimum for *every* addition.
* Enforced reality: `apps/frontend/vitest.config.ts:114-118` (56/55/46/51),
  `apps/backend/vitest.config.ts:59-63` (46/43.5/41/33),
  `packages/shared/vitest.config.ts:25-29` (79/75/72/57).
* `README.md:143` states yet a third version ("FE 55/50, BE 45/27").

An agent following the rule cannot satisfy it, and the mismatch hides the real gate (the
per-package `thresholds` block) behind an aspiration it will not be measured against.

**Fix:** delete the table's percentages; replace with "never lower the configured `thresholds`
in each workspace's `vitest.config.ts` (SSOT) and raise them with measured values" + the existing
"The Ratchet Rule" bullet. Update `README.md:143` to the measured floors, including shared.

### H3 — `crypto.randomUUIDv7()` does not exist

`mms-data-layer.mdc:14` mandates "sequential **UUIDv7** (`crypto.randomUUIDv7()`)". Node 24 has
no such API (only `crypto.randomUUID()` → v4), and the string appears nowhere in the tree.
The project SSOT is `uuidv7()` from `@mms/shared`
([`packages/shared/src/core/uuidv7.ts`](../packages/shared/src/core/uuidv7.ts)), used by
`apps/backend/src/db/repositories/academicCatalogReferences.ts:177` and others.

**Fix:** `uuidv7()` from `@mms/shared` (and note PostgreSQL 16 has no built-in, which the shared
module's docblock already explains).

### H4 — The BiDi review checklist bans the classes it mandates

`mms-ui-ux-design.mdc:63`: "Zero physical direction classes (`ps-*`, `ms-*`, `start-*`,
`border-s-*`, `rtl:rotate-180`)" — every example is a **logical** class, contradicting `:33`
(which mandates them) and the ESLint rule `apps/frontend/eslint-rules/no-physical-directional-classes.cjs`
(which bans `pl-*`, `mr-*`, `text-left`, …). A reviewer running §8 would flag correct code.

**Fix:** list the physical tokens (`pl-*`, `pr-*`, `ml-*`, `mr-*`, `text-left`, `text-right`,
`border-l-*`, `border-r-*`, `rounded-l-*`, `rounded-r-*`) or just point at §3.

### H5 — `pnpm test:db` is not a root script

`mms-testing-observability.mdc:113` (§12, new) says run "`pnpm test:db`". Root `package.json`
exposes `test`, `test:coverage`, `test:e2e` only; the DB suite is
`pnpm --filter mms-backend run test:db` — which §1 (`:19`) gets right.

**Fix:** use the filtered form in §12 (or add a root alias if `--with-db` should call it).

### H6 — `@mms/shared` subpath policy contradicts itself, and the rule that is wrong is the "SSOT" one

`mms-dry.mdc:37`: "Named exports only; **subpath imports banned**."
`mms-structure-naming.mdc:15`: "Consumers import `@mms/shared` **or the declared subpaths**
(`tenantUtils`, `translations/{en,ar,ur,fa}`) only."
Reality: `packages/shared/package.json` exports exactly those 5 subpaths, and
`apps/frontend/src/App.tsx:2`, `main.tsx:6`, `TenantContext.tsx:7`, `tenantConfig.ts:8` import
`@mms/shared/tenantUtils`.

**Fix:** in `mms-dry.mdc:37` scope the ban to *undeclared* subpaths and point at the exports map.

### M1 — Dependency versions in prose are already stale (10 of 10)

`mms-dependencies.mdc:12-14` vs `pnpm-workspace.yaml:15-25` and `e2e/package.json`:

| Package | Rule | Catalog / actual |
| --- | --- | --- |
| react / react-dom | `^19.3.0` | `^19.3.1` |
| vite | `^8.3.0` | `^8.3.4` |
| fastify | `^5.12.5` | `^5.12.7` |
| pino | `^10.3.1` | `^10.4.0` |
| drizzle-orm | `^0.45.3` | `^0.45.4` |
| @tanstack/react-query | `^5.103.2` | `^5.104.4` |
| zod | `^4.6.5` | `^4.6.7` |
| turbo | `^2.11.7` | `^2.11.9` (root `package.json`) |
| @playwright/test | `^1.63.0` | `^1.64.1` |
| axe-core | `^4.13.0` | `^4.14.0` |

**Fix:** the catalog is the SSOT — cite `pnpm-workspace.yaml` and keep only the majors policy in
prose. If exact numbers stay, land a drift check that fails when a rule-stated version diverges
from the catalog (all 10 rows would have fired at the last catalog bump).

### M2 — `pnpm.onlyBuiltDependencies` is not the field this repo uses

`mms-dependencies.mdc:34` mandates a "`pnpm.onlyBuiltDependencies` allowlist". The allowlist
lives at `pnpm-workspace.yaml:8-14` under **`allowBuilds`** (pnpm 11), and no
`onlyBuiltDependencies` key exists anywhere.

**Fix:** name `allowBuilds` (or, better, "the build-script allowlist in `pnpm-workspace.yaml`").

### M3 — `erasableSyntaxOnly` is claimed as required but is enabled nowhere

`mms-dependencies.mdc:42` requires `erasableSyntaxOnly`. Only `verbatimModuleSyntax` is set
(`tsconfig.base.json:15`); `erasableSyntaxOnly` appears in no tsconfig. The banned constructs
(`enum`, `namespace`, parameter properties) are therefore review-only.

**Fix:** either set the compiler flag (then the ban is machine-enforced) or drop it from the
"Required" list and mark the section advisory.

### M4 — OpenTelemetry / `AsyncContextFrame` citations do not match the runtime

* `mms-testing-observability.mdc:85` requires alignment with "OpenTelemetry v1.26+ conventions".
  There is **no** `@opentelemetry/*` dependency in any workspace, and "v1.26+" is not a resolvable
  spec/JS-SDK version — nothing can be aligned or checked.
* Four rules name `AsyncContextFrame` as the propagation mechanism (`mms-dependencies.mdc:28`,
  `mms-ops-infrastructure.mdc:17`, `mms-auth-security.mdc:44`, `mms-testing-observability.mdc:83`).
  The code uses plain `new AsyncLocalStorage()` (`apps/backend/src/lib/tenantContext.ts:1-6`) and
  starts without `--experimental-async-context-frame`.

**Fix:** say `AsyncLocalStorage`; drop or restate the OTel sentence as "field naming follows
OpenTelemetry semantic conventions (advisory, no SDK installed)".

### M5 — `validation_error` is documented as both 422 and 400, and both are in the code

* `mms-api-interface.mdc:27`: `validation_error` (422).
* `mms-api-interface.mdc:43`, `mms-data-layer.mdc:62`, `mms-testing-observability.mdc:98`:
  restore/uniqueness conflicts → 400 `validation_error`.
* Code does both: `apps/backend/src/routes/tenant/contacts/contactSoftDeleteRoutes.ts:31-38`
  returns 400, while accounting paths return 422.

The exception is never stated where the taxonomy is defined, so a new endpoint has no rule to
follow.

**Fix:** in §4 add the carve-out — "422 for request-body/Zod faults; 400 for domain uniqueness
conflicts surfaced on restore (`mapRestoreError`)".

### M6 — The "uniform error envelope" list omits two families the corpus defines

`mms-api-interface.mdc:27` is presented as the classification list but lacks
`session_revoked` (`mms-auth-security.mdc:16`) and the module-denial codes
`MODULE_NOT_GRANTED` / `MODULE_DISABLED` / `PERMISSION_DENIED` / `MODULE_ACCESS_UNAVAILABLE`
(`mms-auth-security.mdc:28`, real in `packages/shared/src/settings/moduleAccessPolicy.ts:31-34`).
Clients key on `type`/`code`, so an incomplete list is a contract hole.

**Fix:** add "platform/auth-specific types are extensions of this list — see the owner rules",
and name both.

### M7 — §12 mandates DB integration tests that local CI cannot run by default

`mms-testing-observability.mdc:107` requires a live-DB integration test for *any* Drizzle
schema/migration/query change, and `:21` forbids skip latches when the DB is down. But
`pnpm ci:local` runs without a database unless `--with-db` is passed
(`mms-ops-infrastructure.mdc:28`), and `test-backend-db` is path-gated in CI. Nothing detects a
missing integration test.

**Fix:** state the required local command for DB-touching changes
(`pnpm ci:local --with-db`) in the same bullet, and label the "any change requires it" clause
advisory until a check exists.

### M8 — Manifest `softDelete` contract list is missing a live key

`mms-module-architecture.mdc:51` enumerates `workExcludesDeleted`, `reportsIncludeDeleted`,
`captureDeletionReason`, `retentionDays`. Manifests also define `exportsIncludeDeleted`
(e.g. `packages/shared/src/attendance/attendanceModuleManifest.ts:127`), which
`mms-reports.mdc:39` relies on. The "manifest contract" is therefore under-specified relative to
the schema.

**Fix:** add `exportsIncludeDeleted` to §6 (and to the parity bullet where exports are gated).

### M9 — Tenant-key guidance is split between `tenant_id` and `workspace_subdomain`

`mms-data-layer.mdc:13` mandates "`tenantId: uuid("tenant_id")` **or** `workspaceSubdomain`";
`mms-performance.mdc:14` says compound indexes "must prefix `tenant_id`"; `mms-data-layer.mdc:55`
tiers prefixes `workspaceSubdomain`, and every finance table
(`apps/backend/src/db/schema/finance.ts:19-40`) uses `workspace_subdomain`. An agent adding an
index from the performance rule would key on a column that usually does not exist.

**Fix:** "prefix the tenant column this table uses (`workspace_subdomain`, or `tenant_id` on the
legacy composite-key tables)". Same wording in performance §1.

### M10 — Mirror-identity claim contradicts the sanctioned rewrite

`AGENTS.md` ("Rule bodies are byte-identical across the three rule trees; only frontmatter
differs") and `README.md:215` are disproved by the sync script itself: it rewrites every
rule-name `.mdc` → `.md` (`.agent/scripts/sync-rules.sh:51`), so 18/22 bodies differ. `AGENTS.md` states the
rewrite two paragraphs later; the README does so in the next sentence.

**Fix:** "bodies are identical **modulo the rule-reference extension rewrite**".

### M11 — "Never restate an owned norm" is violated inside the rules

`mms-agent-universal.mdc:43` bans restatement, yet: `mms-ui-ux-design.mdc:59-68` (§8's
"Mandatory Checks When Reviewing UI/UX") re-states §2/§3 tokens, BiDi, touch targets, focus and
motion; `mms-module-architecture.mdc:55-63` (§7) re-states §2–§6; `mms-completion-review.mdc:18`
re-states the `mms-shared-ui.mdc` §4 gate list; `mms-core.mdc:15` re-states shared-UI governance
plus the ratchets. Duplicated prose is what produced H4 (the copy drifted from the source).

**Fix:** convert §8 to a pointer list ("tokens → §2, BiDi → §3, touch → §2, focus → §3"), and keep
§7 as a short checklist that names sections instead of re-describing them.

### M12 — Mandatory rules are `model_decision`, not always-on

`mms-completion-review.mdc` (the "mandatory self-review") and `mms-agent-universal.mdc` (the
"universal standards", including the git boundaries) have **no** `globs` and
`alwaysApply: false`, so they load only when the agent elects to, or when `mms-core` points at
them. Only `mms-core` is always-on. In practice a short task can complete with the git-boundary and
review norms never loaded.

**Fix:** if the mandate is real, either promote the two thin "must always run" sections into
`mms-core` (which is 26 lines and has room for pointers) or set `alwaysApply: true` on
`mms-completion-review` and trim it to the gate list.

### L1 — Raw-control ban vs mandatory real `<table>`

`mms-ui-ux-design.mdc:14` bans raw `<table>`/`<dialog>` "where design system primitives exist";
`:43` requires real `<table>` semantics with `scope`/`caption`/`aria-sort`. Sanctioned primitive
`Table` is the intended bridge; say so.

### L2 — Enforcement registry is missing the new norms

`README.md:143-150` lists the checks (with two explicitly advisory norms), but the TDD and Adversarial
Audit norms added in this change appear in **no** registry row, and the coverage row is stale
(see H2). The registry is the file the corpus says must be updated "in the same change that adds
or removes a check".

### L3 — Wording

* `mms-core.mdc:17` "clientside" → "client-side".
* `mms-agent-universal.mdc:28` lists `Object.groupBy()` under "Native immutability" (it is a
  collection helper, not an immutable method).
* `mms-shared-ui.mdc:13` cites "§1.3", but `mms-completion-review.mdc` §1 has unnumbered bullets;
  cite the bullet name instead.
* `mms-ui-ux-design.mdc:24` says "no standalone `oklch()`", yet `index.css:102-104` defines
  `--color-oklch-*` fallbacks with `oklch()`. Say "no `oklch()` outside the `index.css` theme map".

### L4 — `mms-performance` scope is narrow relative to its norms

4 globs / 38 files, but §1–§6 govern every query, render path and bundle decision. Only files
under `data-table/`, `redis.ts`, `worker/**`, `queryClient.ts` attach it. Not a defect on its
own, but it is the same failure mode as H1: norms that must fire on ordinary source files are
attached to a handful of special paths.

---

## 3. Per-rule scorecard

"Attach" = frontmatter globs → matching files. "Spot-checked" names what was actually verified
against the tree, not a score.

| Rule | Attach | Spot-checked against the tree | Verdict |
| --- | --- | --- | --- |
| `mms-core` | always-on | ratchet scripts, shared-UI refs, TDD/audit pointers | H1, M11, L3 — pointers right, restatements drift |
| `mms-agent-universal` | none (agent-requested) | `toSorted`/`Object.groupBy`/`using` guidance, no-`any` ratchet exists | M12, M11, L3 |
| `mms-completion-review` | none (agent-requested) | every cited command, script and test path resolves | M12; new §4 has no registry row |
| `mms-testing-observability` | 10 globs (test files + configs) → 1,606 | coverage numbers ✗, `pnpm test:db` ✗, OTel ✗, `clearMocks`/`restoreMocks` ✓ | **H1, H2, H5, M4, M7** — weakest rule in the corpus |
| `mms-data-layer` | db/worker/query paths → 775 | `uuidv7` ✗, restore 400 ✓, index tiers ✓, `SELECT *` ban ✓ | H3, M5, M9 |
| `mms-api-interface` | routes/services/contracts → 572 | 422 vs 400 ✗, envelope ✓, bulk-upsert ✓ | H6 (via dry), M5, M6 |
| `mms-auth-security` | 14 paths → 75 | cookie names ✓, denial codes ✓, `AsyncLocalStorage` ✗ | M4, M6 |
| `mms-module-architecture` | features/manifests → 2,216 | `ModuleEntityIoToolbar`, `useWorkSelection`, `useWorkDirectoryViewMode` ✓; softDelete keys partial | M8, M11 |
| `mms-form-architecture` | form paths → 232 | `FormCollectionShell`, `FORM_INPUT`, `mapZodFormErrors` ✓ | clean |
| `mms-ui-ux-design` | 8 paths → 2,272 | `text-4xs`, `z-modal` ✓; BiDi clause ✗ | **H4**, M11, L1, L3 |
| `mms-shared-ui` | packages/ui + consoles → 372 | all 5 enforcers real (`check:shared-ui`, `platformUiArchitecture.test.ts`) | L3 |
| `mms-hooks` | hook paths → 809 | `useDirectoryTrashState`, `useStandardModuleConfig` ✓ | clean |
| `mms-fields` | fields/registry → 220 | `getFieldRemovalIssues`, `CONTACT_LOCKED_ENABLED_TABS` ✓ | clean |
| `mms-settings-i18n` | settings/i18n → 441 | en/ar/ur/fa dictionaries exist, `SYSTEM_MODULE_NAV` ✓ | clean |
| `mms-structure-naming` | packages/scripts → 1,277 | subpath policy ✓ (correct side of H6), 300-line ratchet ✓ | correct except H6 counterpart |
| `mms-dry` | shared/ui/lib → 1,240 | subpath ban ✗ (H6), chrome primitive names ✓ | **H6** |
| `mms-dependencies` | 12 globs → 18 | 10/10 versions ✗, `allowBuilds` ✗, `erasableSyntaxOnly` ✗, React Compiler guidance ✓ | **M1, M2, M3, M4** |
| `mms-ops-infrastructure` | 51 | ports 5002/3000 ✓, `.githooks` ✓, CI DAG ✓, `AsyncContextFrame` ✗ | M4; otherwise the most accurate rule |
| `mms-messaging` | 10 paths → 107 | `MessageComposer`, `openDeviceSmsComposer`, `PuppeteerWhatsAppProvider` ✓ | clean |
| `mms-migration-status` | docs/migrations → 73 | finance `numeric(12,2)` debt item ✓ | fine; verbosity note only |
| `mms-reports` | 178 | `ExportToolbar`, `buildExportGrid`, `exportsIncludeDeleted` ✓ | M8 (depends on the missing contract key) |
| `mms-performance` | 4 globs → 38 | `multiTierCache`, `PG_POOL_MAX` ✓; `tenant_id` prefix ✗ | M9, L4 |

---

## 4. Recommended sequence

1. **Fix the four "agent writes wrong code" defects first** — H3 (`uuidv7`), H4 (BiDi list),
   H5 (`test:db`), H6 (subpath ban). Each is a one-line edit with unambiguous correct text.
2. **Decide the TDD/coverage stance** (H1, H2, L2). Either land the `--changed` test-pairing
   ratchet + move the norm to a source-scoped rule, or label both advisory and add the two
   registry rows. Do not leave them mandatory-and-unenforced.
3. **Stop restating versions** (M1) and name real config keys (M2, M3) — this is what decays.
4. **Two cheap verifier additions** (would have caught H5 and M1):
   * every `pnpm <script>` token in a rule must exist in the nearest `package.json` scripts;
   * every dependency name+range in `mms-dependencies` must match `pnpm-workspace.yaml` (or the
     prose must carry no ranges).
5. **Consolidate restatements** (M11) — §8 and §7 become pointers; this is the structural fix
   behind H4.
6. Re-run `bash .agent/scripts/sync-all.sh && node scripts/verify-rules-integrity.mjs` plus
   `pnpm run check:docs` after editing the corpus.

---

## 5. Resolution log (fix pass, same day)

All 22 findings were fixed in the follow-up change. The corpus now has **23 rules** (2 always-on +
21 scoped): `mms-completion-review` became always-on and the TDD protocol moved into the new
`mms-tdd` rule.

| Finding | Resolution | Where |
| --- | --- | --- |
| H1 | TDD extracted to `mms-tdd` with source-scoped globs; Red evidence = PR body; labelled **advisory** and given a real signal (`check:tdd-pairing`, wired into the pre-PR gate) | `mms-tdd.mdc`, `scripts/check-tdd-pairing.mjs`, `pre-pr-review.sh`, registry |
| H2 | Coverage table replaced by per-workspace SSOT pointers + measured floors; registry row corrected | `mms-testing-observability.mdc` §5, rules README |
| H3 | `crypto.randomUUIDv7()` → `uuidv7()` from `@mms/shared` | `mms-data-layer.mdc` §1.3 |
| H4 | Inverted BiDi list deleted; §8 now points at §3 | `mms-ui-ux-design.mdc` §8 |
| H5 | Root `pnpm test:db` → `pnpm ci:local --with-db` / `--filter mms-backend run test:db` | `mms-testing-observability.mdc` §12 |
| H6 | Ban scoped to undeclared subpaths; exports map cited | `mms-dry.mdc` §3 |
| M1 | Patch/minor versions removed from prose; catalog is the SSOT; verifier now rejects unknown versions | `mms-dependencies.mdc` §1, `verify-rules-integrity.mjs` |
| M2 | `pnpm.onlyBuiltDependencies` → `allowBuilds` | `mms-dependencies.mdc` §4 |
| M3 | Flag not enabled (9 legacy parameter-property sites) → bans labelled review-advisory | `mms-dependencies.mdc` §5 |
| M4 | `AsyncContextFrame` → `AsyncLocalStorage`; OTel sentence now advisory with no fake version | testing §7, deps §3, ops §2, auth §5, code-review workflow |
| M5 | 400/422 carve-out stated where the taxonomy lives | `mms-api-interface.mdc` §4, `mms-data-layer.mdc` §6.10 |
| M6 | `session_revoked` + four `MODULE_*` codes added | `mms-api-interface.mdc` §4 |
| M7 | DB-bucket command + review-gated wording added | testing §12 |
| M8 | `exportsIncludeDeleted` added to the manifest contract | `mms-module-architecture.mdc` §6 |
| M9 | Tenant-key guidance unified (`workspace_subdomain` or `tenant_id`, never both) | data-layer §1, performance §1 |
| M10 | Mirror claim now says "modulo the `.mdc` → `.md` rewrite" | `AGENTS.md`, rules README |
| M11 | §8 (ui-ux), §7 (module-arch), §1.3 (completion-review), core shared-UI bullet converted to pointers | 4 rules |
| M12 | `mms-completion-review` promoted to always-on; manifest, AGENTS table and README counts updated | frontmatter + manifest + AGENTS |
| L1 | `Table` primitive named as the sanctioned real-`<table>` bridge | `mms-ui-ux-design.mdc` §1 |
| L2 | Registry gained TDD/advisory-audit rows + two verifier rows; coverage row corrected | rules README |
| L3 | `client-side`, `Object.groupBy` wording, §1 citation, `oklch()` scope fixed | core, agent-universal, shared-ui, ui-ux |
| L4 | Scope note added (on-demand by design, pointers from §5/§2) | `mms-performance.mdc` header |

New enforcement landed with the fixes:

```bash
node scripts/verify-rules-integrity.mjs   # +2 checks: cited pnpm scripts, cited version ranges
pnpm run check:tdd-pairing                # advisory: changed domain file ↔ changed spec
```

---

## 6. Follow-up sweep (same day)

A second pass found claims the first fix missed — prose in the skills/guides that still described
the old corpus shape — plus two hardening gaps. Fixed in the same change:

| # | Residual claim | Fix |
| --- | --- | --- |
| S1 | `mms-agent-standards` said only `mms-core` is always-on and `mms-completion-review` is requestable | 2 always-on (`mms-core` + `mms-completion-review`), `mms-agent-universal` requestable |
| S2 | `antigravity-workspace` said "Always-on rules (1)", listed completion-review as requestable, and counted "Scoped (20 rules, 21 total)" | "Always-on rules (2)", requestable = universal only, "Scoped (21 rules, 23 total)" |
| S3 | `CLAUDE.md` always-on row listed only `mms-core.md` | both `.claude/rules/mms-core.md` and `.claude/rules/mms-completion-review.md` |
| S4 | `mms-agent-standards` said "all 39 descriptions" | 49 (disk) |
| S5 | `mms-agent-standards` still claimed bodies are "byte-identical" | "identical modulo the `.mdc` → `.md` rewrite" |
| S6 | `mms-agent-standards` verifier-coverage list/preamble omitted the new gates | lists cited-script, version-range and inventory-claim checks; advisory-reporter exception documented |
| S7 | `.claude/agents/mms-reviewer.md` listed `mms-agent-universal` as always-on and omitted that `mms-completion-review` is | always-on = `mms-core` + `mms-completion-review`; requestable = `mms-agent-universal` |
| S8 | `dry`, `code-review`, `shared-ui-audit` workflows labelled scoped rules as "Load always-on rules" | "Load the owning rules" / "Load the core rules"; mirrors re-synced |
| S9 | No gate prevented this drift class | `verify-rules-integrity` now fails when `Always-on rules (N)`, `rules: X always-on + Y scoped`, `Scoped (N rules, M total)`, `**N rules** (X always-on + Y scoped)` or `all N descriptions` disagree with frontmatter/disk (proven with a fixture) |
| S10 | `check-tdd-pairing` silently used `HEAD` when `main` was absent, reporting "no domain files" | base resolution mirrors `local-ci.sh` (explicit → `MMS_CI_BASE` → `origin/main` → `main` → `master` → `HEAD~1`); warns on an unknown explicit base and prints "skipped" when no base resolves |
| S11 | Cursor skill mirrors rewrote any `mms-*.md` token, turning `.claude/agents/mms-docs-auditor.md` and `.agent/rules/mms-migration-status.md` into non-existent `.mdc` paths | `sync-skills.sh` now rewrites only rule references (`rules/<rule>.md`, bare `<rule>.md`), never path-qualified files; mirrors re-synced, 0 broken `.mdc` paths |
| S12 | Claude Code loads every rule without `paths:` — 3 rules, not the 2 always-on in Cursor — and this divergence was undocumented and unchecked | `CLAUDE.md` lists all 3 with the reason; both standards skills note it; verifier check #15 fails unless the Claude no-paths set equals Cursor always-on ∪ unscoped |

Verification for this sweep: inventory-claim fixtures fire and are removed; the TDD probe warns
for an unpaired use-case, clears once a matching spec exists, warns on an unknown `--base`, and
prints "skipped" in a detached single-commit repo; rule bodies match across all three trees
(23/23), Claude skills mirror `.agent` byte-for-byte and Cursor skills differ only by the rule-ref
rewrite, `.claude/docs/workflows` matches, and there are 0 broken `.mdc` paths in the Cursor
mirrors; `verify-rules-integrity`, `check-docs`, Prettier, and **`pnpm ci:local:full`**
(gates, i18n, build, bundle, frontend/backend/shared suites) are green.

---

## 7. Skills review (49) & rule sync

The structural gate (`verify-rules-integrity`) was already green, so this pass re-read every
`SKILL.md` + `references/` against the current 23-rule corpus. Eight drift classes were found and
fixed at the canonical `.agent/skills` source (mirrors regenerated):

| # | Finding | Fix |
| --- | --- | --- |
| S1 | `mms-testing-e2e` §2 and `mms-code-review` checklist still claimed category coverage gates (utils ≥95%, hooks ≥90%, UI/routes ≥85%) — the floors H2 removed from the rule | replaced with the per-workspace `vitest.config.ts` SSOT + "never lower a configured floor" |
| S2 | TDD rule missing where tests are authored/reviewed: `mms-testing-e2e`, `mms-code-review`, `mms-backend-api`, `mms-frontend`, `mms-query-factories`, `mms-seed-fixtures`, `mms-error-triage` | pointers to `mms-tdd.md`; regression evidence now cites `mms-tdd.md` §2 |
| S3 | Canonical skills used Cursor's extension: `mms-student-lifecycle`, `mms-migration-fixes`, `mms-module-work/references/work-directory-ratchets.md` | rewritten to `.md`; the verifier now rejects canonical `mms-*.mdc` references |
| S4 | 9 skills had no verification section at all (`mms-ci-ratchets`, `mms-db-performance`, `mms-error-triage`, `mms-finance-accounting`, `mms-migration-fixes`, `mms-release-versioning`, `mms-seed-fixtures`, `mms-testing-e2e`, `mms-vuln-response`) | added a `## Verification` section with each skill's real commands/gates |
| S5 | `mms-agent-standards` required a literal `## Verification` heading while 38 skills use variants | template now accepts `Verification`, `Verification Checklist`, `Checklist`, `Done`, `…Validat…`; the verifier enforces that variant set |
| S6 | The M11 compression of `mms-module-architecture` §7 had dropped invariants skills still cite: `loadFailedHint`, `EmptyState` required title, `Cmd/Ctrl+N`, `DirectoryCard` + `useWorkCardAction`, explicit `WorkBatchTable` | restored as a "Work UX invariants" bullet in §3 (the owner section); `fix-before-done.md` repointed from §7 to §3 |
| S7 | `antigravity-workspace` pointed at `skills/README.md`, which would dangle in `.dsh/skills` (root README is excluded there) | points at `.agent/skills/README.md` and lists the four mirrors |
| S8 | Edited skills carried stale `last-verified` metadata | bumped to `2026-10-29` on every touched skill |

Verification: `node scripts/verify-rules-integrity.mjs` now fails a skill with no verification
section or a canonical `.mdc` rule reference, and passes 49/49 skills.

## 8. DeepSeek Harness mirror (`.dsh`)

DSH's own load model (from `@deepseek-ai/dsh-agent-instructions` and
`@deepseek-ai/dsh-skill-filesystem`, both mounted by `dsh-base`):

- Instructions: the repo-root `AGENTS.md` / `CLAUDE.md` chain (plus nested copies). There is **no**
  glob-scoped rule loader.
- Skills: filesystem roots in rank order — `<projectRoot>/.dsh/skills` (100),
  `<projectRoot>/.agents/skills` (200), custom dirs (300), `~/.dsh/skills` (400),
  `~/.agents/skills` (500). A skill is `<name>/SKILL.md` (nested `**/SKILL.md` is not discovered);
  a flat `<name>.md` at the root would be parsed as a skill.
- Frontmatter: required `name` (kebab-case grammar) + `description`; optional `whenToUse`,
  `metadata`, `disable-model-invocation`, `user-invocable`. Unknown keys are ignored.

Mirror layout (generated by `.agent/scripts/sync-dsh.sh`, committed and drift-checked):

```
.dsh/AGENTS.md   generated index: load model, 23-rule table, 49-skill table, workflows, verify
.dsh/rules/      byte-identical to .agent/rules (23 rule files + README)
.dsh/skills/     49 skill bundles, byte-identical to .agent/skills (root README excluded)
```

Wiring: `sync-all.sh` runs `sync-dsh.sh`; `.prettierignore` excludes `.dsh/`; CI's drift step now
covers `.dsh`; the verifier fails on rule/skill byte drift, flat files at the skills root, invalid
kebab names, a missing/!generated `AGENTS.md`, and stale inventory counts in the generated index.

Live validation: the running DSH session's skill catalog picked up all 49 project skills from
`.dsh/skills` immediately after generation (watcher-driven refresh), confirming the provider,
frontmatter parsing, and directory layout.

---

## Appendix — evidence commands


```bash
node scripts/verify-rules-integrity.mjs
bash .agent/scripts/sync-all.sh --dry-run
# glob liveness: expand each frontmatter `globs:` entry against `git ls-files`
# body parity: strip frontmatter, diff .cursor/.agent/.claude per rule
grep -rn "randomUUIDv7" --include=*.ts apps packages        # 0 hits
grep -rn "thresholds" -A6 apps/*/vitest.config.ts packages/shared/vitest.config.ts
grep -n "catalog:" -A12 pnpm-workspace.yaml
grep -rn "AsyncLocalStorage\|AsyncContextFrame" --include=*.ts apps/backend/src/lib | head
grep -rn "opentelemetry" package.json apps/*/package.json   # 0 hits
node -e 'console.log("test:db" in require("./package.json").scripts)'   # false
```
