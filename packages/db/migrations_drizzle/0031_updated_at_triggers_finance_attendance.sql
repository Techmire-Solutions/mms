-- 0031_updated_at_triggers_finance_attendance.sql
-- Add missing updated_at auto-triggers for the three tables that received
-- custom_data expression indexes in migration 0030 but were omitted from
-- the trigger block.

DROP TRIGGER IF EXISTS update_finance_invoices_updated_at ON "finance_invoices";
CREATE TRIGGER update_finance_invoices_updated_at
BEFORE UPDATE ON "finance_invoices"
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_accounting_entries_updated_at ON "accounting_entries";
CREATE TRIGGER update_accounting_entries_updated_at
BEFORE UPDATE ON "accounting_entries"
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_attendance_updated_at ON "attendance";
CREATE TRIGGER update_attendance_updated_at
BEFORE UPDATE ON "attendance"
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
