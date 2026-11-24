-- MMS Forward-only Migration: 0174_registration.sql
-- Phase 8 — Public registration links (Sessions) and applications (Enrollments → Admissions).
--   session_registration_links  — shareable link per session (random slug, window, cap, review flag)
--   registration_link_classes   — classes offered on a link (none = every class)
--   registration_applications   — public submissions → review → approved (student + enrollment)
-- All tables are new, so plain CREATE INDEX IF NOT EXISTS is lock-safe.

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "session_registration_links" (
  "id"                   text          NOT NULL,
  "workspace_subdomain"  text          NOT NULL,
  "session_id"           text          NOT NULL,
  "slug"                 varchar(64)   NOT NULL,
  "title"                varchar(150),
  "is_active"            boolean       NOT NULL DEFAULT true,
  "opens_at"             timestamptz,
  "closes_at"            timestamptz,
  "max_submissions"      integer,
  "requires_review"      boolean       NOT NULL DEFAULT true,
  "created_by"           text,
  "deleted_at"           timestamptz,
  "deleted_by"           text,
  "deletion_reason"      varchar(500),
  "restored_at"          timestamptz,
  "restored_by"          text,
  "deleted_with_cascade" boolean       DEFAULT false,
  "created_at"           timestamptz   NOT NULL DEFAULT now(),
  "updated_at"           timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT "session_registration_links_ws_id_pk" PRIMARY KEY ("workspace_subdomain", "id"),
  CONSTRAINT "session_registration_links_window_check" CHECK ("opens_at" IS NULL OR "closes_at" IS NULL OR "closes_at" > "opens_at"),
  CONSTRAINT "session_registration_links_cap_check" CHECK ("max_submissions" IS NULL OR "max_submissions" > 0),
  CONSTRAINT "session_registration_links_workspace_fk" FOREIGN KEY ("workspace_subdomain")
    REFERENCES "workspaces" ("subdomain") ON DELETE CASCADE,
  CONSTRAINT "session_registration_links_session_fk" FOREIGN KEY ("workspace_subdomain", "session_id")
    REFERENCES "sessions" ("workspace_subdomain", "id") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "session_registration_links_slug_uidx" ON "session_registration_links" ("workspace_subdomain", "slug");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_registration_links_session_idx" ON "session_registration_links" ("workspace_subdomain", "session_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_registration_links_active_idx" ON "session_registration_links" ("workspace_subdomain") WHERE "deleted_at" IS NULL AND "is_active";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_registration_links_workspace_deleted_idx" ON "session_registration_links" ("workspace_subdomain", "deleted_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_registration_links_deleted_records_idx" ON "session_registration_links" ("workspace_subdomain", "deleted_at") WHERE "deleted_at" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "session_registration_links" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "session_registration_links" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_soft_delete_isolation" ON "session_registration_links";
--> statement-breakpoint
CREATE POLICY "tenant_soft_delete_isolation" ON "session_registration_links"
  FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR (
      "workspace_subdomain" = NULLIF(current_setting('app.current_tenant', true), '')
      AND ("deleted_at" IS NULL OR current_setting('app.include_deleted', true) = 'true')
    )
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR "workspace_subdomain" = NULLIF(current_setting('app.current_tenant', true), '')
  );
--> statement-breakpoint
DROP TRIGGER IF EXISTS "trg_session_registration_links_forbid_hard_delete" ON "session_registration_links";
--> statement-breakpoint
CREATE TRIGGER "trg_session_registration_links_forbid_hard_delete" BEFORE DELETE ON "session_registration_links" FOR EACH ROW EXECUTE FUNCTION forbid_hard_delete();
--> statement-breakpoint
DROP TRIGGER IF EXISTS "update_session_registration_links_updated_at" ON "session_registration_links";
--> statement-breakpoint
CREATE TRIGGER "update_session_registration_links_updated_at" BEFORE UPDATE ON "session_registration_links" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "registration_link_classes" (
  "workspace_subdomain"  text  NOT NULL,
  "link_id"              text  NOT NULL,
  "class_id"             text  NOT NULL,
  CONSTRAINT "registration_link_classes_pk" PRIMARY KEY ("workspace_subdomain", "link_id", "class_id"),
  CONSTRAINT "registration_link_classes_workspace_fk" FOREIGN KEY ("workspace_subdomain")
    REFERENCES "workspaces" ("subdomain") ON DELETE CASCADE,
  CONSTRAINT "registration_link_classes_link_fk" FOREIGN KEY ("workspace_subdomain", "link_id")
    REFERENCES "session_registration_links" ("workspace_subdomain", "id") ON DELETE CASCADE,
  CONSTRAINT "registration_link_classes_class_fk" FOREIGN KEY ("workspace_subdomain", "class_id")
    REFERENCES "session_classes" ("workspace_subdomain", "id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "registration_link_classes_class_idx" ON "registration_link_classes" ("workspace_subdomain", "class_id");
--> statement-breakpoint
ALTER TABLE "registration_link_classes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "registration_link_classes" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "registration_link_classes";
--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "registration_link_classes"
  FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR "workspace_subdomain" = NULLIF(current_setting('app.current_tenant', true), '')
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR "workspace_subdomain" = NULLIF(current_setting('app.current_tenant', true), '')
  );
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "registration_applications" (
  "id"                    text          NOT NULL,
  "workspace_subdomain"   text          NOT NULL,
  "reference"             varchar(20)   NOT NULL,
  "link_id"               text          NOT NULL,
  "session_id"            text          NOT NULL,
  "class_id"              text          NOT NULL,
  "preferred_section_id"  text,
  "full_name"             varchar(150)  NOT NULL,
  "guardian_name"         varchar(150)  NOT NULL,
  "date_of_birth"         date          NOT NULL,
  "gender"                varchar(10)   NOT NULL,
  "phone"                 varchar(30)   NOT NULL,
  "email"                 varchar(200),
  "address"               varchar(500),
  "previous_madrasa"      varchar(200),
  "status"                varchar(20)   NOT NULL DEFAULT 'submitted',
  "student_id"            varchar(64),
  "enrollment_id"         text,
  "reviewed_by"           text,
  "review_reason"         varchar(500),
  "reviewed_at"           timestamptz,
  "submitted_ip_hash"     varchar(64),
  "deleted_at"            timestamptz,
  "deleted_by"            text,
  "deletion_reason"       varchar(500),
  "restored_at"           timestamptz,
  "restored_by"           text,
  "deleted_with_cascade"  boolean       DEFAULT false,
  "created_at"            timestamptz   NOT NULL DEFAULT now(),
  "updated_at"            timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT "registration_applications_ws_id_pk" PRIMARY KEY ("workspace_subdomain", "id"),
  CONSTRAINT "registration_applications_status_check" CHECK ("status" IN ('submitted', 'under_review', 'waitlisted', 'approved', 'rejected', 'withdrawn')),
  CONSTRAINT "registration_applications_gender_check" CHECK ("gender" IN ('male', 'female')),
  CONSTRAINT "registration_applications_workspace_fk" FOREIGN KEY ("workspace_subdomain")
    REFERENCES "workspaces" ("subdomain") ON DELETE CASCADE,
  CONSTRAINT "registration_applications_link_fk" FOREIGN KEY ("workspace_subdomain", "link_id")
    REFERENCES "session_registration_links" ("workspace_subdomain", "id") ON DELETE CASCADE,
  CONSTRAINT "registration_applications_session_fk" FOREIGN KEY ("workspace_subdomain", "session_id")
    REFERENCES "sessions" ("workspace_subdomain", "id") ON DELETE CASCADE,
  CONSTRAINT "registration_applications_class_fk" FOREIGN KEY ("workspace_subdomain", "class_id")
    REFERENCES "session_classes" ("workspace_subdomain", "id") ON DELETE RESTRICT,
  CONSTRAINT "registration_applications_section_fk" FOREIGN KEY ("workspace_subdomain", "preferred_section_id")
    REFERENCES "session_class_sections" ("workspace_subdomain", "id") ON DELETE SET NULL (preferred_section_id),
  CONSTRAINT "registration_applications_student_fk" FOREIGN KEY ("workspace_subdomain", "student_id")
    REFERENCES "students" ("workspace_subdomain", "id") ON DELETE SET NULL (student_id),
  CONSTRAINT "registration_applications_enrollment_fk" FOREIGN KEY ("workspace_subdomain", "enrollment_id")
    REFERENCES "enrollments" ("workspace_subdomain", "id") ON DELETE SET NULL (enrollment_id)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "registration_applications_reference_uidx" ON "registration_applications" ("workspace_subdomain", "reference");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "registration_applications_duplicate_uidx" ON "registration_applications"
  ("workspace_subdomain", "session_id", "phone", "date_of_birth", lower(btrim("full_name")))
  WHERE "deleted_at" IS NULL AND "status" NOT IN ('rejected', 'withdrawn');
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "registration_applications_session_status_idx" ON "registration_applications" ("workspace_subdomain", "session_id", "status") WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "registration_applications_status_created_idx" ON "registration_applications" ("workspace_subdomain", "status", "created_at" DESC) WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "registration_applications_link_idx" ON "registration_applications" ("workspace_subdomain", "link_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "registration_applications_class_idx" ON "registration_applications" ("workspace_subdomain", "class_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "registration_applications_section_idx" ON "registration_applications" ("workspace_subdomain", "preferred_section_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "registration_applications_student_idx" ON "registration_applications" ("workspace_subdomain", "student_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "registration_applications_enrollment_idx" ON "registration_applications" ("workspace_subdomain", "enrollment_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "registration_applications_workspace_deleted_idx" ON "registration_applications" ("workspace_subdomain", "deleted_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "registration_applications_deleted_records_idx" ON "registration_applications" ("workspace_subdomain", "deleted_at") WHERE "deleted_at" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "registration_applications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "registration_applications" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_soft_delete_isolation" ON "registration_applications";
--> statement-breakpoint
CREATE POLICY "tenant_soft_delete_isolation" ON "registration_applications"
  FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR (
      "workspace_subdomain" = NULLIF(current_setting('app.current_tenant', true), '')
      AND ("deleted_at" IS NULL OR current_setting('app.include_deleted', true) = 'true')
    )
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR "workspace_subdomain" = NULLIF(current_setting('app.current_tenant', true), '')
  );
--> statement-breakpoint
DROP TRIGGER IF EXISTS "trg_registration_applications_forbid_hard_delete" ON "registration_applications";
--> statement-breakpoint
CREATE TRIGGER "trg_registration_applications_forbid_hard_delete" BEFORE DELETE ON "registration_applications" FOR EACH ROW EXECUTE FUNCTION forbid_hard_delete();
--> statement-breakpoint
DROP TRIGGER IF EXISTS "update_registration_applications_updated_at" ON "registration_applications";
--> statement-breakpoint
CREATE TRIGGER "update_registration_applications_updated_at" BEFORE UPDATE ON "registration_applications" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
