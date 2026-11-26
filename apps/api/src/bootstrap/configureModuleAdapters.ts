import { configureContactsKernelAdapters } from "../modules/contacts/adapters.js";
import { configureHasanatAdapters } from "../modules/hasanat/adapters.js";
import { configureMessagingAdapters } from "../modules/messaging/adapters.js";
import { configureBillingAdapters } from "../modules/billing/adapters.js";
import { configureStudentsAdapters } from "../modules/students/adapters.js";
import { configureSessionsAdapters } from "../modules/sessions/adapters.js";
import { configureEnrollmentsAdapters } from "../modules/enrollments/adapters.js";
import { configureFacultyAccountDeletionGuard } from "../modules/faculty/adapters.js";
import { configureAttendanceAdapters } from "../modules/attendance/adapters.js";
import { configureTasksAdapters } from "../modules/tasks/adapters.js";
import "../modules/accounting/configure.js";
import "../modules/examinations/configure.js";
import "../modules/obligations/configure.js";

let configured = false;

/**
 * Registers all vertical module kernel ports and adapters idempotently.
 * Called at server boot (`app.ts`) and before standalone scripts execute module repositories.
 */
export function configureModuleAdapters(): void {
  if (configured) return;
  configureContactsKernelAdapters();
  configureHasanatAdapters();
  configureMessagingAdapters();
  configureBillingAdapters();
  configureStudentsAdapters();
  configureSessionsAdapters();
  configureEnrollmentsAdapters();
  configureFacultyAccountDeletionGuard();
  configureAttendanceAdapters();
  configureTasksAdapters();
  configured = true;
}
