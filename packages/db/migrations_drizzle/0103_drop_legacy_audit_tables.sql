-- MMS Forward Migration: 0103_drop_legacy_audit_tables
-- Removes superseded unpartitioned legacy audit tables in favor of modern partitioned audit_trail_events.

DROP TABLE IF EXISTS "audit_logs" CASCADE;
DROP TABLE IF EXISTS "audit_log_entries" CASCADE;
