import { initContract } from "@ts-rest/core";
import {
  studentContract,
  studentCrudContract,
  studentOperationsContract,
  studentCrudRoutes,
  studentOperationRoutes,
} from "./students.contract.js";
import { financeContract } from "./finance.contract.js";
import { attendanceContract } from "./attendance.contract.js";
import { contactsContract } from "./contacts.contract.js";
import { facultyContract } from "./faculty.contract.js";
import { userContract } from "./users.contract.js";
import { messagingContract } from "./messaging.contract.js";
import { sessionContract } from "./sessions.contract.js";
import {
  academicCatalogContract,
  examinationSubjectsContract,
} from "./academicCatalog.contract.js";
import { academicCalendarContract } from "./academicCalendar.contract.js";
import {
  admissionsContract,
  publicRegistrationContract,
  registrationLinksContract,
} from "./registration.contract.js";
import { sessionSectionsContract } from "./sessionSections.contract.js";
import { enrollmentOperationsContract } from "./enrollmentOperations.contract.js";
import { sessionLifecycleOpsContract } from "./sessionLifecycleOps.contract.js";
import { sessionRolloverContract } from "./sessionRollover.contract.js";
import { sessionCompletionContract } from "./sessionCompletion.contract.js";
import { questionBankContract } from "./questionBank.contract.js";
import { accountingContract } from "./accounting.contract.js";
import { hasanatContract } from "./hasanat.contract.js";
import { workshopsContract } from "./workshops.contract.js";
import { workshopsCompletionContract } from "./workshopsCompletion.contract.js";
import { obligationContract } from "./obligations.contract.js";
import { examinationContract } from "./examinations.contract.js";
import { enrollmentContract } from "./enrollments.contract.js";
import { dashboardContract } from "./dashboard.contract.js";
import { savedReportsContract } from "./savedReports.contract.js";
import { workspaceContract } from "./workspace.contract.js";
import { authContract } from "./auth.contract.js";
import { profileContract } from "./profile.contract.js";
import { publicContract } from "./public.contract.js";
import { aiContract } from "./ai.contract.js";
import { healthContract } from "./health.contract.js";
import { moduleAccessContract } from "./moduleAccess.contract.js";
import { auditContract } from "./audit.contract.js";
import { tasksContract } from "./tasks.contract.js";
import { accountingLedgerContract } from "./accountingLedger.contract.js";
import { accountingFxContract } from "./accountingFx.contract.js";
import { financeOpsContract } from "./financeOps.contract.js";
import {
  platformContract,
  platformWorkspacesContract,
  platformSettingsContract,
  platformAdminsContract,
} from "./platform.contract.js";
import { documentTemplatesContract } from "./documentTemplates.contract.js";

const c = initContract();

export const rootContract = c.router({
  students: studentContract,
  finance: financeContract,
  attendance: attendanceContract,
  contacts: contactsContract,
  faculty: facultyContract,
  users: userContract,
  messaging: messagingContract,
  sessions: sessionContract,
  academicCatalogs: academicCatalogContract,
  examinationSubjects: examinationSubjectsContract,
  academicCalendar: academicCalendarContract,
  registrationLinks: registrationLinksContract,
  admissions: admissionsContract,
  enrollmentOperations: enrollmentOperationsContract,
  sessionLifecycleOps: sessionLifecycleOpsContract,
  sessionRollover: sessionRolloverContract,
  sessionCompletion: sessionCompletionContract,
  publicRegistration: publicRegistrationContract,
  sessionSections: sessionSectionsContract,
  questionBank: questionBankContract,
  accounting: accountingContract,
  hasanat: hasanatContract,
  workshops: workshopsContract,
  workshopsCompletion: workshopsCompletionContract,
  obligations: obligationContract,
  examinations: examinationContract,
  enrollments: enrollmentContract,
  dashboard: dashboardContract,
  savedReports: savedReportsContract,
  workspace: workspaceContract,
  auth: authContract,
  profile: profileContract,
  public: publicContract,
  ai: aiContract,
  health: healthContract,
  moduleAccess: moduleAccessContract,
  audit: auditContract,
  tasks: tasksContract,
  accountingLedger: accountingLedgerContract,
  accountingFx: accountingFxContract,
  financeOps: financeOpsContract,
  platform: platformContract,
  templates: documentTemplatesContract,
});

