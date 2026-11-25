-- Migration 0110: Model 6 Academic Sessions Management Redesign
-- Creates and updates normalized relational tables for Model 6:
-- 1. session_faculty (Session Management)
-- 2. session_classes (Model 6 columns: gender, age_calc_date, age_min, age_max, capacity, enrollment_deadline, status)
-- 3. session_class_fees
-- 4. session_class_schedules
-- 5. session_class_budgets
-- 6. session_class_discounts
-- 7. session_class_timetables
-- 8. session_class_timetable_periods
-- 9. session_class_refreshments
-- 10. scholarship_eligibilities
-- 11. session_class_scholarships

-- 1. Session Faculty (Session Management)
CREATE TABLE IF NOT EXISTS "session_faculty" (
  "id" text NOT NULL,
  "workspace_subdomain" text NOT NULL REFERENCES "workspaces"("subdomain") ON DELETE CASCADE,
  "session_id" text NOT NULL,
  "faculty_id" varchar(64) NOT NULL,
  "faculty_name" varchar(255) NOT NULL DEFAULT '',
  "role" varchar(100) NOT NULL DEFAULT 'coordinator',
  "status" varchar(50) NOT NULL DEFAULT 'active',
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("workspace_subdomain", "session_id", "id"),
  FOREIGN KEY ("workspace_subdomain", "session_id") REFERENCES "sessions"("workspace_subdomain", "id") ON DELETE CASCADE
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "session_faculty_workspace_session_idx" ON "session_faculty" ("workspace_subdomain", "session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_faculty_workspace_faculty_idx" ON "session_faculty" ("workspace_subdomain", "faculty_id");--> statement-breakpoint

-- 2. Session Classes (Ensure Model 6 columns)
ALTER TABLE "session_classes" ADD COLUMN IF NOT EXISTS "gender" varchar(20) NOT NULL DEFAULT 'mixed';--> statement-breakpoint
ALTER TABLE "session_classes" ADD COLUMN IF NOT EXISTS "age_calc_date" varchar(30) NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE "session_classes" ADD COLUMN IF NOT EXISTS "age_min" integer NOT NULL DEFAULT 4;--> statement-breakpoint
ALTER TABLE "session_classes" ADD COLUMN IF NOT EXISTS "age_max" integer NOT NULL DEFAULT 25;--> statement-breakpoint
ALTER TABLE "session_classes" ADD COLUMN IF NOT EXISTS "capacity" integer NOT NULL DEFAULT 30;--> statement-breakpoint
ALTER TABLE "session_classes" ADD COLUMN IF NOT EXISTS "enrolled" integer NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE "session_classes" ADD COLUMN IF NOT EXISTS "enrollment_deadline" varchar(35) NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE "session_classes" ADD COLUMN IF NOT EXISTS "status" varchar(50) NOT NULL DEFAULT 'active';--> statement-breakpoint
ALTER TABLE "session_classes" ADD COLUMN IF NOT EXISTS "teacher_id" varchar(64) NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE "session_classes" ADD COLUMN IF NOT EXISTS "teacher_name" varchar(255) DEFAULT '';--> statement-breakpoint
ALTER TABLE "session_classes" ADD COLUMN IF NOT EXISTS "room" varchar(100) DEFAULT '';--> statement-breakpoint
ALTER TABLE "session_classes" ADD COLUMN IF NOT EXISTS "sort_order" integer NOT NULL DEFAULT 0;--> statement-breakpoint

-- 3. Session Class Fees
CREATE TABLE IF NOT EXISTS "session_class_fees" (
  "id" text NOT NULL,
  "workspace_subdomain" text NOT NULL REFERENCES "workspaces"("subdomain") ON DELETE CASCADE,
  "session_class_id" text NOT NULL,
  "fee_type" varchar(100) NOT NULL,
  "amount" numeric(12, 2) NOT NULL DEFAULT '0',
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("workspace_subdomain", "session_class_id", "id")
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "session_class_fees_workspace_class_idx" ON "session_class_fees" ("workspace_subdomain", "session_class_id");--> statement-breakpoint

-- 4. Session Class Schedules
CREATE TABLE IF NOT EXISTS "session_class_schedules" (
  "id" text NOT NULL,
  "workspace_subdomain" text NOT NULL REFERENCES "workspaces"("subdomain") ON DELETE CASCADE,
  "session_class_id" text NOT NULL,
  "schedule_type" varchar(100) NOT NULL,
  "start_date" varchar(30) NOT NULL,
  "end_date" varchar(30) NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("workspace_subdomain", "session_class_id", "id")
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "session_class_schedules_workspace_class_idx" ON "session_class_schedules" ("workspace_subdomain", "session_class_id");--> statement-breakpoint

-- 5. Session Class Budgets
CREATE TABLE IF NOT EXISTS "session_class_budgets" (
  "id" text NOT NULL,
  "workspace_subdomain" text NOT NULL REFERENCES "workspaces"("subdomain") ON DELETE CASCADE,
  "session_class_id" text NOT NULL,
  "budget_type" varchar(20) NOT NULL,
  "detail" text NOT NULL,
  "amount" numeric(12, 2) NOT NULL DEFAULT '0',
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("workspace_subdomain", "session_class_id", "id")
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "session_class_budgets_workspace_class_idx" ON "session_class_budgets" ("workspace_subdomain", "session_class_id");--> statement-breakpoint

-- 6. Session Class Discounts
CREATE TABLE IF NOT EXISTS "session_class_discounts" (
  "id" text NOT NULL,
  "workspace_subdomain" text NOT NULL REFERENCES "workspaces"("subdomain") ON DELETE CASCADE,
  "session_class_id" text NOT NULL,
  "discount_type" varchar(100) NOT NULL,
  "percentage" numeric(5, 2) NOT NULL DEFAULT '0',
  "start_date" varchar(30),
  "end_date" varchar(30),
  "eligibility_criteria" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "status" varchar(50) NOT NULL DEFAULT 'active',
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("workspace_subdomain", "session_class_id", "id")
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "session_class_discounts_workspace_class_idx" ON "session_class_discounts" ("workspace_subdomain", "session_class_id");--> statement-breakpoint

-- 7. Session Class Timetables
CREATE TABLE IF NOT EXISTS "session_class_timetables" (
  "id" text NOT NULL,
  "workspace_subdomain" text NOT NULL REFERENCES "workspaces"("subdomain") ON DELETE CASCADE,
  "session_class_id" text NOT NULL,
  "date" varchar(30) NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("workspace_subdomain", "session_class_id", "id")
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "session_class_timetables_workspace_class_idx" ON "session_class_timetables" ("workspace_subdomain", "session_class_id");--> statement-breakpoint

-- 8. Session Class Timetable Periods
CREATE TABLE IF NOT EXISTS "session_class_timetable_periods" (
  "id" text NOT NULL,
  "workspace_subdomain" text NOT NULL REFERENCES "workspaces"("subdomain") ON DELETE CASCADE,
  "timetable_id" text NOT NULL,
  "start_time" varchar(20) NOT NULL,
  "end_time" varchar(20) NOT NULL,
  "subject" varchar(150) NOT NULL,
  "teacher_id" varchar(64) DEFAULT '',
  "teacher_name" varchar(255) DEFAULT '',
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("workspace_subdomain", "timetable_id", "id")
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "session_class_timetable_periods_workspace_timetable_idx" ON "session_class_timetable_periods" ("workspace_subdomain", "timetable_id");--> statement-breakpoint

-- 9. Session Class Refreshments
CREATE TABLE IF NOT EXISTS "session_class_refreshments" (
  "id" text NOT NULL,
  "workspace_subdomain" text NOT NULL REFERENCES "workspaces"("subdomain") ON DELETE CASCADE,
  "session_class_id" text NOT NULL,
  "date" varchar(35) NOT NULL,
  "item" varchar(255) NOT NULL,
  "quantity" integer NOT NULL DEFAULT 1,
  "price_per_unit" numeric(12, 2) NOT NULL DEFAULT '0',
  "paid_amount" numeric(12, 2) NOT NULL DEFAULT '0',
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("workspace_subdomain", "session_class_id", "id")
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "session_class_refreshments_workspace_class_idx" ON "session_class_refreshments" ("workspace_subdomain", "session_class_id");--> statement-breakpoint

-- 10. Scholarship Eligibility
CREATE TABLE IF NOT EXISTS "scholarship_eligibilities" (
  "id" text NOT NULL,
  "workspace_subdomain" text NOT NULL REFERENCES "workspaces"("subdomain") ON DELETE CASCADE,
  "orphan" boolean NOT NULL DEFAULT false,
  "job" boolean NOT NULL DEFAULT false,
  "business" boolean NOT NULL DEFAULT false,
  "property" boolean NOT NULL DEFAULT false,
  "family_members" integer NOT NULL DEFAULT 1,
  "on_job_members" integer NOT NULL DEFAULT 0,
  "school_going_siblings" integer NOT NULL DEFAULT 0,
  "residence" varchar(100) NOT NULL DEFAULT 'rental',
  "notes" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("workspace_subdomain", "id")
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "scholarship_eligibilities_workspace_idx" ON "scholarship_eligibilities" ("workspace_subdomain");--> statement-breakpoint

-- 11. Session Class Scholarships
CREATE TABLE IF NOT EXISTS "session_class_scholarships" (
  "id" text NOT NULL,
  "workspace_subdomain" text NOT NULL REFERENCES "workspaces"("subdomain") ON DELETE CASCADE,
  "session_class_id" text NOT NULL,
  "scholarship_eligibility_id" text,
  "percentage" numeric(5, 2) NOT NULL DEFAULT '0',
  "expiry_date" varchar(30) DEFAULT '',
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("workspace_subdomain", "session_class_id", "id")
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "session_class_scholarships_workspace_class_idx" ON "session_class_scholarships" ("workspace_subdomain", "session_class_id");--> statement-breakpoint

-- 12. Enable and Force Row Level Security on all new tenant tables
ALTER TABLE "session_faculty" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "session_faculty" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "session_faculty";--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "session_faculty"
  FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  );--> statement-breakpoint

ALTER TABLE "session_class_fees" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "session_class_fees" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "session_class_fees";--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "session_class_fees"
  FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  );--> statement-breakpoint

ALTER TABLE "session_class_schedules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "session_class_schedules" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "session_class_schedules";--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "session_class_schedules"
  FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  );--> statement-breakpoint

ALTER TABLE "session_class_budgets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "session_class_budgets" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "session_class_budgets";--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "session_class_budgets"
  FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  );--> statement-breakpoint

ALTER TABLE "session_class_discounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "session_class_discounts" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "session_class_discounts";--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "session_class_discounts"
  FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  );--> statement-breakpoint

ALTER TABLE "session_class_timetables" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "session_class_timetables" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "session_class_timetables";--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "session_class_timetables"
  FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  );--> statement-breakpoint

ALTER TABLE "session_class_timetable_periods" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "session_class_timetable_periods" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "session_class_timetable_periods";--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "session_class_timetable_periods"
  FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  );--> statement-breakpoint

ALTER TABLE "session_class_refreshments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "session_class_refreshments" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "session_class_refreshments";--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "session_class_refreshments"
  FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  );--> statement-breakpoint

ALTER TABLE "scholarship_eligibilities" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "scholarship_eligibilities" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "scholarship_eligibilities";--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "scholarship_eligibilities"
  FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  );--> statement-breakpoint

ALTER TABLE "session_class_scholarships" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "session_class_scholarships" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "session_class_scholarships";--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "session_class_scholarships"
  FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  );
