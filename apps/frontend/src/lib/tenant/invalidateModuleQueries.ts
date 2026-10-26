import type { QueryClient } from "@tanstack/react-query";
import { invalidateContactsQueries } from "@/tenant/hooks/collections/contacts";
import { invalidateEnrollmentsQueries } from "@/tenant/hooks/collections/enrollments";
import { invalidateMessagingQueries } from "@/tenant/hooks/collections/messaging";
import { invalidateSessionsQueries } from "@/tenant/hooks/collections/sessions";
import { invalidateAcademicCatalogQueries } from "@/lib/query/academicCatalogQueries";
import { invalidateAcademicCalendarQueries } from "@/lib/query/academicCalendarQueries";
import { invalidateRegistrationQueries } from "@/lib/query/registrationQueries";
import { invalidateStoredNotificationsQueries } from "@/lib/query/notificationQueries";
import { invalidateStudentsQueries } from "@/tenant/hooks/collections/students";
import { invalidateFacultyQueries } from "@/tenant/hooks/collections/faculty";
import { invalidateUsersQueries } from "@/tenant/hooks/collections/users";
import { invalidateAttendanceQueries } from "@/tenant/hooks/collections/attendance";
import { invalidateFinanceQueries } from "@/tenant/hooks/collections/finance";
import { invalidateHasanatQueries } from "@/tenant/hooks/collections/hasanat";
import { invalidateWorkshopsQueries } from "@/tenant/hooks/collections/workshops";
import { invalidateExaminationsQueries } from "@/tenant/hooks/collections/examinations";
import { invalidateQuestionBankQueries } from "@/tenant/hooks/collections/questionBank";
import { invalidateAccountingQueries } from "@/tenant/hooks/collections/accounting";
import { invalidateObligationsQueries } from "@/tenant/hooks/collections/obligations";
import { invalidateDocumentTemplatesQueries } from "@/lib/templates/useDocumentTemplates";
import {
  DASHBOARD_SUMMARY_QUERY_KEY_ROOT,
  invalidateDashboardQueries,
} from "@/tenant/hooks/collections/dashboard";

/**
 * Dynamically loaded dispatcher for live WebSocket collection invalidations.
 * Kept in an isolated chunk so the WebSocket listener hook does not statically
 * bundle all 15 module query invalidators into the initial entry path.
 */
export function invalidateModuleQueries(queryClient: QueryClient, key: string): void {
  // Invalidate composite dashboard summary metrics when domain collections change
  if (
    key !== "dashboard" &&
    key !== "notifications" &&
    key !== "user_activity_logs" &&
    key !== "message_logs" &&
    key !== "message_templates"
  ) {
    void queryClient.invalidateQueries({ queryKey: DASHBOARD_SUMMARY_QUERY_KEY_ROOT });
  }

  switch (key) {
    case "contacts":
      return invalidateContactsQueries(queryClient);
    case "students":
      return invalidateStudentsQueries(queryClient);
    case "faculty":
      return invalidateFacultyQueries(queryClient);
    case "sessions":
      return invalidateSessionsQueries(queryClient);
    case "academic_catalogs":
      return invalidateAcademicCatalogQueries(queryClient);
    case "registration_links":
    case "registration_applications":
      // Approvals also create students and enrollments.
      invalidateStudentsQueries(queryClient);
      invalidateEnrollmentsQueries(queryClient);
      return invalidateRegistrationQueries(queryClient);
    case "academic_calendar":
      // Holidays change attendance rates.
      invalidateAcademicCalendarQueries(queryClient);
      return invalidateAttendanceQueries(queryClient);
    case "enrollments":
      // Enrollments drive student session membership and class/section counts (server-derived).
      invalidateStudentsQueries(queryClient);
      invalidateSessionsQueries(queryClient);
      return invalidateEnrollmentsQueries(queryClient);
    case "users":
    case "user_activity_logs":
      return invalidateUsersQueries(queryClient);
    case "attendance":
    case "attendance_records":
      return invalidateAttendanceQueries(queryClient);
    case "finance":
    case "finance_invoices":
    case "finance_payments":
      return invalidateFinanceQueries(queryClient);
    case "hasanat":
    case "hasanat_distributions":
    case "hasanat_denoms":
    case "hasanat_batches":
    case "hasanat_redemptions":
      return invalidateHasanatQueries(queryClient);
    case "workshops":
    case "workshop_events":
      return invalidateWorkshopsQueries(queryClient);
    case "examinations":
    case "exams":
    case "exam_results":
      return invalidateExaminationsQueries(queryClient);
    case "questionBank":
    case "questions":
    case "tests":
    case "assessment_results":
      return invalidateQuestionBankQueries(queryClient);
    // Ledger-op collections the accounting routes actually broadcast
    // (posting rules, opening balances, bank statements, reconciliations).
    // Omitting them left other clients' changes invisible until a reload.
    case "accounting":
    case "accounting_entries":
    case "accounting_accounts":
    case "accounting_fiscal_years":
    case "accounting_posting_rules":
    case "accounting_voucher_numbering":
    case "accounting_opening_balances":
    case "accounting_bank_statements":
    case "accounting_bank_reconciliations":
      return invalidateAccountingQueries(queryClient);
    case "obligations":
    case "obligation_collections":
    case "obligation_types":
    case "mujtahids":
    case "mujtahid_reps":
    case "wakala_types":
    case "obligation_distributions":
      return invalidateObligationsQueries(queryClient);
    case "dashboard":
      return invalidateDashboardQueries(queryClient);
    case "messaging":
    case "message_logs":
    case "message_templates":
      return invalidateMessagingQueries(queryClient);
    case "document_templates":
      return invalidateDocumentTemplatesQueries(queryClient);
    case "notifications":
      return invalidateStoredNotificationsQueries(queryClient);
  }
}
