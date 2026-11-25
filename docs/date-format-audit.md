# Date Format Audit

Calendar dates in this codebase are stored as **strings** in `varchar` columns
(`attendance.date`, `sessions.start_date` / `end_date`, accounting date and
period fields, …). That is a deliberate and defensible choice: storing
`YYYY-MM-DD` as text sidesteps timezone shifting entirely, which is the most
common date bug in a multi-timezone app.

The trade-off is that the database enforces nothing. Validation has to happen in
the schemas — and it did not do so consistently.

## What changed

Validation used to be a **shape-only** regex, re-written by hand in **21 places
across 8 modules**:

```ts
z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
```

That accepts dates which do not exist:

| Value | Accepted before | Why it matters |
|---|---|---|
| `2026-13-01` | ✅ | month 13 |
| `2026-02-31` | ✅ | February 31st |
| `2026-00-10` | ✅ | month 0 |
| `0000-00-00` | ✅ | no such date |
| `2025-02-29` | ✅ | not a leap year |

For **accounting** this is not cosmetic: a journal-entry or fiscal-period date
feeds date arithmetic, period comparison, and aging reports.

All 21 call sites now use `isoDateSchema` from `packages/contracts`, which checks
both the shape **and** that the date is real (verified by round-tripping through
`Date.UTC`, so the result cannot depend on the host timezone). Duplicate
implementations are gone, so the modules cannot drift apart again — which is
exactly how `sessions` ended up weaker than `accounting`.

## Measuring before you rely on it

`isoDateSchema` is stricter than what came before, so any stored value that only
passed the shape check will now be **rejected**. On a write path that surfaces as
a validation error; on a **read path it makes an existing record unreadable** —
which is the failure that actually hurts.

Find out whether you have any such rows:

```bash
pnpm --filter mms-backend audit:dates
```

The script discovers date-like `varchar` columns from `information_schema`
(so a newly added column is covered automatically, with no list to maintain) and
reports, per column, how many values are non-empty, wrong-shape, or
impossible-but-correctly-shaped. It exits non-zero when it finds any, and prints
sample values.

Shape is tested in SQL; calendar validity is tested in TypeScript using the very
predicate the schemas use. That split is deliberate — casting `'2026-02-31'` to
`date` in Postgres **raises an error** rather than returning the row, so
validating in SQL would abort the audit instead of reporting the offender.

### If it reports findings

Reconcile the rows **before** relying on the tightened validation, and note that
the risk is asymmetric: a bad value on a read path is worse than one on a write
path.

## Known gap: session dates are still shape-unvalidated

`SessionSchema` / `SessionInsertSchema` and `SessionClassSchedule*` in
`packages/contracts/src/sessionTypes.ts` validate `startDate` / `endDate` only as:

```ts
startDate: z.string().min(1, 'Start date is required')
```

No format enforcement at all — weaker than the shape-only regex the other modules
had. Meanwhile the columns are `varchar(30)` with no `CHECK` constraint, so an
arbitrary string can be persisted.

**Why this was not tightened in the same pass.** `sessionRecordSchema` is
`SessionSchema`, and it validates **reads as well as writes**
(`createGenericRelationalService` is constructed with it). Tightening it would
make any existing session with a non-ISO date uneditable *and* unreadable —
turning a silent data-quality issue into an outage. It needs the audit result
first.

**Symptoms to look for while it is unvalidated:**

- `SessionForm.tsx` compares `endDate < startDate` as a **string**. Correct for
  zero-padded ISO; wrong for anything else (`'15/01/2026' < '2026-01-15'`).
- `sessions_workspace_start_date_idx` orders lexicographically, so date-range
  filters and "latest session" ordering are wrong for non-ISO values.
- `formatSessionDate` / `formatDate` may misparse.

**Safe rollout when the audit is clean:**

1. Run `audit:dates` and confirm `sessions` columns are clean.
2. Split the read and write schemas if they are still shared, so write-side
   tightening cannot break reads.
3. Apply `isoDateSchema` (or `isoDateOrEmptySchema` where `''` means "no date")
   to the **insert/update** schemas first, and let a release pass.
4. Only then tighten the record/read schema.
5. Consider a DB `CHECK` constraint as the durable backstop — the app can be
   bypassed, a constraint cannot:

   ```sql
   ALTER TABLE sessions
     ADD CONSTRAINT sessions_start_date_iso
     CHECK (start_date = '' OR start_date ~ '^\d{4}-\d{2}-\d{2}$');
   ```

   Add it `NOT VALID` first if legacy rows might fail, then `VALIDATE CONSTRAINT`
   once reconciled.
