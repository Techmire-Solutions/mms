-- Migration 0200: persist relationship email/gender, serve the metrics primary-phone
-- lateral from one index (no per-row Sort), and restore the contacts soft-delete RLS
-- invariant.
--
-- 1) `contact_relationships` carries email/gender in the shared type, CSV import/export
--    and guardian derivation, but had no columns — every import silently dropped them.
-- 2) The metrics aggregate picks the primary phone per contact; without an index whose
--    leading columns match (workspace, contact, is_primary DESC, sort_order) PostgreSQL
--    sorts once per row inside the lateral.
-- 3) `contacts_tenant_isolation` (0056) is a permissive policy that ORs with the
--    soft-delete policy added in 0108, making its `deleted_at` clause inert. Split them:
--    a permissive tenant policy plus a RESTRICTIVE soft-delete policy. Reads of trashed
--    rows must set `app.include_deleted` (see contactRepositoryFind/List and restore).

SET LOCAL lock_timeout = '2s';

ALTER TABLE "contact_relationships" ADD COLUMN IF NOT EXISTS "email" varchar(255);
ALTER TABLE "contact_relationships" ADD COLUMN IF NOT EXISTS "gender" varchar(20);

CREATE INDEX IF NOT EXISTS "contact_phones_workspace_contact_priority_idx"
  ON "contact_phones" USING btree (
    "workspace_subdomain",
    "contact_id",
    "is_primary" DESC NULLS LAST,
    "sort_order"
  );

DROP POLICY IF EXISTS "contacts_tenant_isolation" ON "contacts";
DROP POLICY IF EXISTS "tenant_soft_delete_isolation" ON "contacts";

CREATE POLICY "contacts_tenant_isolation" ON "contacts"
  AS PERMISSIVE FOR ALL
  USING ("workspace_subdomain" = current_setting('app.current_tenant'::text, true));

CREATE POLICY "tenant_soft_delete_isolation" ON "contacts"
  AS RESTRICTIVE FOR ALL
  USING (
    current_setting('app.rls_bypass'::text, true) = 'on'::text
    OR (
      "workspace_subdomain" = current_setting('app.current_tenant'::text, true)
      AND (
        "deleted_at" IS NULL
        OR current_setting('app.include_deleted'::text, true) = 'true'::text
      )
    )
  );
