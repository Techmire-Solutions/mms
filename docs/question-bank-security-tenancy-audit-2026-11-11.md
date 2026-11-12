# Question Bank Security, Multi-Tenancy & Compliance Audit (2026-11-11)

**Scope.** Tenant isolation, granular RBAC and audit-trail coverage for the Question Bank module:
question/option/tag lookups, blueprint assembly, approval/retire actions, answer-key visibility and
every write path that can change a question.

**Method.** Read the module gate and permission resolution, the route-level `can*` guards, the
default/custom role maps, every Question Bank repository query, the audit service and the
`audit_trail_events` schema; then exercised the routes with role-scoped tokens and the repositories
with cross-tenant fixtures.

## 1. Tenant isolation — verified sound, now pinned

| # | Result | Evidence |
|---|---|---|
| T1 | **PASS** | ENABLE + FORCE RLS on `questions`, `question_options`, `question_tags`, `question_categories`, `question_citations` (0076), `question_attachments` and `test_blueprint_buckets` (0242). Every repository read/write runs through `withTenant`/`withTenantRead` and carries an explicit `workspace_subdomain` predicate (list, picker, write plan, assembly, similarity, attachments, report, widgets, hydration). Composite `(workspace_subdomain, id)` FKs make a cross-tenant child row structurally impossible. |
| T2 | Fixed | The FORCE-RLS coverage test only listed examinations tables; all seven Question Bank tables are now in the assertion. |
| T3 | Fixed | New `questionBankTenantIsolation.db.integration.test.ts` proves cross-tenant SELECT/UPDATE/DELETE/INSERT are blocked under a NOSUPERUSER NOBYPASSRLS role and that `findQuestionById` cannot cross the boundary. |
| T4 | PASS | `app.rls_bypass` is set only by bootstrap/global transactions; `tenantTransactionGuards` rejects a leaked bypass on a tenant scope. No Question Bank route sets it. |
| T5 | PASS | Platform-console ERD reads question tables at platform scope by design, outside tenant routes. |

Cross-tenant repository probes (run as superuser, so they prove the **explicit predicate** rather than
RLS) cover `findQuestionById`, `listQuestionsPage`, `listQuestionsPicker`,
`aggregateQuestionBankReport`, `findSimilarQuestions` and `assemblePaperForTest` — none can see or link
another tenant's question.

### Latent defect found while probing

`aggregateQuestionBankReport`'s pass-rate query filtered on `t.total_marks`, an alias that does not
exist (the joined table is `tests`). Every call raised `42P01` and the endpoint returned 500 whenever
the tenant had papers/results. Fixed to reference the drizzle column; now covered by the cross-tenant
probe test.

## 2. Granular RBAC

| # | Sev | Result | Evidence |
|---|---|---|---|
| R1 | **P1** | **Permission bypass (fixed).** `QUESTION_BANK_MODULE_MANIFEST.permissions` mapped to `students.read`/`students.write`, and `roleHasPermission` resolves a legacy permission to its *own* module. Consequences: `assistant_teacher` (`students:["read"]`) and `registrar` (`students:["create","read","update"]`) passed the Question Bank gate with **no** `questionBank` grant; a custom role granted only `questionBank:["read"]` was denied. The manifest now points at the module's own `questionBank.read` / `questionBank.write` / `questionBank.delete` keys (which already existed in `ALL_PERMISSIONS` and `PERMISSION_RULES`). |
| R2 | P1 | **Approval authority (fixed).** Approve/retire is now gated on `userHasPermission(user, "questionBank.delete")`; authoring/submitting stays on `questionBank.write`. A teacher can draft, edit and submit, not approve. Trash/restore remains author-level by design. |
| R3 | P1 | **Master answer key (fixed).** CSV export is the full answer key and now requires `questionBank.delete` (approver), not read/write. Answer-key visibility inside the list/detail remains `questionBank.write` so authors can edit what they author. |
| R4 | **P1 open** | **Instructor → subject scoping is not modelled.** `questions` has no `subject_id` and there is no assignment table, so "an instructor may only author/view their assigned subjects" cannot be enforced. See D1. |
| R5 | PASS | Students/guardians have zero access: the guardian role carries no workspace permissions, so the module gate denies it (route test). `assistant_teacher`/`registrar` now join them. |
| R6 | PASS | Defense in depth: the `registerModuleAccess` pre-handler gate runs first and every contract handler re-checks `canRead/Write/DeleteCollection`. |

