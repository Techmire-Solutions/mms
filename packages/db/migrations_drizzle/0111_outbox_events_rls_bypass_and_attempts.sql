-- Migration 0111: outbox_events RLS bypass + retry accounting
-- Forward-only DDL — no drizzle-kit push against production.
--
-- 1. The 0109 policy only allowed `workspace_subdomain = app.current_tenant`.
--    The CDC worker runs on the root pool with no request tenant, so every row
--    was hidden and CDC never processed anything on a non-superuser role. Add
--    the same `app.rls_bypass` escape hatch every other tenant table has.
-- 2. Add an `attempts` counter so a permanently failing (poison) event can be
--    skipped instead of head-of-line blocking newer events forever.

BEGIN;

DROP POLICY IF EXISTS outbox_events_tenant_isolation ON outbox_events;

CREATE POLICY outbox_events_tenant_isolation ON outbox_events
  FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  );

ALTER TABLE outbox_events
  ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0;

ALTER TABLE outbox_events
  ADD COLUMN IF NOT EXISTS last_error TEXT;

COMMIT;
