-- MMS Soft-Delete Reference: Triggers, Indexes, and RLS Policies
-- See docs/soft-delete.md for architectural specifications.

-- 1. Hard-Delete Prevention Trigger Function
CREATE OR REPLACE FUNCTION forbid_hard_delete() RETURNS TRIGGER AS $$
BEGIN
  IF current_setting('app.allow_hard_purge', true) = 'true' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Hard delete forbidden on table "%", use soft-delete (UPDATE ... SET deleted_at = NOW())', TG_TABLE_NAME
    USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;

-- 2. Trigger Attachment Template
-- CREATE TRIGGER trg_{table}_forbid_hard_delete
--   BEFORE DELETE ON {table}
--   FOR EACH ROW EXECUTE FUNCTION forbid_hard_delete();

-- 3. Row-Level Security Defense-in-Depth Policy
-- ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE {table} FORCE ROW LEVEL SECURITY;
-- CREATE POLICY tenant_soft_delete_isolation ON {table} FOR ALL
--   USING (
--     workspace_subdomain = current_setting('app.current_tenant', true)
--     AND (deleted_at IS NULL OR current_setting('app.include_deleted', true) = 'true')
--   );

-- 4. High-Churn Autovacuum Tuning
-- ALTER TABLE message_logs SET (autovacuum_vacuum_scale_factor = 0.05, autovacuum_vacuum_cost_limit = 1000);
