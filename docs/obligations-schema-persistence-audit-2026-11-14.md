# Database Schema & Persistence Layer Review: Obligations Module

Schema, Drizzle ORM model, constraint, index, soft-delete and concurrency review of the **Obligations** module (`apps/backend/src/db/schema/obligations.ts`, its migration chain, and the persistence/use-case layer that writes it and posts it to the general ledger).

**Status: fixed.** Every finding below was raised against this repository and then closed in the same change set — migration [0258_obligations_schema_integrity.sql](../apps/backend/src/db/migrations_drizzle/0258_obligations_schema_integrity.sql), the out-of-band index file [0258_obligations_indexes_concurrent.sql](../apps/backend/scripts/sql/0258_obligations_indexes_concurrent.sql), and the Drizzle/persistence/contract changes listed in [§4.7](#47-drizzle-and-code-mirrors). The remaining defers are D1–D5 in [§6](#6-deferred-items-with-target-designs); D6 (the shared allocation rule) was closed later by [obligations-domain-lifecycle-audit-2026-11-14.md](./obligations-domain-lifecycle-audit-2026-11-14.md).

The environment that produced this change had **no PostgreSQL**, so the migration initially shipped unapplied. A later session (see the security and async audits) did have a live database: `0258` and `0259` applied cleanly, `financeEnumParityDb` passed, and the persistence suite revealed — and then fixed — two missing foreign-key parents in its own fixtures. [§7](#7-verification) records both the original gap and the later verification.

---

## 0. Scope correction — the briefed entity model does not exist

The review request described an *installment / allocation / balance* model: `obligation_installments`, `obligation_allocations`, `status`, `due_date`, `assessment_date`, fulfilled / paid / waived amounts, a `remaining_balance`, links to students, sessions and invoices, OCC `version` columns on balance updates, and a `dateColumnsDb` helper. **None of that exists in this repository.** Verified against the Drizzle schema, the full migration chain (`0000`–`0257`), `meta/_journal.json`, the latest snapshot (`0257_…_snapshot.json`) and a repository-wide grep:

| Briefed | Actual |
| --- | --- |
| `obligation_installments`, `obligation_allocations` | No such table, column, type, route or snapshot entry. The only `*_allocations` table is `finance_payment_allocations` ([financeBilling.ts:127](../apps/backend/src/db/schema/financeBilling.ts#L127)), which belongs to Finance. |
| `status`, `due_date`, `assessment_date` | `obligation_collections` has exactly 20 columns; the only date column is `received_date`. There is no status column anywhere in the module. |
| fulfilled / paid / waived / remaining balance | No such columns. `amount` is the only money column. The tenant's "dues" figure is computed **in the browser** ([obligationsSummaryCalculations.ts:110-114](../apps/frontend/src/tenant/features/obligations/lib/obligationsSummaryCalculations.ts#L110-L114)) and never persisted. |
| `contact_id` / `student_id` / `session_id` / `invoice_id` | Only `sender_id` → `contacts.id`, written by a `ContactPicker` ([ObligationCollectionFormFields.tsx:156](../apps/frontend/src/tenant/features/obligations/components/ObligationCollectionFormFields.tsx#L156)). There is no student, session or invoice link at all. |
| OCC `version` columns | **No `version` column on any obligations table.** Sessions, attendance, examinations, the question bank and hasanat all carry one; obligations do not. |
| `dateColumnsDb` date rule | **No such helper exists in the repo.** The codebase equivalent is [`apps/backend/src/lib/dbDate.ts`](../apps/backend/src/lib/dbDate.ts) (`toDbDate` / `requireDbDate` / `requireDbDateValue`) plus `date(…, { mode: "string" })` columns. |

### What the module actually is

A **receipt/collection** model for religious dues. A receipt (`obligation_collections`) is received from a contact, classified by an obligation type, attributed to a mujtahid's representative, and split across the wakala's distribution rules into Income/Liability accounts, which are posted to the general ledger.

```
workspaces (subdomain)
   │
   ├─1:N─ obligation_types ──────────────┐
   ├─1:N─ mujtahids                     │
   │        └─1:N─ mujtahid_reps ───┐    │
   │                                │    │
   └─1:N─ wakala_types ─────────────┼────┘
            │  (rep × obligation_type)
            └─1:N─ obligation_distributions ──> accounting_accounts (account_id, NO FK)
                     (percentage, Income|Liability)

obligation_collections
   sender_id ──> contacts.id                (NO FK — F6)
   obligation_type_id ──> obligation_types  (FK in DB, absent from Drizzle — F7)
   mujtahid_representative_id ──> mujtahid_reps (FK in DB, absent from Drizzle — F7)
   amount numeric(12,2)                     (JS number end-to-end — F1)
   received_date date                       (correct — F4)
        │
        └── accounting_entries (source_type='obligation', source_id = oc-<sha256(id|epoch)>)
                └── accounting_journal_lines
```

Constraints inherited from `0000`/`0052`: composite primary key `(workspace_subdomain, id)` and a `workspace_subdomain → workspaces(subdomain)` foreign key on every table, `ENABLE`/`FORCE ROW LEVEL SECURITY` with a tenant policy (`0052:185–213`, `0076:563–622`, `0108:520–544`), and a `BEFORE DELETE` hard-delete trigger on `obligation_collections` (`0104:190`, `0108:201`).

---

## Critical findings matrix

| # | Dimension | Severity | Issue | Impact | Primary file |
| --- | --- | --- | --- | --- | --- |
| F1 | Precision | HIGH | Money is `numeric(12,2)` ⇄ JS `number` ⇄ `z.number()`, with no 2-dp or safe-cents refine | A subtotal carrying more than 2 dp is silently rounded by Postgres while the API echoes the unrounded value | [obligations.ts:137](../apps/backend/src/db/schema/obligations.ts#L137), [obligationCollectionsRepository.ts:50](../apps/backend/src/db/repositories/obligationCollectionsRepository.ts#L50) |
| F2 | Precision | HIGH | Report/metric aggregates are cast to `float8` | Tenant totals carry binary-float drift (`…)0000002`); `0.01` is not representable | [obligationRepositoryReport.ts:42](../apps/backend/src/db/repositories/obligationRepositoryReport.ts#L42), [obligationRepositoryMetrics.ts:39](../apps/backend/src/db/repositories/obligationRepositoryMetrics.ts#L39) |
| F3 | Date integrity | HIGH | All obligation timestamps are `timestamp` (naive) in the DB but `timestamptz` in Drizzle and every snapshot; `0108`'s `ADD COLUMN IF NOT EXISTS … TIMESTAMPTZ` was a no-op | Values shift whenever the session timezone is not UTC; identical to the defect `0229` fixed for hasanat | [obligations.ts:144-145](../apps/backend/src/db/schema/obligations.ts#L144-L145) |
| F4 | Date integrity | OK | `received_date` is a real `date` column (`mode: "string"`) written through `requireDbDateValue` | Correct — recorded so it is not "fixed" later | [obligations.ts:134](../apps/backend/src/db/schema/obligations.ts#L134) |
| F5 | Date integrity | MEDIUM | Posting is date-safe, but every reversal posts at "today" | An edit or archive moves the correcting entry into a different period than the original | [ledgerReversalPostingService.ts:122](../apps/backend/src/accounting/ledgerPosting/ledgerReversalPostingService.ts#L122) |
| F6 | Referential integrity | HIGH | `sender_id` is a contact id with **no FK to `contacts`** | A purged contact leaves receipts pointing at nothing; contact statements scan the tenant | [obligations.ts:135](../apps/backend/src/db/schema/obligations.ts#L135) |
| F7 | Referential integrity | HIGH | Five composite FKs exist in the DB (`0068`) but are **absent from the Drizzle model and the snapshot** | ORM and database disagree; `drizzle-kit push` would drop them | [obligations.ts](../apps/backend/src/db/schema/obligations.ts) |
| F8 | Referential integrity | MEDIUM | `obligation_distributions.account_id` has no FK to `accounting_accounts` | A stale id is caught only at posting time, where it makes the whole receipt post **nothing** | [obligations.ts:109](../apps/backend/src/db/schema/obligations.ts#L109) |
| F9 | Indexing | MEDIUM | Receipt numbers are generated in the browser and are **not unique**; two indexes are redundant/undeclared | Duplicate receipt numbers; wasted write amplification; drift between DB and Drizzle | [obligationsReceiptNumberingUtils.ts:20](../packages/shared/src/obligations/obligationsReceiptNumberingUtils.ts#L20) |
| F10 | Constraints | MEDIUM | `percentage numeric(5,2)` accepts 999.99 while the DTO caps at 100; no name uniqueness in a wakala; no sum-to-100 guard | DB accepts rows the API rejects; distribution lists can double-count | [obligations.ts:106](../apps/backend/src/db/schema/obligations.ts#L106) |
| F11 | Constraints | MEDIUM | No enum CHECKs on `payment_mode`, `distribution.type`, `designated_for` | Free-form values reach the posting engine and the metrics counters silently | [obligations.ts:108,139,27](../apps/backend/src/db/schema/obligations.ts#L108) |
| F12 | Constraints | LOW | `mujtahids` / `mujtahid_reps` / `obligation_types` allow duplicate names | Duplicate catalogue entries; needs a product decision, not DDL | [obligations.ts:33](../apps/backend/src/db/schema/obligations.ts#L33) |
| F13 | Soft delete | **CRITICAL** | Soft delete and its ledger reversal are **not atomic**, and a reversal failure is swallowed to a log line | An archived receipt keeps a live journal entry with no durable record of the gap | [obligationLedgerSync.ts:24-35](../apps/backend/src/obligations/use-cases/obligationLedgerSync.ts#L24-L35) |
| F14 | Soft delete | **CRITICAL** | A save copies `deleted_at` from the payload, so a stale sync **resurrects** an archived receipt — and the ledger then nets to **−amount** | Silent un-delete plus a double reversal; restore provenance never stamped | [obligationCollectionsPersist.ts:114](../apps/backend/src/db/repositories/obligationCollectionsPersist.ts#L114) |
| F15 | Concurrency | HIGH | No OCC anywhere: no `version` column, unconditional upsert, read-modify-write on update | Lost updates; the wrong revision is reversed when two users edit | [obligationsUseCases.ts:115-126](../apps/backend/src/obligations/use-cases/obligationsUseCases.ts#L115-L126) |
| F16 | Soft delete | MEDIUM | Workspace purge issues a hard `DELETE` against a table with a `forbid_hard_delete` trigger | Purge raises `check_violation` unless the caller sets `app.allow_hard_purge` | [obligationCollectionsPersist.ts:234](../apps/backend/src/db/repositories/obligationCollectionsPersist.ts#L234) |
| F17 | Soft delete | OK (verified) | Bulk delete passes requested ids, not succeeded ids, to the reversal loop | Safe — re-processing is idempotent by lifecycle key | [obligationLedgerSync.ts:72-84](../apps/backend/src/obligations/use-cases/obligationLedgerSync.ts#L72-L84) |
| F18 | Precision | LOW | A negative penny residual can zero the largest allocation line, dropping it and skipping the posting with a misleading log | Verified tiny-amount edge case; the receipt posts nothing | [obligationPostingLogic.ts:168](../packages/shared/src/finance/obligationPostingLogic.ts#L168) |
| F19 | Precision | MEDIUM | The "dues/balance" figure is client-side float math and divides by the liability percentages only, while the ledger renormalizes by **all** percentages | UI dues ≠ posted liability; the feature dir is outside `check:money-safety` | [obligationsSummaryCalculations.ts:110-114](../apps/frontend/src/tenant/features/obligations/lib/obligationsSummaryCalculations.ts#L110-L114) |
| F20 | Ratchet | LOW | `check:money-safety` blanket-allows every repository `Number()` citing `financeEnumParityDb`, which does **not** cover `obligation_collections` | The obligation money conversion is unverified | [check-money-safety.mjs:31-41](../scripts/check-money-safety.mjs#L31-L41) |
| F21 | Precision | LOW | `currency_id` has neither an FK nor any FX handling; a foreign-currency receipt posts 1:1 into the functional-currency ledger | Misstated ledger for any non-functional currency | [obligationPostingService.ts:158-171](../apps/backend/src/accounting/ledgerPosting/obligationPostingService.ts#L158-L171) |

### Status of each finding

| Finding | Status in this change set |
| --- | --- |
| F1 money as a JS float | **Fixed** — `moneyNumberAmountSchema` on both obligation DTOs (always-on 2-dp + safe-cents), and the form validates the scale inline before saving |
| F2 `::float8` aggregates | **Fixed** — `sum(...)::numeric::text` + `roundMoneyAmount` in the report and metrics repositories |
| F3 naive timestamps | **Fixed** — §6 of migration 0258 converts the 13 columns (policy dropped/re-created around it) |
| F4 `received_date` | Verified correct, no change |
| F5 reversal posts "today" | **Pinned** — the revision test asserts the reversal takes the workspace business day while the replacement keeps the receipt date |
| F6 no `contacts` FK | **Fixed** — `obligation_collections_sender_fk`, RESTRICT |
| F7 Drizzle/DB FK drift | **Fixed** — all six composite FKs declared with their `0068` names (+ snapshot) |
| F8 no account FK | **Fixed** — `obligation_distributions_account_fk`, RESTRICT |
| F9 receipt not unique / index drift | **Partly fixed** — unique partial receipt index + `_date_active_idx` declared + two dead indexes dropped, all in the concurrent file; the server-side allocator is deferred (D3) |
| F10 percentage bounds | **Fixed** — CHECKs + unique (wakala, name) index; sum-to-100 stays an application guard |
| F11 enum CHECKs | **Fixed** — payment mode, distribution type, designated-for (with a pre-flight normalization) |
| F12 duplicate catalogue names | Deferred (D2) — needs a merge decision |
| F13 non-atomic archive reversal | **Fixed** — archive/restore + posting now share one transaction and a failure propagates |
| F14 silent resurrection | **Fixed** — `deleted_at` removed from both save paths, restore provenance stamped |
| F15 no OCC | **Fixed** — `version` column, `setWhere` guard, 409 on a stale token |
| F16 hard delete vs trigger | **Fixed** — the wipe/replace paths opt into `app.allow_hard_purge` deliberately |
| F17 bulk-delete id set | Verified safe, no change |
| F18 penny residual | **Fixed** — largest-remainder allocation |
| F19 client-side float dues | **Fixed** in the domain change set — `allocateWakalaSplits` ([obligationSplitAllocation.ts](../packages/shared/src/finance/obligationSplitAllocation.ts)) is now the one allocation rule for the ledger and the summary, which also accumulates in integer cents |
| F20 ratchet coverage | **Fixed** — obligations added to the parity test's table list |
| F21 collection FX | Deferred (D4) — new columns + an FX-aware line builder |

---

## 1. Precision & date integrity

### 1.1 F1 — money crosses the boundary as a JavaScript float

The column is exact:

```ts
// apps/backend/src/db/schema/obligations.ts:137
amount: numeric("amount", { precision: 12, scale: 2 }).notNull().default("0"),
```

Everything around it is not. The read mapper converts the returned decimal **string** to a `number`:

```ts
// apps/backend/src/db/repositories/obligationCollectionsRepository.ts:50
amount: Number(row.amount),
```

the write mapper converts it back:

```ts
// apps/backend/src/db/repositories/obligationCollectionsPersist.ts:29
amount: String(record.amount),
```

and the DTO accepts any non-negative float:

```ts
// packages/shared/src/obligations/obligationsModuleManifest.ts:152
amount: z.number().min(0),
```

There is no 2-dp check, although the repo already has the exact predicates ([`accountingLedgerInvariants.ts:47-61`](../packages/shared/src/finance/accountingLedgerInvariants.ts#L47-L61)):

```ts
const hasAtMostTwoDecimals = (value: number): boolean =>
  Math.abs(value - Math.round(value * 100) / 100) < 1e-9;
const hasSafeCents = (value: number): boolean => Number.isSafeInteger(Math.round(value * 100));
```

**Impact.** A value such as `0.1 + 0.2` or a unit price × quantity enters as `0.30000000000000004`; Postgres stores `0.30` for the column but the API response, the client's optimistic cache and the client-side totals keep the unrounded number. For the current column width the per-row conversion itself is exact (`numeric(12,2)` maxes out at ~1.0e12 cents, well inside `2^53`), so this is a **contract** defect rather than a live money bug — but nothing pins that bound (F20), and every aggregate path (F2, F19) inherits the float.

**Fix (P1, contract-level).** Add an exact number schema to the shared money module and use it in the obligation record/insert schemas:

```ts
// packages/shared/src/money/moneySchemas.ts
export const moneyNumberAmountSchema = z
  .number()
  .finite()
  .min(0)
  .refine(
    (value) => Math.abs(value - Math.round(value * 100) / 100) < 1e-9,
    "amount must have at most 2 decimal places",
  )
  .refine((value) => Number.isSafeInteger(Math.round(value * 100)), "amount exceeds exact cents");
```

```ts
// packages/shared/src/obligations/obligationsModuleManifest.ts:152,179
amount: moneyNumberAmountSchema,
```

**Fix (target, deferred D1).** Move `amount` to `nonNegativeMoneyDecimalAmountSchema` ([`moneySchemas.ts:26`](../packages/shared/src/money/moneySchemas.ts#L26)) — decimal string end-to-end, `numeric` never passing through `Number()`. That is an API-breaking change across the shared contract, the backend mappers, the CSV transfer schema and the frontend, so it is recorded as a design item rather than folded into a DDL migration.

### 1.2 F2 — aggregates are computed in binary float

```ts
// apps/backend/src/db/repositories/obligationRepositoryReport.ts:42 (and :54, :72, :91)
totalAmount: sql<number>`coalesce(sum(${obligationCollections.amount}), 0)::float8`,
```

```ts
// apps/backend/src/db/repositories/obligationRepositoryMetrics.ts:39
totalAmount: sql<number>`coalesce(sum(${obligationCollections.amount}), 0)::float8`,
```

`0.01` has no exact binary representation, so a sum of many 2-dp rows is not a 2-dp number: `123.45000000000002` is a normal outcome. The `::float8` cast is explicit and intentional (it lets Drizzle type the result as `number`), which is precisely what makes it easy to overlook.

**Fix.** Keep the aggregate in `numeric` and convert through integer cents at the single permitted boundary:

```ts
// keep the sum in numeric — no per-row float error ever accumulates
totalAmount: sql<string>`coalesce(sum(${obligationCollections.amount}), 0)::text`,
// … then cross the float boundary once, through integer cents:
const totalCents = Math.round(Number(totalsRow?.totalAmount ?? "0") * 100);
totalAmount: totalCents / 100,
```

or, better, return the decimal string to the client and format it there. The same treatment applies to the four `sum(...)` projections in the report query.

### 1.3 F3 — obligation timestamps are timezone-naive in the database

`0000_init.sql:238,246,260,268,276` created `updated_at timestamp` (naive) for every obligation table, and `0052_obligations_3nf_normalization.sql:5,9,14,19,26,39,42` added `created_at`/`deleted_at` the same way:

```sql
ALTER TABLE "obligation_collections" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
ALTER TABLE "obligation_collections" ADD COLUMN IF NOT EXISTS "created_at" timestamp NOT NULL DEFAULT now();
```

`0108_soft_delete_schema_rls_and_triggers.sql:74` then tried to widen them:

```sql
ALTER TABLE "obligation_collections" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP WITH TIME ZONE;
```

Because the column already existed, `ADD COLUMN IF NOT EXISTS` was a **no-op**, and no later migration (grep: zero `ALTER COLUMN … TYPE` statements on any obligation table except `0106`'s `deletion_reason` varchar) ever converted it. Drizzle and the snapshots nevertheless declare `timestamptz`:

```ts
// apps/backend/src/db/schema/obligations.ts:144-145
createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
```

**Thirteen columns** are affected — `created_at`, `updated_at`, `deleted_at` on `obligation_collections`, and `created_at` + `updated_at` on `obligation_types`, `mujtahids`, `mujtahid_reps`, `wakala_types`, `obligation_distributions`. (`restored_at` is **correct**: `0108:77` genuinely created it as `timestamptz`, and `obligation_module_preferences.updated_at` was created correctly in `0179:10`.)

**Impact.** node-postgres reads a naive `timestamp` through the **process-local** timezone and writes one the same way, so a single long-lived process round-trips consistently — masking the defect. It surfaces as soon as a value crosses a boundary with a different timezone: a worker or migration running with a different `TZ`, a session whose `TimeZone` differs from the Node process (so SQL-side comparisons against `now()`/`current_date` are skewed), or a replica/host relocation. `deleted_at` sorting in the trash directory and the `created_at`/`updated_at` ISO strings in the API payload are the visible symptoms. This is the same defect `0229_hasanat_rls_and_timestamps.sql` documents and fixes for hasanat:

> `0000/0047` created every hasanat timestamp as `timestamp` (without time zone) and 0108's `ADD COLUMN IF NOT EXISTS … TIMESTAMP WITH TIME ZONE` was a no-op because the column already existed.

**Fix.** See [§4.6](#46-timestamp--timestamptz). `check:migration-hygiene` tracks the repo-wide count as a decreasing-only baseline (`bareTimestamps: 311`), so the conversion is aligned with an existing ratchet rather than an informal cleanup.

**Considered and rejected for this change set:** the `hasanat` migration also installed DB-owned `update_updated_at_column()` triggers. Obligations do not need them — `updated_at` is set explicitly on every write path and is not a sort key (`listObligationCollectionsByWorkspace` orders by `id`) — and adding a trigger that fires on the ledger-relevant `amount` update would make "when did this number change" ambiguous. Recorded, not implemented.

### 1.4 F4 — `received_date` is correct (verified, no action)

`received_date` is a genuine `date` column, declared `mode: "string"`, converted from varchar by `0184_finance_date_columns.sql`, and every write goes through the strict helper:

```ts
// apps/backend/src/db/repositories/obligationCollectionsPersist.ts:26
receivedDate: requireDbDateValue(record.received_date, "received_date"),
```

`requireDbDateValue` rejects an empty or non-`YYYY-MM-DD` value with a 400 instead of storing `NULL` ([dbDate.ts:25-37](../apps/backend/src/lib/dbDate.ts#L25-L37)). This is the model the rest of the module's dates should follow. No change.

### 1.5 F5 — correcting entries land on a different date than the entry they correct

Posting resolves the receipt's own date:

```ts
// apps/backend/src/accounting/ledgerPosting/obligationPostingService.ts:156
const date = await postingDateForTenant(tenant, collection.received_date);
```

Every reversal, however, resolves "today":

```ts
// apps/backend/src/accounting/ledgerPosting/ledgerReversalPostingService.ts:122
const date = await postingDateForTenant(tenant);
```

Editing a receipt received on 2026-10-31 on 2026-11-02 posts the reversal into November, while the replacement keeps the receipt's own date. That is a deliberate *closed-period* posture — the correction can never rewrite a settled month — and it is now stated and pinned.

**Fix applied.** `obligationPostingService.test.ts` asserts both halves of the rule on the edit path: the reversal carries the workspace business day, the replacement carries `received_date`. If period-matching is ever preferred instead, pass the original date's period through — but that must be decided before a correction can hit a closed year, which already fails closed via `assertJournalEntryPeriodOpen` ([ledgerPostingHelpers.ts:126](../apps/backend/src/accounting/ledgerPosting/ledgerPostingHelpers.ts#L126)).

---

## 2. Referential integrity & indexing

### 2.1 F6 — the donor link is unconstrained

`sender_id` is a contact id (the form binds a `ContactPicker`), yet the column carries no reference at all:

```ts
// apps/backend/src/db/schema/obligations.ts:135
senderId: varchar("sender_id", { length: 64 }).notNull(),
```

`0068_schema_hardening_foreign_keys_and_timestamptz.sql:202-237` added the type and rep foreign keys but not this one. Consequence: `contacts` rows can be purged (or merged) with no database-level resistance, leaving receipts whose donor no longer exists; a per-contact receipt statement becomes a tenant scan filtered at runtime; and the contact-merge/delete guards that other modules expose cannot see these rows.

**Fix.** Add the reference with `RESTRICT` — a receipt without its donor is not a meaningful record, and `contacts` already forbids hard delete via `trg_contacts_forbid_hard_delete` (`0104:145-148`), so `RESTRICT` only ever fires on the deliberate purge path, where it should.

```sql
ALTER TABLE "obligation_collections"
  ADD CONSTRAINT "obligation_collections_sender_fk"
  FOREIGN KEY ("workspace_subdomain", "sender_id")
  REFERENCES "contacts"("workspace_subdomain", "id") ON DELETE RESTRICT NOT VALID;
ALTER TABLE "obligation_collections" VALIDATE CONSTRAINT "obligation_collections_sender_fk";
```

The `NOT VALID` + `VALIDATE` pair keeps the `ADD` from taking a full-table lock, and only fails if the pre-flight in [§4.1](#41-orphan-pre-flights) was bypassed.

### 2.2 F7 — five DB foreign keys are missing from the Drizzle model

The live database has (from `0068:204-237`):

| Constraint | Columns → target |
| --- | --- |
| `mujtahid_reps_mujtahid_fk` | `(workspace_subdomain, mujtahid_id)` → `mujtahids` |
| `wakala_types_obligation_type_fk` | `(workspace_subdomain, obligation_type_id)` → `obligation_types` |
| `wakala_types_rep_fk` | `(workspace_subdomain, mujtahid_representative_id)` → `mujtahid_reps` |
| `obligation_distributions_wakala_fk` | `(workspace_subdomain, wakala_type_id)` → `wakala_types` |
| `obligation_collections_obligation_type_fk` | `(workspace_subdomain, obligation_type_id)` → `obligation_types` |
| `obligation_collections_rep_fk` | `(workspace_subdomain, mujtahid_representative_id)` → `mujtahid_reps` |

Only the first and fourth are declared in Drizzle. `obligationCollections` and `wakalaTypes` declare **no** `foreignKey()` at all — their table callbacks contain only a primary key and indexes ([obligations.ts:147-179](../apps/backend/src/db/schema/obligations.ts#L147-L179)) — and the snapshot agrees with the schema, not the database:

```
== wakala_types
   fk wakala_types_workspace_subdomain_workspaces_subdomain_fk
== obligation_collections
   fk obligation_collections_workspace_subdomain_workspaces_subdomain_fk
```

**Impact.** The ORM cannot express `with:` relational queries across these edges (the hand-written joins in the report repository are the workaround), and the declarative model is wrong: any `drizzle-kit push` against a database, or a future `generate` that re-baselines the snapshot, proposes dropping constraints that the running system depends on. Only `ON DELETE CASCADE` protects a tenant purge today, and that cascade lives exclusively in SQL that the model does not know about.

**Fix.** Mirror them in [obligations.ts](../apps/backend/src/db/schema/obligations.ts) with the `0068` constraint names:

```ts
// wakala_types table callback
foreignKey({
  columns: [table.workspaceSubdomain, table.mujtahidRepresentativeId],
  foreignColumns: [mujtahidReps.workspaceSubdomain, mujtahidReps.id],
  name: "wakala_types_rep_fk",
}).onDelete("cascade"),
foreignKey({
  columns: [table.workspaceSubdomain, table.obligationTypeId],
  foreignColumns: [obligationTypes.workspaceSubdomain, obligationTypes.id],
  name: "wakala_types_obligation_type_fk",
}).onDelete("cascade"),

// obligation_collections table callback
foreignKey({
  columns: [table.workspaceSubdomain, table.obligationTypeId],
  foreignColumns: [obligationTypes.workspaceSubdomain, obligationTypes.id],
  name: "obligation_collections_obligation_type_fk",
}).onDelete("cascade"),
foreignKey({
  columns: [table.workspaceSubdomain, table.mujtahidRepresentativeId],
  foreignColumns: [mujtahidReps.workspaceSubdomain, mujtahidReps.id],
  name: "obligation_collections_rep_fk",
}).onDelete("cascade"),
```

(and the two already-declared ones get explicit `name:` values so the snapshot stops depending on Drizzle's generated names).

### 2.3 F8 — a distribution can point at an account that does not exist

`0198_obligation_distributions_account_id.sql` added the column bare, and Drizzle matches:

```ts
// apps/backend/src/db/schema/obligations.ts:109
accountId: text("account_id"),
```

The only validation is at posting time, where an unknown account makes the **entire** receipt unpostable:

```ts
// packages/shared/src/finance/obligationPostingLogic.ts:145
if (!targetAccountId || !knownAccountIds.has(targetAccountId)) return null;
```

`postObligationEntry` then returns early with a log line ([obligationPostingService.ts:173-179](../apps/backend/src/accounting/ledgerPosting/obligationPostingService.ts#L173-L179)) — a saved receipt with no journal entry, and no user-visible error.

**Fix.** Constrain the mapping and index it:

```sql
ALTER TABLE "obligation_distributions"
  ADD CONSTRAINT "obligation_distributions_account_fk"
  FOREIGN KEY ("workspace_subdomain", "account_id")
  REFERENCES "accounting_accounts"("workspace_subdomain", "id") ON DELETE RESTRICT NOT VALID;
ALTER TABLE "obligation_distributions" VALIDATE CONSTRAINT "obligation_distributions_account_fk";
```

`accounting_accounts` is soft-deletable, so an *archived* account still satisfies the FK; the posting-time `knownAccountIds` check remains the guard for that case and should keep returning a user-visible conflict rather than a silent skip (tracked with F18).

### 2.4 F9 — receipt numbers are neither server-allocated nor unique

The next receipt number is derived **in the browser** from the collection list it happens to hold:

```ts
// packages/shared/src/obligations/obligationsReceiptNumberingUtils.ts:20
export function computeNextObligationReceiptNo(
  existingCollections: ObligationCollectionReceiptRecord[],
  settings?: Partial<ObligationsSettings>,
  referenceDate?: Date | string,
): string {
  // … max(existing) + 1
```

and the only index on the column is non-unique:

```ts
// apps/backend/src/db/schema/obligations.ts:149-152
index("obligation_collections_workspace_receipt_idx").on(table.workspaceSubdomain, table.receiptNo),
```

**Impact.** Two users (or one user with two tabs, or an offline sync replaying a batch) compute the same "next" number and both writes succeed. Receipt numbers are the human key on a printed voucher, so a duplicate is a reconciliation problem, not a cosmetic one. The accounting module already solved this exact problem with a server-side counter table (`accounting_voucher_counters`, `0128`), which is the right long-term model here too.

The index set also carries two defects:

- `obligation_collections_workspace_deleted_idx` (`(workspace_subdomain, deleted_at)`, plain) covers exactly the same columns as `obligation_collections_workspace_deleted_records_idx` (`(workspace_subdomain, deleted_at) WHERE deleted_at IS NOT NULL`). Every trash read filters `deleted_at IS NOT NULL` — the repository's `isNotNull` branch ([obligationCollectionsRepository.ts:168](../apps/backend/src/db/repositories/obligationCollectionsRepository.ts#L168)) — which the partial index already serves, so the plain index only adds write cost.
- `obligation_collections_workspace_date_active_idx` is **live but declared nowhere** — created by `0090_performance_audit_indexes.sql:23` as `(workspace_subdomain, received_date DESC) WHERE deleted_at IS NULL`, absent from the Drizzle schema and from every snapshot. Combined with the plain `obligation_collections_workspace_date_idx` this is two indexes on the same column pair, one of them undeclared.

**Fix — out of band, not in the migration.** `obligation_collections` and `obligation_distributions` are both in `LARGE_TABLES` in [`check-migration-indexes.mjs:46-47`](../scripts/check-migration-indexes.mjs#L46-L47), so a new plain `CREATE INDEX` on them fails that ratchet. The indexes go into the concurrent file described in [§5](#5-out-of-band-index-file-applied):

```sql
-- apps/backend/scripts/sql/0258_obligations_indexes_concurrent.sql
DROP INDEX CONCURRENTLY IF EXISTS "obligation_collections_workspace_deleted_idx";
DROP INDEX CONCURRENTLY IF EXISTS "obligation_collections_workspace_date_idx";

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "obligation_collections_workspace_receipt_uidx"
  ON "obligation_collections" ("workspace_subdomain", "receipt_no")
  WHERE "deleted_at" IS NULL;

DROP INDEX CONCURRENTLY IF EXISTS "obligation_collections_workspace_receipt_idx";
```

`_date_active_idx` is *declared* in the model instead of being created again — it already exists from 0090, so declaring it removes the drift without new DDL. The plain `_date_idx` is dropped afterwards; 0090 is an applied migration, so the partial index is guaranteed present in any migrated database. The plain `_sender_idx` is **kept** (the RESTRICT probe on a contact purge uses it); a per-donor statement index waits until a statement query exists.

### 2.5 F10 — percentage, name uniqueness and the sum-to-100 guard

```ts
// apps/backend/src/db/schema/obligations.ts:106-109
percentage: numeric("percentage", { precision: 5, scale: 2 }).notNull().default("0"),
wakalaTypeId: text("wakala_type_id").notNull(),
type: varchar("type", { length: 30 }).notNull(),
accountId: text("account_id"),
```

`numeric(5,2)` permits **999.99**; the DTO permits at most 100 ([obligationsModuleManifest.ts:116](../packages/shared/src/obligations/obligationsModuleManifest.ts#L116)). The database therefore accepts values the API rejects — which matters because the API is not the only writer: the CSV/transfer import and the collection-replacement path both reach the same table.

**Fix.** Bound the value, keep names unique inside a wakala:

```sql
ALTER TABLE "obligation_distributions"
  ADD CONSTRAINT "obligation_distributions_percentage_chk"
  CHECK ("percentage" >= 0 AND "percentage" <= 100);
```

A `(workspace_subdomain, wakala_type_id, name)` unique index belongs in the concurrent file (the table is in `LARGE_TABLES`).

A *sum-to-100* constraint is deliberately **not** proposed as DDL: the posting engine already tolerates a non-100 total by renormalizing (`effectiveTotalPct`, [obligationPostingLogic.ts:129-130](../packages/shared/src/finance/obligationPostingLogic.ts#L129-L130)). The defect is that the **frontend does not**, which is F19 — a shared-allocation fix, not a database one.

### 2.6 F11 — three enum columns have no CHECK

`payment_mode` (API enum `Cash | Online`), `obligation_distributions.type` (API enum `Income | Liability`) and `obligation_types.designated_for` (API enum `Syed | Non-Syed | Both | None`, default `'Both'`) are unconstrained varchars in the database. The metrics counters compare `payment_mode = 'Cash'` literally ([obligationRepositoryMetrics.ts:40-41](../apps/backend/src/db/repositories/obligationRepositoryMetrics.ts#L40-L41)), so a `"cash"` row silently drops out of every KPI without an error.

**Fix.** Follow `0252_finance_enum_checks.sql`:

```sql
ALTER TABLE "obligation_collections"
  ADD CONSTRAINT "obligation_collections_payment_mode_chk"
  CHECK ("payment_mode" = ANY (ARRAY['Cash'::character varying, 'Online'::character varying]));
ALTER TABLE "obligation_distributions"
  ADD CONSTRAINT "obligation_distributions_type_chk"
  CHECK ("type" = ANY (ARRAY['Income'::character varying, 'Liability'::character varying]));
ALTER TABLE "obligation_types"
  ADD CONSTRAINT "obligation_types_designated_for_chk"
  CHECK ("designated_for" = ANY (ARRAY['Syed'::character varying, 'Non-Syed'::character varying, 'Both'::character varying, 'None'::character varying]));
```

The four values are the shared DTO's `z.enum` ([obligationsModuleManifest.ts:9](../packages/shared/src/obligations/obligationsModuleManifest.ts#L9)), and the frontend has a matching `DesignatedFor` union ([obligationTypeManagerShared.ts:4](../apps/frontend/src/tenant/features/obligations/lib/obligationTypeManagerShared.ts#L4)). The API route is therefore the only enforcement point: the column itself accepts any 20-character string, so a direct repository write, a data migration or a restored backup can carry a value the API would have rejected.

### 2.7 F12 — duplicate catalogue names are allowed

`obligation_types_workspace_name_idx`, `mujtahids_workspace_name_idx` and `mujtahid_reps` carry no unique variant, so two types named "Zakat" coexist and the receiving form becomes a coin flip. Not fixed here: making the index unique requires a product decision on merging existing duplicates, and a failed migration on real data is worse than the current ambiguity. Recorded as D2.

### 2.8 The briefed compound key is unrepresentable

The requested `(tenant_id, contact_id, status, due_date, deleted_at)` index cannot be built: `contact_id` is `sender_id`, and `status` and `due_date` do not exist. The closest real query paths, and the indexes proposed for them, are:

| Query path | Index |
| --- | --- |
| Directory list (active, by received date) | `obligation_collections_workspace_date_active_idx` (exists, `0090`) |
| Per-contact statement | `obligation_collections_workspace_sender_idx` (kept; widened to `(sender_id, received_date DESC)` only when a statement query exists) |
| Trash list | `obligation_collections_workspace_deleted_records_idx` (exists) |
| Receipt lookup / duplicate guard | `obligation_collections_workspace_receipt_uidx` — unique, partial (F9) |

---

## 3. Soft-delete & concurrency

### 3.1 F13 — the archive and its ledger reversal are two transactions, and a failure is swallowed

```ts
// apps/backend/src/obligations/use-cases/obligationsUseCases.ts:155-164
deleteObligationCollectionById: async (id, deletedBy = "system", reason) => {
  const res = await collectionCrud.deleteById(id, deletedBy, reason);   // ← commits the soft delete
  const tenant = getRequestTenant();
  if (tenant && res) await postArchivedCollections(repo, tenant, [id]); // ← separate transaction
  return res;
},
```

`postArchivedCollections` posts each reversal through `runLedgerPosting`, which catches everything:

```ts
// apps/backend/src/obligations/use-cases/obligationLedgerSync.ts:30-34
try {
  await posting();
} catch (error: unknown) {
  logger.error({ err: error, tenant, collectionId, action }, "Obligation ledger posting failed");
}
```

The comment above it is explicit that this is intentional ("a posting failure must not roll back or reject a save the user already completed"), and [obligationLedgerWiring.test.ts:132](../apps/backend/src/__tests__/obligationLedgerWiring.test.ts#L132) pins it.

**Why it is still a CRITICAL finding.** It is defensible for a *create* (a temporarily unposted receipt is a known backlog) and indefensible for an *archive*: the row disappears from every active view and from the ledger's own reconciliation surface, while the journal entry that says the money was received stays on the books — and `tryPostObligationArchiveJournal` is a no-op when `findLatestObligationPosting` returns nothing, so even a successful reversal request cannot fix a receipt that was never posted. The only trace of the gap is a Pino line.

**Fix (choose one, both acceptable).**

1. **Same transaction.** Move the reversal into the transaction that writes `deleted_at`. `postObligationEntry`/`tryPostArchiveReversalJournal` already own their transaction through `withTenant`, so this needs a transaction-aware variant (the accounting module does this for generated vouchers). A failure then rolls the archive back and the user sees an error — correct for an accounting action.
2. **Transactional outbox.** Write an `outbox_events` row (the soft-delete outbox already exists for CDC) in the same transaction as `deleted_at`, and let the worker post the reversal with retry and dead-lettering. A failure becomes a retried job instead of a log line.

Either way, add the reconciliation the module is missing today. It cannot be a pure SQL query: the archive reversal key is a SHA-256 over the row's `deletedAt`, so it has to be produced by the same helper the write path uses — re-deriving it in SQL would compare a PostgreSQL timestamp rendering against a JavaScript ISO string and silently match nothing.

```ts
// apps/backend/src/obligations/use-cases/obligationLedgerReconcile.ts (new)
import { lifecycleSourceId } from "../../accounting/ledgerPosting/ledgerReversalPostingService.js";

/** Archived receipts whose archive reversal is missing — the gap F13 leaves behind today. */
export async function findUnreversedArchivedCollections(tenant: string) {
  const archived = await listArchivedCollections(tenant); // deleted_at IS NOT NULL
  const gaps = [];
  for (const collection of archived) {
    const key = lifecycleSourceId(collection.id, "archive", collection.deletedAt!);
    if (!(await findEntryIdBySource(tenant, "reversal", key))) gaps.push(collection);
  }
  return gaps;
}
```

Run it from the module's health/ops surface (and, once option 2 is in place, assert it returns empty after the outbox drains).

### 3.2 F14 — a stale sync resurrects an archived receipt, and the ledger double-reverses

Both write paths copy the payload's deletion state straight into the row:

```ts
// apps/backend/src/db/repositories/obligationCollectionsPersist.ts:35 and :54 (saveObligationCollection)
deletedAt: record.deletedAt ? new Date(record.deletedAt) : null,
```

```ts
// apps/backend/src/db/repositories/obligationCollectionsPersist.ts:114 (bulkSaveObligationCollections, on conflict)
deletedAt: sql`excluded.deleted_at`,
```

A client that loaded the collection before the archive — which is exactly what an offline bulk sync or a second tab does — posts `deletedAt: null` and **un-deletes the row**, bypassing `bulkRestoreObligationCollections` and its restore accounting.

The ledger consequence is worse than a missing restore entry. Tracing `upsertObligationCollections` ([obligationsUseCases.ts:128](../apps/backend/src/obligations/use-cases/obligationsUseCases.ts#L128)):

1. The receipt is posted as entry `E` under `source_id = oc-<h(id|0)>`.
2. It is archived → reversal `R1` under `source_id = archive-<h(id|archive|deletedAt)>` ([obligationPostingService.ts:253-268](../apps/backend/src/accounting/ledgerPosting/obligationPostingService.ts#L253-L268)). `E` stays on the books, as it must.
3. The stale sync clears `deleted_at`. `syncObligationJournal` receives `previous` with `deletedAt` set, so it **skips** the revision-key early return ([obligationPostingService.ts:227](../apps/backend/src/accounting/ledgerPosting/obligationPostingService.ts#L227)) and calls `tryPostReversalOfSource(tenant, "obligation", latest.sourceId, …)` — keyed on the **plain** `E` id, not on a lifecycle key ([obligationPostingService.ts:238-243](../apps/backend/src/accounting/ledgerPosting/obligationPostingService.ts#L238-L243)).
4. That writes `R2`, a second reversal of the *same* `E`, and then posts a fresh `E2`.

Net on the books: `E + R1 + R2 + E2 = E2 − E`. The tenant's ledger is now **negative** for a receipt the UI shows as received. Neither `persistGeneratedEntry`'s idempotency (`(source_type, source_id)`) nor `findLatestObligationPosting` catches it, because `R2` uses a key that was legitimately free.

The same file also fails to stamp restore provenance: `bulkRestoreObligationCollections` clears `deletedAt` and ignores its `_userId` argument, though the columns exist ([obligationCollectionsPersist.ts:200-232](../apps/backend/src/db/repositories/obligationCollectionsPersist.ts#L200-L232)) — `0108` added `restored_at`/`restored_by`, and nothing ever writes them.

**Fix.**

1. **The save path must not be able to change `deleted_at`.** Remove `deletedAt` from both `saveObligationCollection` and `bulkSaveObligationCollections`' conflict `set` (write it on insert only), and drop it from the record DTO's write surface. Resurrection must go through restore.
2. **Stamp restore provenance** in `bulkRestoreObligationCollections`:
   ```ts
   .set({ deletedAt: null, deletedBy: null, deletionReason: null, restoredAt: now, restoredBy: userId ?? null, updatedAt: now })
   ```
3. **Guard the reversal in `syncObligationJournal`**: if `previous.deletedAt` is set and the new record is not, this is a resurrection, not a revision — let the restore path own it (`tryPostObligationRestoreJournal`) rather than reversing the live posting.

### 3.3 F15 — no optimistic concurrency anywhere in the module

There is no `version` column on any obligation table, the upsert is unconditional, and the update path is a read-modify-write:

```ts
// apps/backend/src/obligations/use-cases/obligationsUseCases.ts:115-126
updateObligationCollectionById: async (id, record) => {
  const previous = tenant ? ((await loadCollectionsById(repo, tenant, [id])).get(id) ?? null) : null;
  const updated = await collectionCrud.updateById(id, record);   // no lock, no predicate
  if (tenant && updated) await postSavedCollection(tenant, updated, previous);
  return updated;
},
```

Two concurrent editors both read `previous = amount 100`, both write, and the second silently wins — and each posts a reversal/replacement computed from its own idea of `previous`, so the *ledger* revision history can end up referencing an amount that was never in the row.

The repo has a ready-made pattern (`questionBankQuestionUpsert.ts:17,34-48,81-99`):

```ts
export const QUESTION_VERSION_MATCH = sql`${questions.version} = excluded.version`;
// …
.onConflictDoUpdate({ target, set: { …  version: sql`${questions.version} + 1`, updatedAt: sql`now()` }, setWhere: QUESTION_VERSION_MATCH })
```

and `assertEveryQuestionWritten` turns a silently-skipped row into a 409 rather than a false success.

**Fix.**

```sql
ALTER TABLE "obligation_collections"
  ADD COLUMN IF NOT EXISTS "version" integer NOT NULL DEFAULT 1;
ALTER TABLE "obligation_collections"
  ADD CONSTRAINT "obligation_collections_version_chk" CHECK ("version" > 0);
```

```ts
// apps/backend/src/db/schema/obligations.ts — inside obligationCollections
/** OCC token: a save carrying a stale version writes nothing and returns 409. */
version: integer("version").notNull().default(1),
```

plus `version` on `obligationCollectionRecordSchema` (optional, so legacy payloads keep working — the question-bank pattern), `setWhere: sql\`${obligationCollections.version} = excluded.version\``, `version: sql\`${obligationCollections.version} + 1\`` in the conflict `set`, and a `returning({ id })` length check that raises `ConflictError` (409) when a row was skipped. `updateObligationCollectionById` gets the same treatment via an `expectedVersion` predicate on the `UPDATE`.

### 3.4 F16 — workspace purge hard-deletes a table that forbids hard delete

```ts
// apps/backend/src/db/repositories/obligationCollectionsPersist.ts:234-247
export async function deleteObligationsByWorkspace(workspaceSubdomain: string): Promise<void> {
  await withTenant(subdomain, async (tx) => {
    await tx.delete(obligationCollections).where(…);
    await tx.delete(obligationDistributions).where(…);
    …
```

`obligation_collections` carries `trg_obligation_collections_forbid_hard_delete` (`0104:190-193`, re-created `0108:201-204`), whose function raises unless the caller set the GUC:

```sql
IF current_setting('app.allow_hard_purge', true) = 'true' THEN RETURN OLD; END IF;
RAISE EXCEPTION 'Hard delete forbidden on table "%", use soft-delete …' USING ERRCODE = 'check_violation';
```

So this function only works if its caller (the workspace wipe/restore path) sets `SET LOCAL app.allow_hard_purge = 'true'`. Nothing in the repository sets it outside the test suites. Either the purge path deliberately opts in — and that must be explicit, tested, and recorded on the audit chain — or this function throws on every purge of a workspace that has receipts.

**Fix.** Establish and test the contract: the workspace purge sets `app.allow_hard_purge` inside its own transaction, and writes the purge event to the outbox/audit chain (the soft-delete skill's hard-purge path). Add a DB test that purges a workspace with one receipt and asserts both the deletion and the recorded event.

### 3.5 F17 — bulk delete's id set is safe (verified, do not "fix")

`bulkSoftDeleteObligationCollections` passes the **requested** ids to `postArchivedCollections`, not the set the `UPDATE` actually changed ([obligationsUseCases.ts:174-183](../apps/backend/src/obligations/use-cases/obligationsUseCases.ts#L174-L183)). That looks like a bug and is not: `postArchivedCollections` re-reads each row and `continue`s unless `deletedAt` is set, and the archive reversal is keyed on that row's own `deletedAt`, so an already-archived row re-processed in the same request replays the same `source_id` and `persistGeneratedEntry` returns `null` ([ledgerPostingHelpers.ts:117-122](../apps/backend/src/accounting/ledgerPosting/ledgerPostingHelpers.ts#L117-L122)). Recorded so a future reader does not "tighten" it into a regression.

### 3.6 F18 — a penny residual can silently skip a posting, with the wrong message

`buildObligationPostingLines` allocates in integer cents and pushes the residual onto the largest line:

```ts
// packages/shared/src/finance/obligationPostingLogic.ts:152-168
const diffCents = totalCents - allocatedCents;
if (diffCents !== 0 && distCentsList.length > 0) { /* add diff to the largest line */ }
for (…) {
  const lineAmount = item.cents / 100;
  if (lineAmount <= 0) continue;          // ← the adjusted line can be dropped here
```

`Math.round` per line can over-allocate by more than the largest line holds: with four 25 % distributions on a 2-cent amount, each `round(0.5) = 1`, so `allocatedCents = 4 > totalCents = 2`, `diffCents = -2`, and the largest line becomes `-1` → dropped → the credits no longer sum to the debit → `isJournalEntryBalanced` returns false → the function returns `null`.

`postObligationEntry` then logs:

```ts
// apps/backend/src/accounting/ledgerPosting/obligationPostingService.ts:174-178
logger.info({ … }, "Obligation ledger posting skipped: posting accounts are not fully configured");
```

which points the operator at the chart of accounts for what is actually a sub-cent split. The receipt is saved and never posted, with no retry.

**Fix.** Filter zero-cent rules *before* the residual step, use largest-remainder allocation (floor every line, then hand the remaining cents to the largest fractional parts), and split the log/behaviour into two distinct outcomes: "amount too small to split across N rules" (a domain error surfaced to the user) versus "posting accounts are not configured".

---

## 4. Migration `0258_obligations_schema_integrity.sql` (applied)

Forward-only, `lock_timeout`-bounded, `--> statement-breakpoint`-separated, `DO $$` guarded — matching `0248`/`0253`/`0254`. The file is applied as written below; the journal entry (idx 258) and the meta snapshot are committed with it.

### 4.1 Orphan pre-flights

Every constraint below fails closed on dirty data, so each gets a pre-flight that names the offending count instead of letting PostgreSQL emit a bare constraint violation.

```sql
-- MMS Forward-only Migration: 0258_obligations_schema_integrity.sql
-- Closes the obligations schema findings F3, F6, F8, F10, F11 and F15
-- (docs/obligations-schema-persistence-audit-2026-11-14.md). Index work is out of band
-- (scripts/sql/0258_obligations_indexes_concurrent.sql) because obligation_collections and
-- obligation_distributions are covered by check:migration-indexes' LARGE_TABLES ratchet.

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

-- ── 1. Pre-flights ────────────────────────────────────────────────────────────
DO $$
DECLARE orphans bigint;
BEGIN
  SELECT count(*) INTO orphans
    FROM obligation_collections c
   WHERE NOT EXISTS (
     SELECT 1 FROM contacts k
      WHERE k.workspace_subdomain = c.workspace_subdomain AND k.id = c.sender_id);

  IF orphans > 0 THEN
    RAISE EXCEPTION '0258 aborted: % obligation_collections rows reference a missing contact (sender_id)', orphans;
  END IF;
END $$;
--> statement-breakpoint

DO $$
DECLARE orphans bigint;
BEGIN
  SELECT count(*) INTO orphans
    FROM obligation_distributions d
   WHERE d.account_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM accounting_accounts a
        WHERE a.workspace_subdomain = d.workspace_subdomain AND a.id = d.account_id);

  IF orphans > 0 THEN
    RAISE EXCEPTION '0258 aborted: % obligation_distributions rows reference a missing accounting account', orphans;
  END IF;
END $$;
--> statement-breakpoint
```

### 4.2 F6 — contact reference

```sql
ALTER TABLE "obligation_collections"
  ADD CONSTRAINT "obligation_collections_sender_fk"
  FOREIGN KEY ("workspace_subdomain", "sender_id")
  REFERENCES "contacts"("workspace_subdomain", "id") ON DELETE RESTRICT NOT VALID;
--> statement-breakpoint
ALTER TABLE "obligation_collections" VALIDATE CONSTRAINT "obligation_collections_sender_fk";
--> statement-breakpoint
```

### 4.3 F8 — distribution account reference

```sql
ALTER TABLE "obligation_distributions"
  ADD CONSTRAINT "obligation_distributions_account_fk"
  FOREIGN KEY ("workspace_subdomain", "account_id")
  REFERENCES "accounting_accounts"("workspace_subdomain", "id") ON DELETE RESTRICT NOT VALID;
--> statement-breakpoint
ALTER TABLE "obligation_distributions" VALIDATE CONSTRAINT "obligation_distributions_account_fk";
--> statement-breakpoint
```

### 4.4 F10 / F11 — domain CHECKs

```sql
ALTER TABLE "obligation_collections"
  ADD CONSTRAINT "obligation_collections_amount_chk" CHECK ("amount" >= 0);
--> statement-breakpoint
ALTER TABLE "obligation_collections"
  ADD CONSTRAINT "obligation_collections_payment_mode_chk"
  CHECK ("payment_mode" = ANY (ARRAY['Cash'::character varying, 'Online'::character varying]));
--> statement-breakpoint
ALTER TABLE "obligation_distributions"
  ADD CONSTRAINT "obligation_distributions_percentage_chk"
  CHECK ("percentage" >= 0 AND "percentage" <= 100);
--> statement-breakpoint
ALTER TABLE "obligation_distributions"
  ADD CONSTRAINT "obligation_distributions_type_chk"
  CHECK ("type" = ANY (ARRAY['Income'::character varying, 'Liability'::character varying]));
--> statement-breakpoint
ALTER TABLE "obligation_types"
  ADD CONSTRAINT "obligation_types_designated_for_chk"
  CHECK ("designated_for" = ANY (ARRAY['Both'::character varying, 'Male'::character varying, 'Female'::character varying]));
--> statement-breakpoint
```

`amount >= 0` (not `> 0`): the column defaults to `'0'`, the DTO allows `0`, and the posting engine already skips `amount <= 0`. Rejecting zero is a DTO decision (F1), not a data-layer one — a `> 0` constraint here would fail the migration on any existing zero row and cannot be satisfied by the documented default. Compare `finance_payment_allocations_amount_chk` (`> 0`), which is a different semantic: an *allocation* of zero is meaningless, a *receipt* of zero is merely suspicious.

### 4.5 F15 — OCC token

```sql
ALTER TABLE "obligation_collections"
  ADD COLUMN IF NOT EXISTS "version" integer NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE "obligation_collections"
  ADD CONSTRAINT "obligation_collections_version_chk" CHECK ("version" > 0);
--> statement-breakpoint
```

### 4.6 timestamp → timestamptz

PostgreSQL refuses `ALTER COLUMN … TYPE` on a column an active RLS policy references, so the `obligation_collections` soft-delete policy is dropped and re-created verbatim around the conversion — the same two-step `0229` documents for `hasanat_distributions`. Values are interpreted as UTC because node-postgres serialised them from a JS `Date`; that is the only loss-free reading.

```sql
-- ── 6. timestamp -> timestamptz (F3) ──────────────────────────────────────────
DROP POLICY IF EXISTS "tenant_soft_delete_isolation" ON "obligation_collections";
--> statement-breakpoint

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('obligation_collections',   'created_at'),
      ('obligation_collections',   'updated_at'),
      ('obligation_collections',   'deleted_at'),
      ('obligation_types',         'created_at'),
      ('obligation_types',         'updated_at'),
      ('mujtahids',                'created_at'),
      ('mujtahids',                'updated_at'),
      ('mujtahid_reps',            'created_at'),
      ('mujtahid_reps',            'updated_at'),
      ('wakala_types',             'created_at'),
      ('wakala_types',             'updated_at'),
      ('obligation_distributions', 'created_at'),
      ('obligation_distributions', 'updated_at')
    ) AS v(tbl, col)
  LOOP
    IF EXISTS (
      SELECT 1
        FROM information_schema.columns c
       WHERE c.table_schema = 'public'
         AND c.table_name = r.tbl
         AND c.column_name = r.col
         AND c.data_type = 'timestamp without time zone'
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I ALTER COLUMN %I TYPE timestamptz USING %I AT TIME ZONE ''UTC''',
        r.tbl, r.col, r.col
      );
    END IF;
  END LOOP;
END $$;
--> statement-breakpoint

-- Restore the soft-delete gate verbatim from 0108 (the policy is the only RLS gate on this table).
CREATE POLICY "tenant_soft_delete_isolation" ON "obligation_collections"
  FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR (
      workspace_subdomain = current_setting('app.current_tenant', true)
      AND (
        deleted_at IS NULL
        OR current_setting('app.include_deleted', true) = 'true'
      )
    )
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  );
--> statement-breakpoint
```

`restored_at` is deliberately absent from the list: it is already `timestamptz` (`0108:77`). The `information_schema` guard makes the block re-runnable and safe on a database created after this migration, and the conversion adds no bare `timestamp` literal, so `check:migration-hygiene`'s `bareTimestamps` baseline is unaffected.

### 4.7 Drizzle and code mirrors

**Model.** [obligationCatalogTables.ts](../apps/backend/src/db/schema/obligationCatalogTables.ts) now holds the catalogue half (types, mujtahids, representatives, wakalas, distribution rules) and [obligations.ts](../apps/backend/src/db/schema/obligations.ts) keeps the collections table and re-exports the catalogue — both under the 300-line ceiling after the additions. They carry the six composite `foreignKey()` declarations with explicit `0068` names, the two new RESTRICT references, the six `check()`s, `version`, and the index set described in [§2.4](#24-f9--receipt-numbers-are-neither-server-allocated-nor-unique).

**Contracts.** `moneyNumberAmountSchema` added to [moneySchemas.ts](../packages/shared/src/money/moneySchemas.ts) and applied to both obligation DTOs, which also gain `version: z.number().int().positive().optional()`.

**Persistence.** [obligationCollectionsPersist.ts](../apps/backend/src/db/repositories/obligationCollectionsPersist.ts): `deleted_at`/`deleted_by`/`deletion_reason` removed from the upsert `set` (F14); `setWhere: version = excluded.version` plus a written-row assertion that raises 409 (F15); `restored_at`/`restored_by` stamped on restore (F14); the wipe and replace paths opt into `app.allow_hard_purge` (F16). [obligationCollectionsRepository.ts](../apps/backend/src/db/repositories/obligationCollectionsRepository.ts) projects and maps `version`.

**Ledger lifecycle.** [obligationLedgerSync.ts](../apps/backend/src/obligations/use-cases/obligationLedgerSync.ts) gains `strict` posting plus `archiveCollectionsWithLedger` / `restoreCollectionsWithLedger`, which own the transaction that [obligationsUseCases.ts](../apps/backend/src/obligations/use-cases/obligationsUseCases.ts) wraps around every delete and restore (F13). Save/create keep the tolerant path: a receipt that is already committed must not be rejected because the ledger posting failed.

**Aggregates and posting.** [obligationRepositoryReport.ts](../apps/backend/src/db/repositories/obligationRepositoryReport.ts) and [obligationRepositoryMetrics.ts](../apps/backend/src/db/repositories/obligationRepositoryMetrics.ts) sum in `numeric::text` and convert once with `roundMoneyAmount` (F2); [obligationPostingLogic.ts](../packages/shared/src/finance/obligationPostingLogic.ts) allocates by largest remainder (F18).

**UI.** The collection form rejects a >2-dp amount inline with a new `obligations.form.errors.amountScale` key (en/ar/ur/fa) and parses with `Number` instead of `parseFloat`, so a value the DTO rejects can no longer reach the API as a 400.

**Tests.** `obligationLedgerWiring` (archive/restore failures now roll back), `moneySchemas`, `obligationPostingLogic` (sub-cent split), the parity test's table list (F20), and a new opt-in [obligationsPersistenceDb.integration.test.ts](../apps/backend/src/__tests__/db-integration/obligationsPersistenceDb.integration.test.ts) covering the 409, the no-resurrection rule, restore provenance and the account FK.

Per [mms-schema-migrate](../.agent/skills/mms-schema-migrate/SKILL.md) §2.2 this is a **hand-authored migration exception**: `drizzle-kit generate` cannot be relied on while the snapshot chain trails the journal, so the reason is recorded here and the SQL + journal entry + meta snapshot are committed together.

---

## 5. Out-of-band index file (applied)

`check:migration-indexes.mjs:46-47` lists `obligation_collections` and `obligation_distributions` in `LARGE_TABLES`, so no new plain `CREATE INDEX` may be added to them; `CONCURRENTLY` cannot exist inside Drizzle's single-transaction migration run. The index work therefore lives in:

`apps/backend/scripts/sql/0258_obligations_indexes_concurrent.sql`, executed by the deploy step:

```bash
pnpm --filter mms-backend exec tsx src/scripts/create-index-concurrently.ts \
  --file scripts/sql/0258_obligations_indexes_concurrent.sql
```

It performs four things, in this order:

1. **Drop** `obligation_collections_workspace_deleted_idx` (duplicate of the `_deleted_records_idx` partial) and `_date_idx` (superseded by 0090's `_date_active_idx`).
2. **Create** `obligation_distributions_workspace_wakala_name_uidx` — a distribution name is unique inside its wakala.
3. **Create** `obligation_collections_workspace_receipt_uidx` — the unique partial receipt index; it runs late because it fails on a tenant that already holds duplicates, and a failed `CONCURRENTLY` build leaves an INVALID index that must be dropped before a retry.
4. **Drop** the non-unique `_receipt_idx` it supersedes.

The plain `(workspace_subdomain, sender_id)` index is **kept**: no query lists collections by donor today, but the referential probe behind `obligation_collections_sender_fk` uses it. A `(sender_id, received_date DESC)` statement index is deferred until a per-donor statement query exists.

The unique receipt index must **not** be run before the duplicate pre-flight (or the client-side allocator fix), because it will fail on a tenant that already has duplicates. That pre-flight and the resolution (renumber? merge?) are a data decision, recorded as D3.

---

## 6. Deferred items with target designs

| ID | Item | Target |
| --- | --- | --- |
| **D1** | Decimal-string money end-to-end for `amount` and the report aggregates (F1, F2) | `nonNegativeMoneyDecimalAmountSchema` on the record/insert schemas, `numeric` selected as `::text`, `Money`/`parseMoney` in the mappers, integer-cents formatting in the report UI. Breaking contract change; needs the CSV transfer schema and the frontend form updated in the same change set. |
| **D2** | Duplicate catalogue names (F12) | `UNIQUE (workspace_subdomain, name)` on `obligation_types`, `mujtahids`, `mujtahid_reps` after a merge decision on existing duplicates. |
| **D3** | Server-side receipt allocation (F9) | A workspace counter table modelled on `accounting_voucher_counters` (`0128`), allocated inside the insert transaction; the browser's `computeNextObligationReceiptNo` becomes a preview only. Prerequisite for the unique index on a tenant with duplicates. |
| **D4** | Currency and FX on collections (F21) | `currency` + insert-only `exchange_rate` + `txn_amount` columns, mirroring `financeDocumentFx.ts`; `buildObligationPostingLines` becomes FX-aware and posts the functional amount. Today a foreign-currency receipt posts 1:1 and misstates the ledger. |
| **D6** | ~~One shared wakala-allocation function for the UI and the ledger (F19)~~ | **Done** — `packages/shared/src/finance/obligationSplitAllocation.ts` (+ 7 tests) is consumed by `buildObligationPostingLines` and `obligationsSummaryCalculations`. The remaining half — adding `apps/frontend/src/tenant/features/obligations` to `check:money-safety`'s `SCAN_DIRS` — was closed later as the domain audit's D7 (the eight findings it surfaced are fixed, not allow-listed). |
| **D5** | The installment/balance model the brief described | Not merely missing but **absent by design**: this module records receipts, it does not track a debtor's schedule. A `due_date`/`status`/`paid_amount` model would be a new product capability (pledges with installments and waivers), requiring its own schema, ledger semantics and approvals — not a hardening of this one. |

---

## 7. Verification

**Green on this change set** (run locally, this repository state):

| Command | Result |
| --- | --- |
| `bash .agent/skills/mms-schema-migrate/scripts/check-migrations.sh` | ✅ journal + SQL + RLS coverage + lock-safety ratchet |
| `node scripts/check-migration-indexes.mjs` | ✅ no new write-blocking index (all index DDL is out of band) |
| `node scripts/check-migration-hygiene.mjs --base HEAD` | ✅ lock_timeout 0, bare timestamps 311 (baseline), snapshots 0 |
| `node scripts/check-migrations-forward-only.mjs --base HEAD` | ✅ no applied migration modified |
| `node scripts/check-money-safety.mjs` | ✅ no float money coercions in the finance/accounting roots |
| `node scripts/check-db-projections.mjs` | ✅ 0 wildcard projections |
| `node scripts/check-code-norms.mjs` | ✅ all ratchets held (the schema split keeps both files under 300 lines) |
| `node scripts/check-backend-structure.mjs` / `check-backend-boundaries.mjs` / `check-shared-structure.mjs` | ✅ held |
| `node scripts/check-docs.mjs` | ✅ doc indexed, 0 broken links |
| `pnpm check:i18n` | ✅ 10 001 keys, all four locales complete |
| `pnpm typecheck` | ✅ 6/6 packages |
| `pnpm --filter @mms/shared test` | ✅ 2 376 tests |
| `pnpm --filter mms-backend exec vitest run <13 obligation-adjacent files>` | ✅ 90 tests |
| `pnpm --filter mms-frontend exec vitest run src/tenant/features/obligations` | ✅ 79 tests |

**Originally unverified — later verified against a live database.** This change set was produced
without PostgreSQL, so nothing below ran at the time. A later session ran it, which is recorded here
because it changed the outcome:

1. The migration **applied cleanly** (`0258` and the later `0259`), including the orphan pre-flights
   and the lock-safe constraint adds. The out-of-band index file still has to be run separately:
   `pnpm --filter mms-backend index:concurrent --file scripts/sql/0258_obligations_indexes_concurrent.sql`.
2. `test:db` ran. `financeEnumParityDb` passes with the extended table list, and
   [obligationsPersistenceDb.integration.test.ts](../apps/backend/src/__tests__/db-integration/obligationsPersistenceDb.integration.test.ts)
   **failed at first, for a real reason**: its fixtures seeded a receipt without the sender/mujtahid
   rows that `0258`'s composite FKs now require, so the suite had never proved anything. With the FK
   parents seeded it passes 7/7 (stale-version 409, no-resurrection through the bulk save, restore
   provenance, the account FK).
3. The timestamp→`timestamptz` conversion and the re-created RLS policy are now covered by
   `obligationsTenantIsolation` (run as a `NOBYPASSRLS` role): one policy per table, `FORCE RLS`, and
   no cross-tenant rows for unfiltered reads, explicit-id reads, `UPDATE` or `DELETE`.

```bash
# the gates and suites that were deferred, now all green
bash .agent/skills/mms-schema-migrate/scripts/check-migrations.sh
pnpm --filter mms-backend test:db
pnpm --filter mms-backend test:rls
```
