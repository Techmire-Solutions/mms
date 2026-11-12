-- MMS Forward-only Migration: 0242_question_bank_subsystems.sql
-- Question Bank specialized subsystems audit (docs/question-bank-subsystems-audit-2026-11-11.md):
--
--   1. Media: questions had no attachment model at all, and the attachment infrastructure is
--      contact-only — the nightly orphan sweep (`retentionPurgeScheduler` → `runAttachmentSweep`)
--      treats any file under `tenants/<t>/attachments/` as an orphan unless `contact_attachments`
--      references it. `question_attachments` is the missing reference table; question media lives in
--      its own `question-media/` directory so the contacts module gate and the forced-download headers
--      do not apply to it.
--   2. Blueprint assembly: the module had no auto-paper engine. `test_blueprint_buckets` stores the
--      request (so a generated paper documents what it asked for) and `tests.assembly_seed` stores the
--      deterministic seed that produced it.
--
-- Hand-authored (reviewed exception, mms-schema-migrate §2): `drizzle-kit generate` is blocked by the
-- 0216/0217 snapshot-chain collision. The meta snapshot is copied from 0241 with this DDL applied and
-- the journal entry is appended in the same change.

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

-- ───────────────────────── 1. question media attachments ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS "question_attachments" (
  "id" text NOT NULL,
  "workspace_subdomain" text NOT NULL,
  "question_id" text NOT NULL,
  "kind" varchar(20) NOT NULL DEFAULT 'stem',
  "option_index" integer,
  "name" varchar(255) NOT NULL,
  "mime" varchar(120) NOT NULL,
  "size" bigint NOT NULL DEFAULT 0,
  "url" text NOT NULL,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "question_attachments_pk" PRIMARY KEY ("workspace_subdomain", "question_id", "id"),
  CONSTRAINT "question_attachments_question_fk"
    FOREIGN KEY ("workspace_subdomain", "question_id")
    REFERENCES "questions" ("workspace_subdomain", "id") ON DELETE CASCADE,
  CONSTRAINT "question_attachments_workspace_subdomain_workspaces_subdomain_fk"
    FOREIGN KEY ("workspace_subdomain") REFERENCES "workspaces" ("subdomain") ON DELETE CASCADE,
  CONSTRAINT "question_attachments_kind_check" CHECK ("kind" IN ('stem', 'option')),
  CONSTRAINT "question_attachments_option_pair_check"
    CHECK (("kind" = 'option') = ("option_index" IS NOT NULL))
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "question_attachments_ws_question_idx"
  ON "question_attachments" USING btree ("workspace_subdomain", "question_id");
--> statement-breakpoint

-- Reference lookup for `/attachment/delete` and the orphan sweep.
CREATE INDEX IF NOT EXISTS "question_attachments_ws_url_idx"
  ON "question_attachments" USING btree ("workspace_subdomain", "url");
--> statement-breakpoint

ALTER TABLE "question_attachments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "question_attachments" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation_policy ON "question_attachments";
--> statement-breakpoint
CREATE POLICY tenant_isolation_policy ON "question_attachments" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);
--> statement-breakpoint

-- ───────────────────────── 2. stored blueprint + deterministic seed ───────────────────────────
ALTER TABLE "tests" ADD COLUMN IF NOT EXISTS "assembly_seed" varchar(64);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "test_blueprint_buckets" (
  "workspace_subdomain" text NOT NULL,
  "test_id" text NOT NULL,
  "bucket_index" integer NOT NULL,
  "category_id" varchar(64),
  "difficulty" varchar(20),
  "type" varchar(30),
  "target_count" integer,
  "target_marks" integer,
  CONSTRAINT "test_blueprint_buckets_pk"
    PRIMARY KEY ("workspace_subdomain", "test_id", "bucket_index"),
  CONSTRAINT "test_blueprint_buckets_test_fk"
    FOREIGN KEY ("workspace_subdomain", "test_id")
    REFERENCES "tests" ("workspace_subdomain", "id") ON DELETE CASCADE,
  CONSTRAINT "test_blueprint_buckets_workspace_subdomain_workspaces_subdomain_fk"
    FOREIGN KEY ("workspace_subdomain") REFERENCES "workspaces" ("subdomain") ON DELETE CASCADE,
  CONSTRAINT "test_blueprint_buckets_target_check"
    CHECK ("target_count" IS NOT NULL OR "target_marks" IS NOT NULL),
  CONSTRAINT "test_blueprint_buckets_non_negative_check"
    CHECK (("target_count" IS NULL OR "target_count" >= 0)
       AND ("target_marks" IS NULL OR "target_marks" >= 0))
);
--> statement-breakpoint

ALTER TABLE "test_blueprint_buckets" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "test_blueprint_buckets" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation_policy ON "test_blueprint_buckets";
--> statement-breakpoint
CREATE POLICY tenant_isolation_policy ON "test_blueprint_buckets" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);
--> statement-breakpoint
