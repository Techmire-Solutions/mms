-- Migration: 0107_autovacuum_high_churn_tables
-- Purpose:
--   1. Add purge_after generated column to message_logs (365-day retention per manifest §13.4).
--   2. Add partial index on purge_after for lock-free purge worker query planner efficiency (§13.2).
--   3. Tune autovacuum on high-churn soft-delete tables to prevent dead-tuple bloat (§2.10).

BEGIN;

-- ── message_logs: purge_after generated column ─────────────────────────────
-- Generated column: purge_after = deleted_at + 365 days (message_logs retentionDays = 365)
ALTER TABLE message_logs
  ADD COLUMN IF NOT EXISTS purge_after timestamptz
    GENERATED ALWAYS AS (deleted_at + INTERVAL '365 days') STORED;

-- Category C+ index for lock-free purge worker candidate selection
-- Planner uses this for: WHERE deleted_at IS NOT NULL AND purge_after <= NOW()
CREATE INDEX IF NOT EXISTS message_logs_purge_after_idx
  ON message_logs (workspace_subdomain, purge_after)
  WHERE deleted_at IS NOT NULL AND purge_after IS NOT NULL;

-- ── attendance: purge_after generated column ────────────────────────────────
-- attendance_records retentionDays is null (keep indefinitely) per §13.4,
-- but we add the column so the purge worker's generic interface compiles cleanly
-- and to support future configurable retention without schema change.
ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS purge_after timestamptz
    GENERATED ALWAYS AS (deleted_at + INTERVAL '3650 days') STORED;

CREATE INDEX IF NOT EXISTS attendance_purge_after_idx
  ON attendance (workspace_subdomain, purge_after)
  WHERE deleted_at IS NOT NULL AND purge_after IS NOT NULL;

-- ── Autovacuum tuning for high-churn soft-delete tables (§2.10) ─────────────
-- message_logs: frequent soft-delete + TTL sweeper writes → aggressive vacuum
ALTER TABLE message_logs SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_vacuum_cost_limit   = 1000
);

-- attendance: frequent per-class soft-delete operations → aggressive vacuum
ALTER TABLE attendance SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_vacuum_cost_limit   = 1000
);

COMMIT;
