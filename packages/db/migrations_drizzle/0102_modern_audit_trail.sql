-- Modern Database Audit Trail: 5-dimension architecture with monthly range partitioning and privilege hardening

CREATE TABLE IF NOT EXISTS "audit_trail_events" (
  "id" bigint GENERATED ALWAYS AS IDENTITY,
  "workspace_subdomain" varchar(64) NOT NULL,
  "table_name" varchar(64) NOT NULL,
  "record_id" varchar(128) NOT NULL,
  "action_type" varchar(32) NOT NULL,
  "real_user_id" varchar(64) NOT NULL,
  "impersonated_user_id" varchar(64),
  "ip_address" varchar(45),
  "client_app" varchar(64),
  "session_id" varchar(128),
  "correlation_id" varchar(128) NOT NULL,
  "api_endpoint" varchar(255),
  "http_method" varchar(16),
  "old_state" text,
  "new_state" text,
  "hash_previous" varchar(64) NOT NULL,
  "hash_current" varchar(64) NOT NULL,
  "verification_status" varchar(32) NOT NULL DEFAULT 'VERIFIED',
  "transaction_timestamp" timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY ("workspace_subdomain", "transaction_timestamp", "id")
) PARTITION BY RANGE ("transaction_timestamp");

-- Monthly partitions for Q3/Q4 2026
CREATE TABLE IF NOT EXISTS "audit_trail_events_y2026m09" PARTITION OF "audit_trail_events"
  FOR VALUES FROM ('2026-09-01 00:00:00+00') TO ('2026-10-01 00:00:00+00');

CREATE TABLE IF NOT EXISTS "audit_trail_events_y2026m10" PARTITION OF "audit_trail_events"
  FOR VALUES FROM ('2026-10-01 00:00:00+00') TO ('2026-11-01 00:00:00+00');

CREATE TABLE IF NOT EXISTS "audit_trail_events_default" PARTITION OF "audit_trail_events" DEFAULT;

-- Partitioned table indexes
CREATE INDEX IF NOT EXISTS "audit_trail_events_ws_ts_desc_idx" ON "audit_trail_events" ("workspace_subdomain", "transaction_timestamp" DESC);
CREATE INDEX IF NOT EXISTS "audit_trail_events_ws_table_rec_idx" ON "audit_trail_events" ("workspace_subdomain", "table_name", "record_id");
CREATE INDEX IF NOT EXISTS "audit_trail_events_ws_action_idx" ON "audit_trail_events" ("workspace_subdomain", "action_type");
CREATE INDEX IF NOT EXISTS "audit_trail_events_ws_corr_idx" ON "audit_trail_events" ("workspace_subdomain", "correlation_id");
CREATE INDEX IF NOT EXISTS "audit_trail_events_ws_user_idx" ON "audit_trail_events" ("workspace_subdomain", "real_user_id");

-- Automated verification runs table
CREATE TABLE IF NOT EXISTS "audit_verification_runs" (
  "id" varchar(64) PRIMARY KEY,
  "workspace_subdomain" varchar(64),
  "verified_at" timestamptz NOT NULL DEFAULT clock_timestamp(),
  "records_checked" integer NOT NULL,
  "status" varchar(32) NOT NULL,
  "discrepancies" jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS "audit_verification_runs_ws_time_idx" ON "audit_verification_runs" ("workspace_subdomain", "verified_at" DESC);

-- Merkle root rollups for certificate-transparency scaling
CREATE TABLE IF NOT EXISTS "audit_merkle_roots" (
  "id" varchar(64) PRIMARY KEY,
  "root_hash" varchar(64) NOT NULL,
  "period_start" timestamptz NOT NULL,
  "period_end" timestamptz NOT NULL,
  "shard_count" integer NOT NULL,
  "published_at" timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS "audit_merkle_roots_published_desc_idx" ON "audit_merkle_roots" ("published_at" DESC);

-- Crypto-shredding keys table
CREATE TABLE IF NOT EXISTS "crypto_shredding_keys" (
  "id" varchar(64) PRIMARY KEY,
  "subject_id" varchar(128) NOT NULL,
  "encrypted_key" text NOT NULL,
  "algorithm" varchar(32) NOT NULL DEFAULT 'AES-256-GCM',
  "status" varchar(16) NOT NULL DEFAULT 'ACTIVE',
  "created_at" timestamptz NOT NULL DEFAULT clock_timestamp(),
  "destroyed_at" timestamptz
);

CREATE INDEX IF NOT EXISTS "crypto_shredding_keys_subject_status_idx" ON "crypto_shredding_keys" ("subject_id", "status");

-- Erasure requests log
CREATE TABLE IF NOT EXISTS "audit_erasure_requests" (
  "id" varchar(64) PRIMARY KEY,
  "subject_id" varchar(128) NOT NULL,
  "regime" varchar(32) NOT NULL,
  "erasure_type" varchar(32) NOT NULL,
  "requested_by" varchar(64) NOT NULL,
  "requested_at" timestamptz NOT NULL DEFAULT clock_timestamp(),
  "completed_at" timestamptz,
  "redaction_marker" varchar(64) NOT NULL DEFAULT '[REDACTED_PER_REQUEST]'
);

CREATE INDEX IF NOT EXISTS "audit_erasure_requests_subject_time_idx" ON "audit_erasure_requests" ("subject_id", "requested_at" DESC);

-- Strict privilege hardening for application database user (if role exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'mms_app_user') THEN
    REVOKE UPDATE, DELETE, TRUNCATE ON audit_trail_events FROM PUBLIC, mms_app_user;
    REVOKE UPDATE, DELETE, TRUNCATE ON audit_verification_runs FROM PUBLIC, mms_app_user;
    REVOKE UPDATE, DELETE, TRUNCATE ON audit_merkle_roots FROM PUBLIC, mms_app_user;

    GRANT INSERT, SELECT ON audit_trail_events TO mms_app_user;
    GRANT INSERT, SELECT ON audit_verification_runs TO mms_app_user;
    GRANT INSERT, SELECT ON audit_merkle_roots TO mms_app_user;
    GRANT ALL ON crypto_shredding_keys TO mms_app_user;
    GRANT ALL ON audit_erasure_requests TO mms_app_user;
  END IF;
END $$;
