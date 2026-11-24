-- 1. Add typed columns to sessions
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "name" varchar(255) NOT NULL DEFAULT '';
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "type" varchar(100) NOT NULL DEFAULT 'academic';
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "status" varchar(50) NOT NULL DEFAULT 'active';
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "start_date" varchar(30) NOT NULL DEFAULT '';
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "end_date" varchar(30) NOT NULL DEFAULT '';
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "base_fee" numeric(12, 2) NOT NULL DEFAULT '0';
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "currency" varchar(20) NOT NULL DEFAULT 'PKR';
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "description" text;
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "budget_total_revenue" numeric(12, 2) NOT NULL DEFAULT '0';
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "budget_collected" numeric(12, 2) NOT NULL DEFAULT '0';
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "created_at" timestamp NOT NULL DEFAULT now();

-- 2. Create child tables
CREATE TABLE IF NOT EXISTS "session_classes" (
  "id" text NOT NULL,
  "workspace_subdomain" text NOT NULL REFERENCES "workspaces"("subdomain") ON DELETE CASCADE,
  "session_id" text NOT NULL,
  "name" varchar(255) NOT NULL,
  "age_min" integer NOT NULL DEFAULT 1,
  "age_max" integer NOT NULL DEFAULT 120,
  "gender" varchar(20) NOT NULL DEFAULT 'any',
  "teacher_id" varchar(64) NOT NULL,
  "teacher_name" varchar(255),
  "capacity" integer NOT NULL DEFAULT 30,
  "enrolled" integer NOT NULL DEFAULT 0,
  "room" varchar(100),
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY ("workspace_subdomain", "session_id", "id")
);

CREATE TABLE IF NOT EXISTS "session_timetable" (
  "id" text NOT NULL,
  "workspace_subdomain" text NOT NULL REFERENCES "workspaces"("subdomain") ON DELETE CASCADE,
  "session_id" text NOT NULL,
  "day" varchar(10) NOT NULL,
  "activity" varchar(255) NOT NULL,
  "start_time" varchar(20) NOT NULL,
  "end_time" varchar(20) NOT NULL,
  "location" varchar(255) NOT NULL,
  "type" varchar(50) NOT NULL,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY ("workspace_subdomain", "session_id", "id")
);

CREATE TABLE IF NOT EXISTS "session_discounts" (
  "id" text NOT NULL,
  "workspace_subdomain" text NOT NULL REFERENCES "workspaces"("subdomain") ON DELETE CASCADE,
  "session_id" text NOT NULL,
  "name" varchar(255) NOT NULL,
  "type" varchar(20) NOT NULL,
  "value" numeric(10, 2) NOT NULL DEFAULT '0',
  "conditions" text NOT NULL DEFAULT '',
  "active" boolean NOT NULL DEFAULT true,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY ("workspace_subdomain", "session_id", "id")
);

CREATE TABLE IF NOT EXISTS "session_budget_expenses" (
  "id" text NOT NULL,
  "workspace_subdomain" text NOT NULL REFERENCES "workspaces"("subdomain") ON DELETE CASCADE,
  "session_id" text NOT NULL,
  "category" varchar(100) NOT NULL,
  "amount" numeric(12, 2) NOT NULL DEFAULT '0',
  "date" varchar(30) NOT NULL,
  "note" text,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY ("workspace_subdomain", "session_id", "id")
);

CREATE TABLE IF NOT EXISTS "session_budget_incomes" (
  "id" text NOT NULL,
  "workspace_subdomain" text NOT NULL REFERENCES "workspaces"("subdomain") ON DELETE CASCADE,
  "session_id" text NOT NULL,
  "category" varchar(100) NOT NULL,
  "amount" numeric(12, 2) NOT NULL DEFAULT '0',
  "date" varchar(30) NOT NULL,
  "note" text,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY ("workspace_subdomain", "session_id", "id")
);

CREATE TABLE IF NOT EXISTS "session_events" (
  "id" text NOT NULL,
  "workspace_subdomain" text NOT NULL REFERENCES "workspaces"("subdomain") ON DELETE CASCADE,
  "session_id" text NOT NULL,
  "title" varchar(255) NOT NULL,
  "date" varchar(30) NOT NULL,
  "time" varchar(30) NOT NULL,
  "location" varchar(255) NOT NULL,
  "description" text,
  "type" varchar(50) NOT NULL,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY ("workspace_subdomain", "session_id", "id")
);

