-- MMS Audit Trail Partitioning & Immutability Architecture

-- 1. Base Range-Partitioned Audit Events Table
CREATE TABLE IF NOT EXISTS audit_trail_events (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  workspace_subdomain VARCHAR(63) NOT NULL,
  table_name VARCHAR(63) NOT NULL,
  record_id VARCHAR(128) NOT NULL,
  action_type VARCHAR(32) NOT NULL,
  old_state JSONB,
  new_state JSONB,
  real_user_id VARCHAR(128) NOT NULL,
  impersonated_user_id VARCHAR(128),
  ip_address VARCHAR(45),
  client_app VARCHAR(64),
  session_id VARCHAR(128),
  correlation_id VARCHAR(128),
  hash_previous VARCHAR(64) NOT NULL,
  hash_current VARCHAR(64) NOT NULL,
  transaction_timestamp TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (id, transaction_timestamp)
) PARTITION BY RANGE (transaction_timestamp);

-- 2. Monthly Partition Example (e.g. 2026-09)
CREATE TABLE IF NOT EXISTS audit_trail_events_y2026m09 PARTITION OF audit_trail_events
  FOR VALUES FROM ('2026-09-01 00:00:00+00') TO ('2026-10-01 00:00:00+00');

-- 3. Append-Only Immutability Guard
CREATE OR REPLACE FUNCTION forbid_audit_mutation() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit trail events are immutable. UPDATE and DELETE are prohibited.'
    USING ERRCODE = 'check_violation';
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_trail_immutable
  BEFORE UPDATE OR DELETE ON audit_trail_events
  FOR EACH ROW EXECUTE FUNCTION forbid_audit_mutation();

-- 4. Merkle Roots Rollup Table
CREATE TABLE IF NOT EXISTS audit_merkle_roots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  leaf_count INT NOT NULL,
  merkle_root VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
