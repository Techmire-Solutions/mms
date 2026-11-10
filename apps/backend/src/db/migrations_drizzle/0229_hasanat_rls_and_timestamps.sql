-- 0229_hasanat_rls_and_timestamps.sql
-- Forward-only. Removes the legacy RLS policy that defeated the soft-delete gate, aligns the
-- hasanat timestamp columns with the Drizzle declaration, and restores the DB-owned `updated_at`.
--
-- Why
-- ---
--   1. 0047 created `hasanat_<table>_tenant_isolation`; 0076/0108 created and dropped only
--      `tenant_isolation_policy` / `tenant_soft_delete_isolation`. Permissive policies are OR-ed,
--      so the surviving legacy policy let any same-tenant query read trashed rows regardless of
--      `app.include_deleted` — the trash separation existed in name only.
--   2. 0000/0047 created every hasanat timestamp as `timestamp` (without time zone) and 0108's
--      `ADD COLUMN IF NOT EXISTS … TIMESTAMP WITH TIME ZONE` was a no-op because the column already
--      existed. Drizzle reads those columns as `timestamptz`, so values were reinterpreted through
--      the session time zone.
--   3. `updated_at` was application-only on these tables while the Work list sorts by it.

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

-- 1. One policy per table -------------------------------------------------------
DROP POLICY IF EXISTS "hasanat_distributions_tenant_isolation" ON "hasanat_distributions";
DROP POLICY IF EXISTS "hasanat_denoms_tenant_isolation" ON "hasanat_denoms";
DROP POLICY IF EXISTS "hasanat_batches_tenant_isolation" ON "hasanat_batches";
DROP POLICY IF EXISTS "hasanat_redemptions_tenant_isolation" ON "hasanat_redemptions";
--> statement-breakpoint

-- 2. timestamp -> timestamptz ---------------------------------------------------
-- The values were written by node-postgres from JS `Date` (UTC), so interpreting them as UTC is
-- the only loss-free reading. Columns already `timestamptz` are skipped, which makes this
-- re-runnable and safe on databases created after this migration.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('hasanat_denoms', 'created_at'),
      ('hasanat_denoms', 'updated_at'),
      ('hasanat_batches', 'created_at'),
      ('hasanat_batches', 'updated_at'),
      ('hasanat_distributions', 'created_at'),
      ('hasanat_distributions', 'updated_at'),
      ('hasanat_distributions', 'deleted_at'),
      ('hasanat_distributions', 'restored_at'),
      ('hasanat_redemptions', 'created_at'),
      ('hasanat_redemptions', 'updated_at'),
      ('hasanat_field_configs', 'updated_at'),
      ('hasanat_module_preferences', 'updated_at')
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

-- 3. DB-owned updated_at --------------------------------------------------------
DROP TRIGGER IF EXISTS update_hasanat_denoms_updated_at ON "hasanat_denoms";
CREATE TRIGGER update_hasanat_denoms_updated_at
BEFORE UPDATE ON "hasanat_denoms"
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
--> statement-breakpoint
DROP TRIGGER IF EXISTS update_hasanat_batches_updated_at ON "hasanat_batches";
CREATE TRIGGER update_hasanat_batches_updated_at
BEFORE UPDATE ON "hasanat_batches"
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
--> statement-breakpoint
DROP TRIGGER IF EXISTS update_hasanat_distributions_updated_at ON "hasanat_distributions";
CREATE TRIGGER update_hasanat_distributions_updated_at
BEFORE UPDATE ON "hasanat_distributions"
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
--> statement-breakpoint

-- `hasanat_redemptions` is append-only: no updated_at trigger, so a ledger row's timestamp cannot
-- be silently advanced by an unrelated write.
