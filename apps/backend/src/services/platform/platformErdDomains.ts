import type { AppTranslationKey, ErdDomainId } from "@mms/contracts";
import * as platformSchema from "@mms/db/schema/platform";
import * as systemSchema from "@mms/db/schema/system";
import * as auditTrailSchema from "@mms/db/schema/auditTrail";
import * as contactsSchema from "@mms/db/schema/contacts";
import * as studentsSchema from "@mms/db/schema/students";
import * as facultySchema from "@mms/db/schema/faculty";
import * as sessionsSchema from "@mms/db/schema/sessions";
import * as attendanceSchema from "@mms/db/schema/attendance";
import * as enrollmentsSchema from "@mms/db/schema/enrollments";
import * as financeSchema from "@mms/db/schema/finance";
import * as financeBillingSchema from "@mms/db/schema/financeBilling";
import * as financeCollectSchema from "@mms/db/schema/financeCollect";
import * as accountingSchema from "@mms/db/schema/accounting";
import * as accountingLedgerOpsSchema from "@mms/db/schema/accountingLedgerOps";
import * as examinationExamSchema from "@mms/db/schema/examinationExamTables";
import * as examinationQuestionBankSchema from "@mms/db/schema/examinationQuestionBankTables";
import * as obligationsSchema from "@mms/db/schema/obligations";
import * as hasanatSchema from "@mms/db/schema/hasanat";
import * as messagingSchema from "@mms/db/schema/messaging";
import * as inventorySchema from "@mms/db/schema/inventory";
import * as charitySchema from "@mms/db/schema/charity";
import * as workshopsSchema from "@mms/db/schema/workshops";
import * as workshopActivitySchema from "@mms/db/schema/workshopActivityTables";
import * as tasksSchema from "@mms/db/schema/tasksTables";
import * as taskSettingsSchema from "@mms/db/schema/taskSettingsTables";
import * as usersSchema from "@mms/db/schema/users";
import * as dashboardSchema from "@mms/db/schema/dashboard";
import * as outboxSchema from "@mms/db/schema/outboxEvents";

export interface DomainConfig {
  id: ErdDomainId;
  labelKey: AppTranslationKey;
  modules: readonly Record<string, unknown>[];
}

export const DOMAIN_REGISTRY: readonly DomainConfig[] = [
  {
    id: "accounting",
    labelKey: "nav.accounting",
    modules: [accountingSchema, accountingLedgerOpsSchema],
  },
  {
    id: "attendance",
    labelKey: "nav.attendance",
    modules: [attendanceSchema],
  },
  {
    id: "charity",
    labelKey: "platform.erdDomainCharity",
    modules: [charitySchema],
  },
  {
    id: "contacts",
    labelKey: "nav.contacts",
    modules: [contactsSchema],
  },
  {
    id: "dashboard",
    labelKey: "nav.dashboard",
    modules: [dashboardSchema],
  },
  {
    id: "enrollments",
    labelKey: "nav.enrollments",
    modules: [enrollmentsSchema],
  },
  {
    id: "examinations",
    labelKey: "nav.examinations",
    modules: [examinationExamSchema],
  },
  {
    id: "faculty",
    labelKey: "nav.faculty",
    modules: [facultySchema],
  },
  {
    id: "finance",
    labelKey: "nav.finance",
    modules: [financeSchema, financeBillingSchema, financeCollectSchema],
  },
  {
    id: "hasanat",
    labelKey: "nav.hasanatCards",
    modules: [hasanatSchema],
  },
  {
    id: "inventory",
    labelKey: "platform.erdDomainInventory",
    modules: [inventorySchema],
  },
  {
    id: "messaging",
    labelKey: "nav.messaging",
    modules: [messagingSchema],
  },
  {
    id: "obligations",
    labelKey: "nav.obligations",
    modules: [obligationsSchema],
  },

  {
    id: "outbox",
    labelKey: "platform.erdDomainOutbox",
    modules: [outboxSchema],
  },
  {
    id: "platform",
    labelKey: "platform.erdDomainPlatform",
    modules: [platformSchema],
  },
  {
    id: "questionBank",
    labelKey: "nav.questionBank",
    modules: [examinationQuestionBankSchema],
  },
  {
    id: "sessions",
    labelKey: "nav.sessions",
    modules: [sessionsSchema],
  },
  {
    id: "students",
    labelKey: "nav.students",
    modules: [studentsSchema],
  },
  {
    id: "system",
    labelKey: "platform.erdDomainSystem",
    modules: [systemSchema, auditTrailSchema],
  },
  {
    id: "tasks",
    labelKey: "nav.tasks",
    modules: [tasksSchema, taskSettingsSchema],
  },
  {
    id: "users",
    labelKey: "nav.users",
    modules: [usersSchema],
  },
  {
    id: "workshops",
    labelKey: "platform.erdDomainWorkshops",
    modules: [workshopsSchema, workshopActivitySchema],
  },
];