CREATE TABLE IF NOT EXISTS "session_tabarruk" (
  "id" text NOT NULL,
  "workspace_subdomain" text NOT NULL REFERENCES "workspaces"("subdomain") ON DELETE CASCADE,
  "session_id" text NOT NULL,
  "item" varchar(255) NOT NULL,
  "quantity" varchar(100) NOT NULL,
  "occasion" varchar(255) NOT NULL,
  "date" varchar(30) NOT NULL,
  "note" text,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY ("workspace_subdomain", "session_id", "id")
);

-- 3. Backfill data
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'sessions' AND column_name = 'custom_data'
  ) THEN
    -- Backfill parent sessions
    UPDATE "sessions" SET
      "name" = COALESCE("custom_data"->>'name', ''),
      "type" = COALESCE("custom_data"->>'type', 'academic'),
      "status" = COALESCE("custom_data"->>'status', 'active'),
      "start_date" = COALESCE("custom_data"->>'startDate', ''),
      "end_date" = COALESCE("custom_data"->>'endDate', ''),
      "base_fee" = COALESCE(NULLIF("custom_data"->>'baseFee', '')::numeric, 0),
      "currency" = COALESCE("custom_data"->>'currency', 'PKR'),
      "description" = "custom_data"->>'description',
      "budget_total_revenue" = COALESCE(NULLIF("custom_data"->'budget'->>'totalRevenue', '')::numeric, 0),
      "budget_collected" = COALESCE(NULLIF("custom_data"->'budget'->>'collected', '')::numeric, 0),
      "created_at" = CASE 
        WHEN ("custom_data"->>'createdAt') IS NOT NULL AND ("custom_data"->>'createdAt') != '' 
        THEN ("custom_data"->>'createdAt')::timestamp 
        ELSE now() 
      END,
      "updated_at" = CASE 
        WHEN ("custom_data"->>'updatedAt') IS NOT NULL AND ("custom_data"->>'updatedAt') != '' 
        THEN ("custom_data"->>'updatedAt')::timestamp 
        ELSE now() 
      END
    WHERE "custom_data" IS NOT NULL;

    -- Backfill session_classes
    INSERT INTO "session_classes" (
      "id", "workspace_subdomain", "session_id", "name", "age_min", "age_max", "gender",
      "teacher_id", "teacher_name", "capacity", "enrolled", "room", "sort_order"
    )
    SELECT
      COALESCE(cls.value->>'id', 'cls-' || cls.ordinality::text) AS "id",
      s.workspace_subdomain,
      s.id AS "session_id",
      COALESCE(cls.value->>'name', '') AS "name",
      COALESCE(NULLIF(cls.value->>'ageMin', '')::int, 1) AS "age_min",
      COALESCE(NULLIF(cls.value->>'ageMax', '')::int, 120) AS "age_max",
      COALESCE(cls.value->>'gender', 'any') AS "gender",
      COALESCE(cls.value->>'teacherId', '') AS "teacher_id",
      cls.value->>'teacherName' AS "teacher_name",
      COALESCE(NULLIF(cls.value->>'capacity', '')::int, 30) AS "capacity",
      COALESCE(NULLIF(cls.value->>'enrolled', '')::int, 0) AS "enrolled",
      cls.value->>'room' AS "room",
      (cls.ordinality - 1)::int AS "sort_order"
    FROM "sessions" s
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(s.custom_data->'classes', '[]'::jsonb)) WITH ORDINALITY AS cls(value, ordinality)
    WHERE s.custom_data IS NOT NULL
    ON CONFLICT ("workspace_subdomain", "session_id", "id") DO NOTHING;

    -- Backfill session_timetable
    INSERT INTO "session_timetable" (
      "id", "workspace_subdomain", "session_id", "day", "activity", "start_time", "end_time",
      "location", "type", "sort_order"
    )
    SELECT
      COALESCE(tt.value->>'id', 'tt-' || tt.ordinality::text) AS "id",
      s.workspace_subdomain,
      s.id AS "session_id",
      COALESCE(tt.value->>'day', 'Mon') AS "day",
      COALESCE(tt.value->>'activity', '') AS "activity",
      COALESCE(tt.value->>'startTime', '') AS "start_time",
      COALESCE(tt.value->>'endTime', '') AS "end_time",
      COALESCE(tt.value->>'location', '') AS "location",
      COALESCE(tt.value->>'type', 'class') AS "type",
      (tt.ordinality - 1)::int AS "sort_order"
    FROM "sessions" s
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(s.custom_data->'timetable', '[]'::jsonb)) WITH ORDINALITY AS tt(value, ordinality)
    WHERE s.custom_data IS NOT NULL
    ON CONFLICT ("workspace_subdomain", "session_id", "id") DO NOTHING;

    -- Backfill session_discounts
    INSERT INTO "session_discounts" (
      "id", "workspace_subdomain", "session_id", "name", "type", "value", "conditions", "active", "sort_order"
    )
    SELECT
      COALESCE(disc.value->>'id', 'disc-' || disc.ordinality::text) AS "id",
      s.workspace_subdomain,
      s.id AS "session_id",
      COALESCE(disc.value->>'name', '') AS "name",
      COALESCE(disc.value->>'type', 'percentage') AS "type",
      COALESCE(NULLIF(disc.value->>'value', '')::numeric, 0) AS "value",
      COALESCE(disc.value->>'conditions', '') AS "conditions",
      COALESCE(NULLIF(disc.value->>'active', '')::boolean, true) AS "active",
      (disc.ordinality - 1)::int AS "sort_order"
    FROM "sessions" s
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(s.custom_data->'discounts', '[]'::jsonb)) WITH ORDINALITY AS disc(value, ordinality)
    WHERE s.custom_data IS NOT NULL
    ON CONFLICT ("workspace_subdomain", "session_id", "id") DO NOTHING;

    -- Backfill session_budget_expenses
    INSERT INTO "session_budget_expenses" (
      "id", "workspace_subdomain", "session_id", "category", "amount", "date", "note", "sort_order"
    )
    SELECT
      COALESCE(exp.value->>'id', 'exp-' || exp.ordinality::text) AS "id",
      s.workspace_subdomain,
      s.id AS "session_id",
      COALESCE(exp.value->>'category', 'general') AS "category",
      COALESCE(NULLIF(exp.value->>'amount', '')::numeric, 0) AS "amount",
      COALESCE(exp.value->>'date', '') AS "date",
      exp.value->>'note' AS "note",
      (exp.ordinality - 1)::int AS "sort_order"
    FROM "sessions" s
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(s.custom_data->'budget'->'expenses', '[]'::jsonb)) WITH ORDINALITY AS exp(value, ordinality)
    WHERE s.custom_data IS NOT NULL
    ON CONFLICT ("workspace_subdomain", "session_id", "id") DO NOTHING;

    -- Backfill session_budget_incomes
    INSERT INTO "session_budget_incomes" (
      "id", "workspace_subdomain", "session_id", "category", "amount", "date", "note", "sort_order"
    )
    SELECT
      COALESCE(inc.value->>'id', 'inc-' || inc.ordinality::text) AS "id",
      s.workspace_subdomain,
      s.id AS "session_id",
      COALESCE(inc.value->>'category', 'general') AS "category",
      COALESCE(NULLIF(inc.value->>'amount', '')::numeric, 0) AS "amount",
      COALESCE(inc.value->>'date', '') AS "date",
      inc.value->>'note' AS "note",
      (inc.ordinality - 1)::int AS "sort_order"
    FROM "sessions" s
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(s.custom_data->'budget'->'incomes', '[]'::jsonb)) WITH ORDINALITY AS inc(value, ordinality)
    WHERE s.custom_data IS NOT NULL
    ON CONFLICT ("workspace_subdomain", "session_id", "id") DO NOTHING;

    -- Backfill session_events
    INSERT INTO "session_events" (
      "id", "workspace_subdomain", "session_id", "title", "date", "time", "location", "description", "type", "sort_order"
    )
    SELECT
      COALESCE(ev.value->>'id', 'ev-' || ev.ordinality::text) AS "id",
      s.workspace_subdomain,
      s.id AS "session_id",
      COALESCE(ev.value->>'title', '') AS "title",
      COALESCE(ev.value->>'date', '') AS "date",
      COALESCE(ev.value->>'time', '') AS "time",
      COALESCE(ev.value->>'location', '') AS "location",
      ev.value->>'description' AS "description",
      COALESCE(ev.value->>'type', 'other') AS "type",
      (ev.ordinality - 1)::int AS "sort_order"
    FROM "sessions" s
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(s.custom_data->'events', '[]'::jsonb)) WITH ORDINALITY AS ev(value, ordinality)
    WHERE s.custom_data IS NOT NULL
    ON CONFLICT ("workspace_subdomain", "session_id", "id") DO NOTHING;

    -- Backfill session_tabarruk
    INSERT INTO "session_tabarruk" (
      "id", "workspace_subdomain", "session_id", "item", "quantity", "occasion", "date", "note", "sort_order"
    )
    SELECT
      COALESCE(tab.value->>'id', 'tab-' || tab.ordinality::text) AS "id",
      s.workspace_subdomain,
      s.id AS "session_id",
      COALESCE(tab.value->>'item', '') AS "item",
      COALESCE(tab.value->>'quantity', '') AS "quantity",
      COALESCE(tab.value->>'occasion', '') AS "occasion",
      COALESCE(tab.value->>'date', '') AS "date",
      tab.value->>'note' AS "note",
      (tab.ordinality - 1)::int AS "sort_order"
    FROM "sessions" s
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(s.custom_data->'tabarruk', '[]'::jsonb)) WITH ORDINALITY AS tab(value, ordinality)
    WHERE s.custom_data IS NOT NULL
    ON CONFLICT ("workspace_subdomain", "session_id", "id") DO NOTHING;

    -- Drop legacy jsonb column and gin index
    DROP INDEX IF EXISTS "sessions_custom_data_gin_idx";
    ALTER TABLE "sessions" DROP COLUMN "custom_data";
  END IF;
