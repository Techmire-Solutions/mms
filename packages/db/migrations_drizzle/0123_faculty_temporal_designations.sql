-- Normalize Faculty designations, their assignable roles, and dated assignment history.
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint

CREATE TABLE "faculty_designations" (
  "id" text NOT NULL,
  "workspace_subdomain" text NOT NULL,
  "code" varchar(50) NOT NULL,
  "name" varchar(150) NOT NULL,
  "hierarchy_rank" integer NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "faculty_designations_workspace_subdomain_id_pk" PRIMARY KEY ("workspace_subdomain", "id"),
  CONSTRAINT "faculty_designations_workspace_code_uidx" UNIQUE ("workspace_subdomain", "code"),
  CONSTRAINT "faculty_designations_hierarchy_rank_positive_check" CHECK ("hierarchy_rank" > 0),
  CONSTRAINT "faculty_designations_workspace_subdomain_workspaces_subdomain_fk"
    FOREIGN KEY ("workspace_subdomain") REFERENCES "workspaces"("subdomain") ON DELETE CASCADE
);
--> statement-breakpoint

CREATE TABLE "faculty_designation_roles" (
  "workspace_subdomain" text NOT NULL,
  "designation_id" text NOT NULL,
  "role_key" varchar(100) NOT NULL,
  CONSTRAINT "faculty_designation_roles_workspace_designation_role_pk"
    PRIMARY KEY ("workspace_subdomain", "designation_id", "role_key"),
  CONSTRAINT "faculty_designation_roles_workspace_subdomain_workspaces_subdomain_fk"
    FOREIGN KEY ("workspace_subdomain") REFERENCES "workspaces"("subdomain") ON DELETE CASCADE,
  CONSTRAINT "faculty_designation_roles_designation_fk"
    FOREIGN KEY ("workspace_subdomain", "designation_id")
    REFERENCES "faculty_designations"("workspace_subdomain", "id") ON DELETE CASCADE
);
--> statement-breakpoint

CREATE TABLE "faculty_designation_assignments" (
  "id" text NOT NULL,
  "workspace_subdomain" text NOT NULL,
  "faculty_id" text NOT NULL,
  "designation_id" text NOT NULL,
  "starts_on" date NOT NULL,
  "ends_on" date,
  "notes" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "faculty_designation_assignments_workspace_subdomain_id_pk"
    PRIMARY KEY ("workspace_subdomain", "id"),
  CONSTRAINT "faculty_designation_assignment_period_check"
    CHECK ("ends_on" IS NULL OR "ends_on" >= "starts_on"),
  CONSTRAINT "faculty_designation_assignments_faculty_fk"
    FOREIGN KEY ("workspace_subdomain", "faculty_id")
    REFERENCES "faculty"("workspace_subdomain", "id") ON DELETE CASCADE,
  CONSTRAINT "faculty_designation_assignments_designation_fk"
    FOREIGN KEY ("workspace_subdomain", "designation_id")
    REFERENCES "faculty_designations"("workspace_subdomain", "id") ON DELETE RESTRICT,
  CONSTRAINT "faculty_designation_assignments_no_overlap_excl"
    EXCLUDE USING gist (
      "workspace_subdomain" WITH =,
      "faculty_id" WITH =,
      daterange("starts_on", COALESCE("ends_on", 'infinity'::date), '[]') WITH &&
    )
);
--> statement-breakpoint

CREATE INDEX "faculty_designations_workspace_active_rank_idx"
  ON "faculty_designations" ("workspace_subdomain", "is_active", "hierarchy_rank");
CREATE INDEX "faculty_designation_roles_workspace_role_idx"
  ON "faculty_designation_roles" ("workspace_subdomain", "role_key");
CREATE INDEX "faculty_designation_assignments_workspace_faculty_start_idx"
  ON "faculty_designation_assignments" ("workspace_subdomain", "faculty_id", "starts_on" DESC);
CREATE INDEX "faculty_designation_assignments_workspace_designation_idx"
  ON "faculty_designation_assignments" ("workspace_subdomain", "designation_id");
CREATE UNIQUE INDEX "faculty_designation_assignments_one_open_uidx"
  ON "faculty_designation_assignments" ("workspace_subdomain", "faculty_id")
  WHERE "ends_on" IS NULL;
--> statement-breakpoint

ALTER TABLE "faculty_designations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "faculty_designations" FORCE ROW LEVEL SECURITY;
ALTER TABLE "faculty_designation_roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "faculty_designation_roles" FORCE ROW LEVEL SECURITY;
ALTER TABLE "faculty_designation_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "faculty_designation_assignments" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY "tenant_isolation_policy" ON "faculty_designations" FOR ALL
  USING ("workspace_subdomain" = NULLIF(current_setting('app.current_tenant', true), ''))
  WITH CHECK ("workspace_subdomain" = NULLIF(current_setting('app.current_tenant', true), ''));
CREATE POLICY "tenant_isolation_policy" ON "faculty_designation_roles" FOR ALL
  USING ("workspace_subdomain" = NULLIF(current_setting('app.current_tenant', true), ''))
  WITH CHECK ("workspace_subdomain" = NULLIF(current_setting('app.current_tenant', true), ''));
CREATE POLICY "tenant_isolation_policy" ON "faculty_designation_assignments" FOR ALL
  USING ("workspace_subdomain" = NULLIF(current_setting('app.current_tenant', true), ''))
  WITH CHECK ("workspace_subdomain" = NULLIF(current_setting('app.current_tenant', true), ''));
--> statement-breakpoint

-- Expand/backfill: preserve every current designation as the first historical assignment.
INSERT INTO "faculty_designations" ("id", "workspace_subdomain", "code", "name", "hierarchy_rank")
SELECT
  'des-' || substr(md5("workspace_subdomain" || ':' || lower(trim("designation"))), 1, 24),
  "workspace_subdomain",
  substr(regexp_replace(lower(trim("designation")), '[^a-z0-9]+', '-', 'g'), 1, 50),
  trim("designation"),
  min("hierarchy_rank")
FROM "faculty"
WHERE NULLIF(trim("designation"), '') IS NOT NULL
GROUP BY "workspace_subdomain", lower(trim("designation")), trim("designation")
ON CONFLICT ("workspace_subdomain", "code") DO NOTHING;
--> statement-breakpoint

INSERT INTO "faculty_designation_assignments" (
  "id", "workspace_subdomain", "faculty_id", "designation_id", "starts_on"
)
SELECT
  'fda-' || substr(md5(f."workspace_subdomain" || ':' || f."id"), 1, 24),
  f."workspace_subdomain",
  f."id",
  d."id",
  f."created_at"::date
FROM "faculty" f
JOIN "faculty_designations" d
  ON d."workspace_subdomain" = f."workspace_subdomain"
 AND d."code" = substr(regexp_replace(lower(trim(f."designation")), '[^a-z0-9]+', '-', 'g'), 1, 50)
WHERE NULLIF(trim(f."designation"), '') IS NOT NULL
ON CONFLICT DO NOTHING;