Role matrix now pinned by route tests:

| Role | Read | Write | Approve / retire | Export master key |
|---|---|---|---|---|
| principal / admin | ✅ | ✅ | ✅ | ✅ |
| teacher | ✅ | ✅ | ❌ | ❌ |
| auditor | ✅ | ❌ | ❌ | ❌ |
| assistant_teacher / registrar | ❌ | ❌ | ❌ | ❌ |
| guardian / student | ❌ | ❌ | ❌ | ❌ |

## 3. Tamper-evident audit trail

The audit table is hash-chained and append-only (`0235` trigger rejects UPDATE/DELETE — pinned by a
test), tenant-scoped with FORCE RLS, and `recordModernAuditEvent` fills the actor from the
authenticated request and IP/endpoint/method/correlation from the request audit context.

| # | Sev | Result |
|---|---|---|
| A1 | **P1** | **Question create and content edits — including answer-key changes — wrote no audit row.** Fixed: the write plan returns per-row before/after state and `bulkSaveQuestions` writes `CREATE`/`UPDATE` rows inside the same transaction, with `minimizeDelta` so the stored payload is the changed fields (including `answer`). |
| A2 | P1 | **Bulk delete/restore were unlogged.** Fixed: one `DELETE`/`RESTORE` row per affected question, inside the transaction, with `deletedBy`/`deletionReason`/`restoredBy`. |
| A3 | P2 | **Audits ran after the write transaction** (status, duplicate, publish, assembly, attachments), so a crash or audit failure left an unlogged mutation. Fixed: those rows are now written in the repository transaction — a failed audit aborts the mutation (fail-closed). |
| A4 | P2 | Status approval recorded `newState` only. Fixed: `oldState {status}` / `newState {status, reason}` diffs. |
| A5 | PASS | IP/endpoint/method/correlation are captured automatically; verified by a test that binds `bindRequestAuditContext` and asserts the stored row. |
| A6 | PASS | `answer` is not in the audit redaction list (credentials only), so key changes are captured — deliberately, since that is the event being audited. Audit rows are tenant-scoped and access-controlled by the audit surface. |

Covered events: question create, answer-key/content edit, status submit/approve/retire, duplicate,
paper publish, blueprint assembly, media attach/detach, bulk soft-delete, bulk restore.

## Deferred

### D1 — Instructor → subject scope (target design)

```sql
ALTER TABLE questions ADD COLUMN subject_id text;
ALTER TABLE questions ADD CONSTRAINT questions_subject_fk
  FOREIGN KEY (workspace_subdomain, subject_id)
  REFERENCES subjects (workspace_subdomain, id) ON DELETE RESTRICT;

CREATE TABLE instructor_subject_assignments (
  workspace_subdomain text NOT NULL REFERENCES workspaces(subdomain) ON DELETE CASCADE,
  user_id             text NOT NULL,
  subject_id          text NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_subdomain, user_id, subject_id),
  FOREIGN KEY (workspace_subdomain, subject_id)
    REFERENCES subjects (workspace_subdomain, id) ON DELETE CASCADE
);
```

Enforcement: `listQuestions`/`picker`/assembly candidates add
`EXISTS (assignments WHERE user_id = actor)` unless the caller holds `questionBank.delete`; the write
plan rejects a `subjectId` outside the actor's assignments; the forms gain a subject picker and the
Users surface gains assignment management. Needs a migration + backfill + admin UI — out of scope for
this round, documented as open.

### D2 — dedicated approval permission
`questionBank.delete` is reused as approver authority. A distinct `questionBank.approve` key would
read better and keep trash semantics independent.

### D3 — compliance viewer
The answer-key diffs now exist in `audit_trail_events`; a permissioned read surface (and export) over
them is a follow-up.

## Verification

```bash
pnpm typecheck
pnpm --filter mms-backend test
pnpm --filter mms-backend exec vitest run --config vitest.db.config.ts \
  src/__tests__/db-integration/questionBankPersistenceDb.integration.test.ts
pnpm --filter mms-backend test:rls        # provisioned NOSUPERUSER role required
pnpm --filter mms-frontend test
bash scripts/ci/local-ci.sh
```

New coverage: role matrix (read/write/approve/export), answer-key redaction still enforced, audit
rows for create/answer-edit/delete/restore/status with actor + IP + diff, append-only rejection,
cross-tenant repository probes, cross-tenant RLS suite.
