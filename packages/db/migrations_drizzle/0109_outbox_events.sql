-- Migration 0109: Transactional Outbox Events Table
-- Forward-only DDL — no drizzle-kit push against production.
--
-- Provides an append-only outbox for CDC events (entity.soft_deleted,
-- entity.restored, entity.hard_purge) emitted atomically within the same
-- tenant transaction as the triggering DML.  Downstream workers poll
-- processed_at IS NULL to drive Meilisearch tombstones and Redis eviction.

BEGIN;

CREATE TABLE IF NOT EXISTS outbox_events (
  id                BIGINT         GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  workspace_subdomain TEXT         NOT NULL REFERENCES workspaces(subdomain) ON DELETE CASCADE,
  event_type        VARCHAR(64)    NOT NULL,
  entity_type       VARCHAR(64)    NOT NULL,
  entity_id         VARCHAR(128)   NOT NULL,
  -- RFC 8785-serialised JSON payload (version, snapshot, actor, timestamps)
  payload           JSONB          NOT NULL,
  processed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ    NOT NULL DEFAULT clock_timestamp()
);

-- Enforce tenant isolation at DB layer
ALTER TABLE outbox_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox_events FORCE ROW LEVEL SECURITY;

CREATE POLICY outbox_events_tenant_isolation ON outbox_events
  FOR ALL
  USING (workspace_subdomain = current_setting('app.current_tenant', true));

-- Hot path: worker polls for unprocessed rows per tenant
CREATE INDEX IF NOT EXISTS outbox_events_ws_unprocessed_idx
  ON outbox_events (workspace_subdomain, created_at)
  WHERE processed_at IS NULL;

-- General tenant + event type ordering
CREATE INDEX IF NOT EXISTS outbox_events_ws_type_created_idx
  ON outbox_events (workspace_subdomain, event_type, created_at DESC);

-- Entity-scoped debug / replay lookups
CREATE INDEX IF NOT EXISTS outbox_events_ws_entity_idx
  ON outbox_events (workspace_subdomain, entity_type, entity_id);

COMMIT;
