-- 0257_notification_kinds_finance_accounting.sql
-- Forward-only. Extends the tenant_notifications kind CHECK to the kinds the code
-- already writes — see docs/accounting-background-workers-audit-2026-11-13.md.
--
-- Why this exists
-- ---------------
-- The constraint was last set by 0220 to the three attendance/waitlist kinds. The
-- scheduled finance sweep already inserts `finance_invoices_overdue`, which the
-- CHECK rejects; `notificationsUseCases.notify` catches the failure and only logs a
-- warning, so overdue alerts were silently dropped. This migration admits that
-- existing kind and the new `accounting_automation_failed` kind the accounting
-- sweep now records when a month-end revaluation/IAS 29 restatement fails.

SET LOCAL lock_timeout = '2s';

DO $$
BEGIN
  ALTER TABLE "tenant_notifications" DROP CONSTRAINT IF EXISTS "tenant_notifications_kind_check";
  ALTER TABLE "tenant_notifications" ADD CONSTRAINT "tenant_notifications_kind_check"
    CHECK ("kind" IN (
      'waitlist_seat_offered',
      'attendance_leave_decided',
      'attendance_chronic_absence',
      'finance_invoices_overdue',
      'accounting_automation_failed'
    ));
END $$;