END $$;

-- 4. Create Indexes
CREATE INDEX IF NOT EXISTS "sessions_workspace_name_idx" ON "sessions" ("workspace_subdomain", "name");
CREATE INDEX IF NOT EXISTS "sessions_workspace_status_idx" ON "sessions" ("workspace_subdomain", "status");
CREATE INDEX IF NOT EXISTS "sessions_workspace_type_idx" ON "sessions" ("workspace_subdomain", "type");
CREATE INDEX IF NOT EXISTS "sessions_workspace_start_date_idx" ON "sessions" ("workspace_subdomain", "start_date");

CREATE INDEX IF NOT EXISTS "session_classes_workspace_session_idx" ON "session_classes" ("workspace_subdomain", "session_id");
CREATE INDEX IF NOT EXISTS "session_classes_workspace_teacher_idx" ON "session_classes" ("workspace_subdomain", "teacher_id");

CREATE INDEX IF NOT EXISTS "session_timetable_workspace_session_idx" ON "session_timetable" ("workspace_subdomain", "session_id");
CREATE INDEX IF NOT EXISTS "session_discounts_workspace_session_idx" ON "session_discounts" ("workspace_subdomain", "session_id");
CREATE INDEX IF NOT EXISTS "session_budget_expenses_workspace_session_idx" ON "session_budget_expenses" ("workspace_subdomain", "session_id");
CREATE INDEX IF NOT EXISTS "session_budget_incomes_workspace_session_idx" ON "session_budget_incomes" ("workspace_subdomain", "session_id");
CREATE INDEX IF NOT EXISTS "session_events_workspace_session_idx" ON "session_events" ("workspace_subdomain", "session_id");
CREATE INDEX IF NOT EXISTS "session_tabarruk_workspace_session_idx" ON "session_tabarruk" ("workspace_subdomain", "session_id");

