-- 0030_schema_performance_and_audit_triggers.sql
-- Modern PostgreSQL Best Practices: Automatic updated_at Triggers, Fast Expression Indexes, and Dynamic Table Hardening

-- 1. Automatic updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Expression & JSONB Path Indexes for Hot Search Routes
CREATE INDEX IF NOT EXISTS "contacts_custom_data_phone_idx"
  ON "contacts" ((custom_data->>'phone'))
  WHERE "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "contacts_custom_data_email_idx"
  ON "contacts" ((custom_data->>'email'))
  WHERE "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "accounting_entries_custom_data_date_idx"
  ON "accounting_entries" ((custom_data->>'date'));

CREATE INDEX IF NOT EXISTS "finance_invoices_custom_data_due_date_idx"
  ON "finance_invoices" ((custom_data->>'dueDate'));

CREATE INDEX IF NOT EXISTS "attendance_custom_data_date_idx"
  ON "attendance" ((custom_data->>'date'));

-- 3. Automatic Triggers for Core Entities
DROP TRIGGER IF EXISTS update_contacts_updated_at ON "contacts";
CREATE TRIGGER update_contacts_updated_at
BEFORE UPDATE ON "contacts"
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_students_updated_at ON "students";
CREATE TRIGGER update_students_updated_at
BEFORE UPDATE ON "students"
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_teachers_updated_at ON "teachers";
CREATE TRIGGER update_teachers_updated_at
BEFORE UPDATE ON "teachers"
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tenant_users_updated_at ON "tenant_users";
CREATE TRIGGER update_tenant_users_updated_at
BEFORE UPDATE ON "tenant_users"
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_workspaces_updated_at ON "workspaces";
CREATE TRIGGER update_workspaces_updated_at
BEFORE UPDATE ON "workspaces"
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
