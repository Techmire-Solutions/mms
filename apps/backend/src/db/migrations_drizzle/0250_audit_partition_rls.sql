-- 0250_audit_partition_rls.sql
-- Forward-only. Closes the row-level-security gap on `audit_trail_events` partitions.
--
-- Why
-- ---
-- 0102 defines `tenant_isolation_policy` on the partitioned parent, and 0116 turned RLS on for
-- it. PostgreSQL does not apply the parent's policy to a child partition when the partition is
-- queried directly, and `auditPartitionService` creates each new month with a bare
-- `CREATE TABLE ... PARTITION OF`. Every monthly partition (and the DEFAULT partition) therefore
-- had RLS disabled: verification/retention code, ad-hoc SQL or a future service reading a
-- partition by name would see every tenant's audit rows.
--
-- This migration applies the same ENABLE/FORCE + policy to every existing child of
-- `audit_trail_events` (DEFAULT included). The provisioner now does the same for future months,
-- so the invariant is: **every audit partition enforces the tenant policy**.
--
-- Idempotent: it enumerates children through `pg_inherits`, so it can be re-run safely.

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

DO $$
DECLARE
  partition_name text;
BEGIN
  FOR partition_name IN
    SELECT child.relname
      FROM pg_inherits
      JOIN pg_class parent ON parent.oid = pg_inherits.inhparent
      JOIN pg_class child ON child.oid = pg_inherits.inhrelid
      JOIN pg_namespace ns ON ns.oid = child.relnamespace
     WHERE parent.relname = 'audit_trail_events'
       AND ns.nspname = current_schema()
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', partition_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', partition_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON %I', partition_name);
    EXECUTE format(
      'CREATE POLICY tenant_isolation_policy ON %I FOR ALL USING ('
      'current_setting(''app.rls_bypass'', true) = ''on'' '
      'OR workspace_subdomain = current_setting(''app.current_tenant'', true))',
      partition_name
    );
  END LOOP;
END
$$;
