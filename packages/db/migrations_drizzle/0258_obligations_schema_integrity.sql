-- MMS Forward-only Migration: 0258_obligations_schema_integrity.sql
-- Closes the obligations schema findings F3, F6, F8, F10, F11 and F15 of
-- docs/obligations-schema-persistence-audit-2026-11-14.md.
--
-- Every constraint below is added NOT VALID / VALIDATE so the ADD never takes a full-table lock.
-- Each is preceded by a pre-flight that names the offending count, because a bare constraint
-- violation on a live tenant is unactionable. Index work is deliberately absent: both
-- `obligation_collections` and `obligation_distributions` are in check:migration-indexes'
-- LARGE_TABLES, so their indexes are built by
-- apps/backend/scripts/sql/0258_obligations_indexes_concurrent.sql instead.
--
-- Hand-authored exception (mms-schema-migrate §2.2): `drizzle-kit generate` cannot be trusted
-- while the snapshot chain trails the journal, so this file is reviewed by hand and committed
-- together with its journal entry and meta snapshot.

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

-- ── 1. Pre-flights ────────────────────────────────────────────────────────────────────────────
-- A receipt whose donor no longer exists cannot be constrained, and it cannot be silently
-- repaired either: `sender_id` is NOT NULL, so somebody has to decide whether to re-point the
-- receipt at the right contact or purge it. The remediation query is:
--
--   SELECT c.id, c.receipt_no, c.sender_id, c.amount
--     FROM obligation_collections c
--    WHERE NOT EXISTS (SELECT 1 FROM contacts k
--                       WHERE k.workspace_subdomain = c.workspace_subdomain AND k.id = c.sender_id);
DO $$
DECLARE orphans bigint;
BEGIN
  SELECT count(*) INTO orphans
    FROM obligation_collections c
   WHERE NOT EXISTS (
     SELECT 1 FROM contacts k
      WHERE k.workspace_subdomain = c.workspace_subdomain AND k.id = c.sender_id);

  IF orphans > 0 THEN
    RAISE EXCEPTION '0258 aborted: % obligation_collections rows reference a missing contact (sender_id) — see the remediation query above', orphans;
  END IF;
END $$;
--> statement-breakpoint

-- A distribution pointing at a deleted chart account is repairable (re-map or clear the mapping),
-- so it is reported rather than fatal: the FK below is `RESTRICT` on the account row, and an
-- archived account still satisfies it. Only a *missing* row blocks the constraint.
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
    RAISE EXCEPTION '0258 aborted: % obligation_distributions rows reference a missing accounting account — re-map or clear account_id first', orphans;
  END IF;
END $$;
--> statement-breakpoint

-- `designated_for` is a free varchar(20) that the shared DTO constrains to four values; the
-- pre-3NF document store may hold anything. Normalise the strays so the CHECK can be added, and
-- report how many were changed instead of rewriting them silently.
DO $$
DECLARE strays bigint;
BEGIN
  SELECT count(*) INTO strays
    FROM obligation_types
   WHERE designated_for NOT IN ('Syed', 'Non-Syed', 'Both', 'None');

  IF strays > 0 THEN
    UPDATE obligation_types
       SET designated_for = 'Both'
     WHERE designated_for NOT IN ('Syed', 'Non-Syed', 'Both', 'None');
    RAISE NOTICE '0258: normalised % obligation_types.designated_for value(s) to ''Both''', strays;
  END IF;
END $$;
--> statement-breakpoint

-- ── 2. F6 — the donor link ───────────────────────────────────────────────────────────────────
-- `sender_id` is a contact id (the form binds a ContactPicker) but carried no reference, so a
-- purged contact left receipts pointing at nothing. RESTRICT is honest: `contacts` already
-- forbids hard delete (0104), so this only ever fires on the deliberate purge path.
ALTER TABLE "obligation_collections"
  ADD CONSTRAINT "obligation_collections_sender_fk"
  FOREIGN KEY ("workspace_subdomain", "sender_id")
  REFERENCES "contacts"("workspace_subdomain", "id") ON DELETE RESTRICT NOT VALID;
--> statement-breakpoint
ALTER TABLE "obligation_collections" VALIDATE CONSTRAINT "obligation_collections_sender_fk";
--> statement-breakpoint

-- ── 3. F8 — the distribution's posting account ───────────────────────────────────────────────
-- Without the reference a stale id was only discovered at posting time, where it makes the whole
-- receipt unpostable (`buildObligationPostingLines` returns null) and the save still reported
-- success.
ALTER TABLE "obligation_distributions"
  ADD CONSTRAINT "obligation_distributions_account_fk"
  FOREIGN KEY ("workspace_subdomain", "account_id")
  REFERENCES "accounting_accounts"("workspace_subdomain", "id") ON DELETE RESTRICT NOT VALID;
--> statement-breakpoint
ALTER TABLE "obligation_distributions" VALIDATE CONSTRAINT "obligation_distributions_account_fk";
--> statement-breakpoint

-- ── 4. F10 / F11 — domain CHECKs ─────────────────────────────────────────────────────────────
-- `amount >= 0` (not `> 0`): the column defaults to '0', the DTO allows 0, and the posting engine
-- already skips `amount <= 0`. Rejecting zero is a DTO decision, not a data-layer one.
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
  CHECK ("designated_for" = ANY (ARRAY['Syed'::character varying, 'Non-Syed'::character varying, 'Both'::character varying, 'None'::character varying]));
--> statement-breakpoint

-- ── 5. F15 — optimistic concurrency token ────────────────────────────────────────────────────
-- Without it two editors both read the same amount and the second silently overwrote the first,
-- while each posted a ledger revision computed from its own stale `previous` row.
ALTER TABLE "obligation_collections"
  ADD COLUMN IF NOT EXISTS "version" integer NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE "obligation_collections"
  ADD CONSTRAINT "obligation_collections_version_chk" CHECK ("version" > 0);
--> statement-breakpoint

-- ── 6. F3 — timestamp -> timestamptz ────────────────────────────────────────────────────────
-- 0000/0052 created every obligation timestamp as a naive `timestamp`, and 0108's
-- `ADD COLUMN IF NOT EXISTS … TIMESTAMP WITH TIME ZONE` was a no-op because the column already
-- existed. Drizzle and every snapshot declare `timestamptz`, so values were reinterpreted through
-- the session time zone.
--
-- PostgreSQL refuses ALTER COLUMN TYPE on a column an active RLS policy references, so the
-- soft-delete gate is dropped and re-created verbatim around the conversion (0229 precedent).
-- The values were written by node-postgres from a JS `Date`, so reading them as UTC is the only
-- loss-free interpretation. Columns already `timestamptz` are skipped, which makes this
-- re-runnable and safe on a database created after this migration.
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

-- Restore the soft-delete gate exactly as 0108 created it (it is the only RLS policy on the
-- table, so a failed re-create would expose trashed rows).
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