export type RootContract = typeof rootContract;

/**
 * Per-domain contracts, re-exported so consumers can type a single domain
 * at a time. The full `rootContract` (22 domains × ~350 endpoints) exceeds
 * TS's union-instantiation depth limit — domain-scoped resolution keeps
 * compile-time types intact (see apps/frontend/src/lib/api.ts `tsr` accessor).
 */
export {
  studentContract,
  studentCrudContract,
  studentOperationsContract,
  studentCrudRoutes,
  studentOperationRoutes,
  financeContract,
  attendanceContract,
  contactsContract,
  facultyContract,
  userContract,
  messagingContract,
  sessionContract,
  academicCatalogContract,
  examinationSubjectsContract,
  academicCalendarContract,
  registrationLinksContract,
  admissionsContract,
  enrollmentOperationsContract,
  sessionLifecycleOpsContract,
  sessionRolloverContract,
  sessionCompletionContract,
  publicRegistrationContract,
  sessionSectionsContract,
  questionBankContract,
  accountingContract,
  hasanatContract,
  workshopsContract,
  workshopsCompletionContract,
  obligationContract,
  examinationContract,
  enrollmentContract,
  dashboardContract,
  savedReportsContract,
  workspaceContract,
  authContract,
  profileContract,
  publicContract,
  aiContract,
  healthContract,
  moduleAccessContract,
  auditContract,
  tasksContract,
  accountingLedgerContract,
  accountingFxContract,
  financeOpsContract,
  platformContract,
  platformWorkspacesContract,
  platformSettingsContract,
  platformAdminsContract,
  documentTemplatesContract,
};
export type DomainContracts = {
  students: typeof studentContract;
  finance: typeof financeContract;
  attendance: typeof attendanceContract;
  contacts: typeof contactsContract;
  faculty: typeof facultyContract;
  users: typeof userContract;
  messaging: typeof messagingContract;
  sessions: typeof sessionContract;
  academicCatalogs: typeof academicCatalogContract;
  examinationSubjects: typeof examinationSubjectsContract;
  academicCalendar: typeof academicCalendarContract;
  registrationLinks: typeof registrationLinksContract;
  admissions: typeof admissionsContract;
  enrollmentOperations: typeof enrollmentOperationsContract;
  sessionLifecycleOps: typeof sessionLifecycleOpsContract;
  sessionRollover: typeof sessionRolloverContract;
  sessionCompletion: typeof sessionCompletionContract;
  publicRegistration: typeof publicRegistrationContract;
  sessionSections: typeof sessionSectionsContract;
  questionBank: typeof questionBankContract;
  accounting: typeof accountingContract;
  hasanat: typeof hasanatContract;
  workshops: typeof workshopsContract;
  workshopsCompletion: typeof workshopsCompletionContract;
  obligations: typeof obligationContract;
  examinations: typeof examinationContract;
  enrollments: typeof enrollmentContract;
  dashboard: typeof dashboardContract;
  savedReports: typeof savedReportsContract;
  workspace: typeof workspaceContract;
  auth: typeof authContract;
  profile: typeof profileContract;
  public: typeof publicContract;
  ai: typeof aiContract;
  health: typeof healthContract;
  moduleAccess: typeof moduleAccessContract;
  audit: typeof auditContract;
  tasks: typeof tasksContract;
  accountingLedger: typeof accountingLedgerContract;
  accountingFx: typeof accountingFxContract;
  financeOps: typeof financeOpsContract;
  platform: typeof platformContract;
  templates: typeof documentTemplatesContract;
};
