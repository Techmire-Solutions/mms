-- 0235_audit_trail_immutability.sql
-- Forward-only. Makes `audit_trail_events` append-only at the database, not just in the service.
--
-- Why
-- ---
-- The hash chain proves tampering *after the fact*, but the application role could still UPDATE or
-- DELETE an audit row directly (the chain would then simply be broken and nobody would know which
-- request did it). `mms-audit-trail` §5.2 requires the database to reject mutation outright.
--
-- Escape hatch
-- ------------
-- Retention/right-to-erasure jobs that legitimately need to remove audit rows set
-- `app.allow_audit_purge = 'on'` or `app.allow_hard_purge = 'true'` on their own transaction
-- (used by the soft-delete hard-purge and test isolation paths). Partition drops are DDL and never
-- reach this trigger.

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

CREATE OR REPLACE FUNCTION "audit_trail_events_forbid_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('app.allow_audit_purge', true) IN ('on', 'true', '1')
     OR current_setting('app.allow_hard_purge', true) IN ('on', 'true', '1') THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'audit_trail_events is append-only (% is rejected)', TG_OP
    USING ERRCODE = 'check_violation';
END;
$$;
--> statement-breakpoint

DROP TRIGGER IF EXISTS "trg_audit_trail_immutable" ON "audit_trail_events";
--> statement-breakpoint

-- Declarative partitioning propagates this trigger to every existing and future audit partition.
CREATE TRIGGER "trg_audit_trail_immutable"
  BEFORE UPDATE OR DELETE ON "audit_trail_events"
  FOR EACH ROW
  EXECUTE FUNCTION "audit_trail_events_forbid_mutation"();
