# Timezone-naive timestamp migration

The schema still carries `timestamp without time zone` columns while Drizzle
declares `withTimezone: true` for them. PostgreSQL and node-postgres interpret a
naive value in the **session timezone**, so an instant can shift silently if the
database/server timezone changes. This document is the inventory + migration
playbook; the conversion itself is deliberately per-table and is not automated
here.

## Current inventory

Run the read-only audit against the target database:

```bash
pnpm --filter mms-backend audit:timestamps
pnpm --filter mms-backend audit:timestamps -- --json
```

It reports:

- the database session `TimeZone` (the input that decides whether
  `AT TIME ZONE` is even meaningful);
- every live naive timestamp column, its table, `nullable`, `tenant`/`global`
  scope, and the `pg_class.reltuples` estimate (`unknown` on a never-analyzed DB);
- totals and the largest tables first.

Two different numbers matter:

| Measure | Value | Meaning |
| --- | --- | --- |
| `check:migration-hygiene` | **311** | bare `timestamp` declarations across the whole migration history, including columns later dropped/renamed |
| `audit:timestamps` | **144** live columns across **86** tables (127 tenant, 17 global) on a freshly migrated DB | what actually exists now |

Always trust the audit for the live schema; re-run it on production because data
volume and `ANALYZE` state affect the estimates.

## Before converting: verify the timezone

Do not assume UTC. A naive value may have been written under the DB session
timezone, the Node process timezone, or a client-supplied local time.

1. Record `SHOW TimeZone;` on the production connection and compare it with the
   application host's `TZ`.
2. Find a row that has both a naive timestamp and a timestamptz twin written by
   the same logical event (audit/event tables are the best candidates). Compute
   the difference; if the naive value equals the timestamptz value rendered in
   UTC, the write-time session was UTC.
3. If the evidence disagrees, stop and classify the table's semantics before
   writing any backfill. A wrong `AT TIME ZONE` silently changes every instant.

## Expand/contract recipe (per table)

Use this for any table that is large, hot, or cannot take a long
`ACCESS EXCLUSIVE` lock. Small, append-only tables can use the same steps without
the batching.

1. **Expand:** add a nullable `timestamptz` shadow column with a short
   transaction:
   ```sql
   SET LOCAL lock_timeout = '2s';
   ALTER TABLE "students" ADD COLUMN "created_at_tz" timestamptz;
   ```
2. **Dual-write:** until the swap, keep the shadow in sync. Prefer a temporary
   `BEFORE INSERT OR UPDATE` trigger (`NEW.created_at_tz := NEW.created_at AT TIME ZONE '<verified tz>'`)
   over a code dual-write so no release window can miss a row.
3. **Backfill in batches** by primary key, with `statement_timeout` and progress:
   ```sql
   UPDATE "students"
      SET "created_at_tz" = "created_at" AT TIME ZONE '<verified tz>'
    WHERE "created_at" IS NOT NULL AND "created_at_tz" IS NULL
      AND "id" > $lastId
    ORDER BY "id"
    LIMIT 5000;
   ```
   Commit between batches; never one unbounded `UPDATE`.
4. **Verify:** counts of non-null source vs shadow, plus a deterministic checksum
   (`count(*)`, `min`/`max` of both columns converted back) before any swap.
5. **Swap:** in one short transaction, drop the trigger, drop the old column,
   rename the shadow into the original name. Update Drizzle schema only if it
   still says `withTimezone: false` (most already say `true`).
6. **Snapshot:** generate the migration snapshot in the dedicated snapshot pass,
   not ad hoc; the historical 0134–0196 gap is tracked in `open-items.md`.

Rollback before the swap is additive: drop the trigger/shadow column. After the
swap, restore from backup or reverse the rename; keep the old column until the
verification window closes if the table size permits.

## Ordering

1. Append-only, low-write tables (event/log tables) first.
2. Medium tenant tables with an index on the primary key.
3. The two largest/hottest tables last, in a maintenance window, with the
   expand/contract path above.

`check:migration-hygiene` already fails any new naive timestamp declaration, so
the inventory can only shrink while the migration is in progress.

## What this does not do

- It does not alter schema or data; `audit:timestamps` is read-only.
- It does not choose the write-time timezone; that requires the evidence above.
- It does not cover the historical Drizzle snapshot gap or the i18n debt.
