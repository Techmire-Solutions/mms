import type { AppTranslationKey, ErdDomainId } from "@mms/shared";
import * as platformSchema from "../../db/schema/platform.js";
import * as systemSchema from "../../db/schema/system.js";
import * as auditTrailSchema from "../../db/schema/auditTrail.js";
import * as contactsSchema from "../../db/schema/contacts.js";
import * as studentsSchema from "../../db/schema/students.js";
import * as facultySchema from "../../db/schema/faculty.js";
import * as sessionsSchema from "../../db/schema/sessions.js";
import * as attendanceSchema from "../../db/schema/attendance.js";
import * as enrollmentsSchema from "../../db/schema/enrollments.js";
import * as financeSchema from "../../db/schema/finance.js";
import * as financeBillingSchema from "../../db/schema/financeBilling.js";
import * as financeCollectSchema from "../../db/schema/financeCollect.js";
import * as accountingSchema from "../../db/schema/accounting.js";
import * as accountingLedgerOpsSchema from "../../db/schema/accountingLedgerOps.js";
import {
  assessmentAnswers,
  assessmentResults,
  examClasses,
  examResults,
  exams,
  questionCategories,
  questionCitations,
  questionOptions,
  questionTags,
  questions,
  testQuestions,
  testSectionQuestions,
  testSections,
  tests,
} from "../../db/schema/examinations.js";

/** Domain groupings of the canonical examinations schema (`db/schema/examinations.ts`). */
const examinationExamSchema = { exams, examClasses, examResults };
const examinationQuestionBankSchema = {
  questions,
  questionCategories,
  questionOptions,
  questionTags,
  questionCitations,
  tests,
  testQuestions,
  testSections,
  testSectionQuestions,
  assessmentResults,
  assessmentAnswers,
};
import * as obligationsSchema from "../../db/schema/obligations.js";
import * as hasanatSchema from "../../db/schema/hasanat.js";
import * as messagingSchema from "../../db/schema/messaging.js";
import * as inventorySchema from "../../db/schema/inventory.js";
import * as charitySchema from "../../db/schema/charity.js";
import * as workshopsSchema from "../../db/schema/workshops.js";
import * as tasksSchema from "../../db/schema/tasksTables.js";
import * as taskSettingsSchema from "../../db/schema/taskSettingsTables.js";
import * as usersSchema from "../../db/schema/users.js";
import * as dashboardSchema from "../../db/schema/dashboard.js";
import * as outboxSchema from "../../db/schema/outboxEvents.js";

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
    modules: [workshopsSchema],
  },
];
