import type { PermissionAction } from "./userEntityTypes.js";
import type { Permission } from "./permissions.js";

/** Pre-computed static evaluator map for $O(1)$ zero-allocation evaluation. */
export interface PermissionRule {
  readonly module: string;
  readonly requiredActions: readonly PermissionAction[];
  readonly fallbackModules?: readonly string[];
}

export const PERMISSION_RULES: Readonly<Record<Permission, PermissionRule>> = Object.freeze({
  // Contacts
  "contacts.read": { module: "contacts", requiredActions: ["read"] },
  "contacts.write": { module: "contacts", requiredActions: ["create", "update"] },
  "contacts.delete": { module: "contacts", requiredActions: ["delete"] },

  // Students
  "students.read": { module: "students", requiredActions: ["read"] },
  "students.write": { module: "students", requiredActions: ["create", "update"] },
  "students.delete": { module: "students", requiredActions: ["delete"] },
  "students.notes.read": { module: "students", requiredActions: ["read"] },
  "students.medical.read": { module: "students", requiredActions: ["manage"] },
  "students.iep.read": { module: "students", requiredActions: ["manage"] },
  "students.disciplinary.read": { module: "students", requiredActions: ["manage"] },

  // Faculty
  "faculty.read": { module: "faculty", requiredActions: ["read"] },
  "faculty.write": { module: "faculty", requiredActions: ["create", "update"] },
  "faculty.delete": { module: "faculty", requiredActions: ["delete"] },

  // Sessions
  "sessions.read": { module: "sessions", requiredActions: ["read"] },
  "sessions.write": { module: "sessions", requiredActions: ["create", "update"] },
  "sessions.delete": { module: "sessions", requiredActions: ["delete"] },
  // Overriding the lifecycle edit lock is full structural authority over a session,
  // so it tracks `delete` rather than ordinary `update` (mms-auth-security.md).
  // Closing/rollover/finalising a session is structural academic authority, not ordinary edit
  // rights: held by Academic Admins (admin/super_admin/principal) via the explicit `manage` action.
  "sessions.manage": { module: "sessions", requiredActions: ["manage"] },
  "sessions.override_lock": { module: "sessions", requiredActions: ["delete"] },

  // Attendance
  "attendance.read": { module: "attendance", requiredActions: ["read"] },
  "attendance.write": { module: "attendance", requiredActions: ["create", "update"] },
  "attendance.delete": { module: "attendance", requiredActions: ["delete"] },

  // Enrollments
  "enrollments.read": { module: "enrollments", requiredActions: ["read"] },
  "enrollments.write": { module: "enrollments", requiredActions: ["create", "update"] },
  "enrollments.delete": { module: "enrollments", requiredActions: ["delete"] },
  "enrollments.manage": { module: "enrollments", requiredActions: ["manage"] },

  // Hasanat Cards
  "hasanat.read": { module: "hasanat", requiredActions: ["read"] },
  "hasanat.write": { module: "hasanat", requiredActions: ["create", "update"] },
  "hasanat.delete": { module: "hasanat", requiredActions: ["delete"] },

  // Workshops
  "workshops.read": { module: "workshops", requiredActions: ["read"] },
  "workshops.write": { module: "workshops", requiredActions: ["create", "update"] },
  "workshops.delete": { module: "workshops", requiredActions: ["delete"] },
  "workshops.manage": { module: "workshops", requiredActions: ["manage"] },

  // Examinations
  "examinations.read": { module: "examinations", requiredActions: ["read"] },
  "examinations.write": { module: "examinations", requiredActions: ["create", "update"] },
  "examinations.delete": { module: "examinations", requiredActions: ["delete"] },

  // Question Bank
  "questionBank.read": { module: "questionBank", requiredActions: ["read"] },
  "questionBank.write": { module: "questionBank", requiredActions: ["create", "update"] },
  "questionBank.delete": { module: "questionBank", requiredActions: ["delete"] },

  // Finance & Accounting
  "finance.read": { module: "finance", requiredActions: ["read"] },
  "finance.write": { module: "finance", requiredActions: ["create", "update"] },
  "finance.delete": { module: "finance", requiredActions: ["delete"] },
  // Money-affecting billing decisions (cancel/void, credit note/waiver, fee
  // schedules) sit above ordinary write: a cashier who records payments must not
  // be able to waive them.
  "finance.manage": { module: "finance", requiredActions: ["manage"] },
  "accounting.read": { module: "accounting", requiredActions: ["read"] },
  "accounting.write": { module: "accounting", requiredActions: ["create", "update"] },
  "accounting.delete": { module: "accounting", requiredActions: ["delete"] },
  // Posting is its own action so draft-only roles are expressible.
  "accounting.post": { module: "accounting", requiredActions: ["post"] },
  // Period close, fiscal-year close and voucher-numbering configuration are
  // controller/admin authority, not ordinary voucher posting.
  "accounting.manage": { module: "accounting", requiredActions: ["manage"] },
  "obligations.read": { module: "obligations", requiredActions: ["read"] },
  "obligations.write": { module: "obligations", requiredActions: ["create", "update"] },
  "obligations.delete": { module: "obligations", requiredActions: ["delete"] },

  // Messaging
  "messaging.read": { module: "messaging", requiredActions: ["read"] },
  "messaging.write": { module: "messaging", requiredActions: ["create", "update"] },
  "messaging.clearLogs": { module: "messaging", requiredActions: ["delete"] },
  "messaging.restoreLogs": { module: "messaging", requiredActions: ["delete"] },

  // Tasks
  "tasks.read": { module: "tasks", requiredActions: ["read"] },
  "tasks.write": { module: "tasks", requiredActions: ["create", "update"] },
  "tasks.delete": { module: "tasks", requiredActions: ["delete"] },
  "tasks.assign": { module: "tasks", requiredActions: ["create", "update"] },
  "tasks.assign_anywhere": { module: "tasks.assign_anywhere", requiredActions: ["update"] },
  "tasks.complete": { module: "tasks", requiredActions: ["update"] },

  // Users & Administration
  "users.read": { module: "users", requiredActions: ["read"] },
  "users.manage": { module: "users", requiredActions: ["create", "update", "delete"] },
  // Audit governance is its own permission-only module: a dashboard read must
  // never authorize reading or erasing the security log.
  "audit.view": { module: "audit", requiredActions: ["read"] },
  "audit.manage": { module: "audit", requiredActions: ["create", "update", "delete"] },

  // System & Settings
  "analytics.view": {
    module: "dashboard",
    requiredActions: ["read"],
    fallbackModules: ["students"],
  },
  "configuration.view": { module: "settings", requiredActions: ["read"] },
  "settings.global.write": { module: "settings", requiredActions: ["create", "update"] },
  "settings.branding.write": { module: "settings", requiredActions: ["create", "update"] },
});
