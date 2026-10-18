/**
 * @file moduleTransferRegistry.ts
 * @description Centralized registry and coverage catalog for module data transfer schemas.
 *
 * Scans and tracks all form-containing modules across the MMS workspace, their
 * implementation status, form surfaces, and attached SSOT transfer schemas.
 */

import type { ModuleTransferSchema } from "../core/moduleTransferSchema.js";

export type ModuleTransferStatus = "implemented" | "planned";
export type MigrationPriority = "P1" | "P2" | "P3";

export interface ModuleTransferCoverageRecord {
  readonly moduleId: string;
  readonly moduleTitle: string;
  readonly entityNounPlural: string;
  readonly status: ModuleTransferStatus;
  readonly migrationPriority: MigrationPriority;
  readonly formSurfaces: readonly string[];
  schema?: ModuleTransferSchema<unknown>;
}

const MODULE_TRANSFER_COVERAGE: ModuleTransferCoverageRecord[] = [
  {
    moduleId: "contacts",
    moduleTitle: "Contacts",
    entityNounPlural: "contacts",
    status: "implemented",
    migrationPriority: "P1",
    formSurfaces: [
      "Identity",
      "Phones",
      "Emails",
      "Addresses",
      "Socials",
      "Education",
      "Experience",
      "Skills",
      "Relationships",
      "Bank",
    ],
  },
  {
    moduleId: "students",
    moduleTitle: "Students",
    entityNounPlural: "students",
    status: "implemented",
    migrationPriority: "P1",
    formSurfaces: [
      "Personal",
      "Guardians",
      "Academic",
      "Fee Structure",
      "Emergency",
      "Custom Fields",
    ],
  },
  {
    moduleId: "faculty",
    moduleTitle: "Faculty",
    entityNounPlural: "faculty members",
    status: "implemented",
    migrationPriority: "P1",
    formSurfaces: [
      "Profile",
      "Designation",
      "Department",
      "Employment",
      "Qualifications",
      "User Link",
    ],
  },
  {
    moduleId: "sessions",
    moduleTitle: "Sessions",
    entityNounPlural: "sessions",
    status: "implemented",
    migrationPriority: "P1",
    formSurfaces: ["Session Details", "Classes", "Faculty Assignment", "Capacity & Pricing"],
  },
  {
    moduleId: "enrollments",
    moduleTitle: "Enrollments",
    entityNounPlural: "enrollments",
    status: "implemented",
    migrationPriority: "P1",
    formSurfaces: [
      "Student Selection",
      "Session Selection",
      "Class Selection",
      "Discount & Billing",
    ],
  },
  {
    moduleId: "users",
    moduleTitle: "Users",
    entityNounPlural: "users",
    status: "implemented",
    migrationPriority: "P2",
    formSurfaces: ["User Account", "Role & Permissions", "Authentication & 2FA"],
  },
  {
    moduleId: "questionBank",
    moduleTitle: "Question Bank",
    entityNounPlural: "questions",
    status: "implemented",
    migrationPriority: "P2",
    formSurfaces: ["Question Stem", "Answer Choices", "Taxonomy & Category", "Source Citation"],
  },
  {
    moduleId: "accounting",
    moduleTitle: "Accounting",
    entityNounPlural: "accounts",
    status: "implemented",
    migrationPriority: "P2",
    formSurfaces: ["Chart of Accounts", "Journal Voucher", "Subledger Entries"],
  },
  {
    moduleId: "finance",
    moduleTitle: "Finance",
    entityNounPlural: "invoices",
    status: "implemented",
    migrationPriority: "P2",
    formSurfaces: ["Invoice Generation", "Fee Collection Receipt", "Payment Terms"],
  },
  {
    moduleId: "attendance",
    moduleTitle: "Attendance",
    entityNounPlural: "attendance records",
    status: "implemented",
    migrationPriority: "P3",
    formSurfaces: ["Daily Attendance Register", "Excuse Notes", "Session Timetable"],
  },
  {
    moduleId: "examinations",
    moduleTitle: "Examinations",
    entityNounPlural: "examinations",
    status: "implemented",
    migrationPriority: "P3",
    formSurfaces: ["Exam Schedule", "Marks Entry", "Grading Scale"],
  },
  {
    moduleId: "hasanat",
    moduleTitle: "Hasanat",
    entityNounPlural: "hasanat deeds",
    status: "implemented",
    migrationPriority: "P3",
    formSurfaces: ["Deed Entry", "Activity Categorization", "Point Allocation"],
  },
  {
    moduleId: "obligations",
    moduleTitle: "Obligations",
    entityNounPlural: "obligations",
    status: "implemented",
    migrationPriority: "P3",
    formSurfaces: ["Wakala Obligations", "Representative Assignment", "Dues Receipt"],
  },
  {
    moduleId: "tasks",
    moduleTitle: "Tasks",
    entityNounPlural: "tasks",
    status: "implemented",
    migrationPriority: "P3",
    formSurfaces: ["Task Creator", "Assignee Link", "Due Date & Priority"],
  },
  {
    moduleId: "messaging",
    moduleTitle: "Messaging",
    entityNounPlural: "templates",
    status: "implemented",
    migrationPriority: "P3",
    formSurfaces: ["Message Composer", "Campaign Builder", "Template Variables"],
  },
];

const schemaRegistry = new Map<string, ModuleTransferSchema<unknown>>();

export function registerModuleTransferSchema<T = unknown>(schema: ModuleTransferSchema<T>): void {
  schemaRegistry.set(schema.moduleId, schema as unknown as ModuleTransferSchema<unknown>);
  const entry = MODULE_TRANSFER_COVERAGE.find((item) => item.moduleId === schema.moduleId);
  if (entry) {
    (entry as { status: ModuleTransferStatus }).status = "implemented";
    entry.schema = schema as unknown as ModuleTransferSchema<unknown>;
  }
}

export function getAllModuleTransferCoverage(): readonly ModuleTransferCoverageRecord[] {
  return MODULE_TRANSFER_COVERAGE.map((entry) => ({
    ...entry,
    schema: entry.schema ?? schemaRegistry.get(entry.moduleId),
    status: schemaRegistry.has(entry.moduleId) ? "implemented" : entry.status,
  }));
}

export function getModuleTransferCoverage(
  moduleId: string,
): ModuleTransferCoverageRecord | undefined {
  const item = MODULE_TRANSFER_COVERAGE.find((entry) => entry.moduleId === moduleId);
  if (!item) return undefined;
  return {
    ...item,
    schema: item.schema ?? schemaRegistry.get(item.moduleId),
    status: schemaRegistry.has(item.moduleId) ? "implemented" : item.status,
  };
}

export function getModuleTransferSchema<T = Record<string, unknown>>(
  moduleId: string,
): ModuleTransferSchema<T> | undefined {
  return schemaRegistry.get(moduleId) as unknown as ModuleTransferSchema<T> | undefined;
}

export function isModuleTransferImplemented(moduleId: string): boolean {
  return schemaRegistry.has(moduleId);
}