-- 5. Force RLS across all 8 tables
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sessions" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sessions_tenant_isolation ON "sessions";
CREATE POLICY sessions_tenant_isolation ON "sessions" FOR ALL USING (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true)) WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true));

ALTER TABLE "session_classes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "session_classes" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS session_classes_tenant_isolation ON "session_classes";
CREATE POLICY session_classes_tenant_isolation ON "session_classes" FOR ALL USING (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true)) WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true));

ALTER TABLE "session_timetable" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "session_timetable" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS session_timetable_tenant_isolation ON "session_timetable";
CREATE POLICY session_timetable_tenant_isolation ON "session_timetable" FOR ALL USING (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true)) WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true));

ALTER TABLE "session_discounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "session_discounts" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS session_discounts_tenant_isolation ON "session_discounts";
CREATE POLICY session_discounts_tenant_isolation ON "session_discounts" FOR ALL USING (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true)) WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true));

ALTER TABLE "session_budget_expenses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "session_budget_expenses" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS session_budget_expenses_tenant_isolation ON "session_budget_expenses";
CREATE POLICY session_budget_expenses_tenant_isolation ON "session_budget_expenses" FOR ALL USING (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true)) WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true));

ALTER TABLE "session_budget_incomes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "session_budget_incomes" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS session_budget_incomes_tenant_isolation ON "session_budget_incomes";
CREATE POLICY session_budget_incomes_tenant_isolation ON "session_budget_incomes" FOR ALL USING (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true)) WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true));

ALTER TABLE "session_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "session_events" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS session_events_tenant_isolation ON "session_events";
CREATE POLICY session_events_tenant_isolation ON "session_events" FOR ALL USING (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true)) WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true));

ALTER TABLE "session_tabarruk" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "session_tabarruk" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS session_tabarruk_tenant_isolation ON "session_tabarruk";
CREATE POLICY session_tabarruk_tenant_isolation ON "session_tabarruk" FOR ALL USING (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true)) WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true));
