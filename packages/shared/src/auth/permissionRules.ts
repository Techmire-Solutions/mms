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
  "sessions.override_lock": { module: "sessions", requiredActions: ["delete"] },

  // Attendance
  "attendance.read": { module: "attendance", requiredActions: ["read"] },
  "attendance.write": { module: "attendance", requiredActions: ["create", "update"] },
  "attendance.delete": { module: "attendance", requiredActions: ["delete"] },

  // Enrollments
  "enrollments.read": { module: "enrollments", requiredActions: ["read"] },
  "enrollments.write": { module: "enrollments", requiredActions: ["create", "update"] },
  "enrollments.delete": { module: "enrollments", requiredActions: ["delete"] },

  // Hasanat Cards
  "hasanat.read": { module: "hasanat", requiredActions: ["read"] },
  "hasanat.write": { module: "hasanat", requiredActions: ["create", "update"] },
  "hasanat.delete": { module: "hasanat", requiredActions: ["delete"] },

  // Workshops
  "workshops.read": { module: "workshops", requiredActions: ["read"] },
  "workshops.write": { module: "workshops", requiredActions: ["create", "update"] },
  "workshops.delete": { module: "workshops", requiredActions: ["delete"] },

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
  "accounting.read": { module: "accounting", requiredActions: ["read"] },
  "accounting.write": { module: "accounting", requiredActions: ["create", "update"] },
  "accounting.delete": { module: "accounting", requiredActions: ["delete"] },
  "obligations.read": { module: "obligations", requiredActions: ["read"] },
  "obligations.write": { module: "obligations", requiredActions: ["create", "update"] },
  "obligations.delete": { module: "obligations", requiredActions: ["delete"] },

  // Messaging
  "messaging.read": { module: "messaging", requiredActions: ["read"] },
  "messaging.write": { module: "messaging", requiredActions: ["create", "update"] },
  "messaging.clearLogs": { module: "messaging", requiredActions: ["delete"] },

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
