/** System module registry + settings-nav grouping (mirrors sidebar modules). */
import type { AppTranslationKey } from "./appTranslations.js";

/** Definition for an application module. */
export interface ModuleDefinition {
  id: string;
  label: string;
  description: string;
  icon: string;
  category: "core" | "academic" | "admin" | "finance";
  required?: boolean;
}

/** All toggleable modules — ids align with sidebar `moduleId` in navConfig. */
export const SYSTEM_MODULES: ModuleDefinition[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    description: "Central overview and analytics",
    icon: "LayoutDashboard",
    category: "core",
    required: true,
  },
  {
    id: "contacts",
    label: "Contacts",
    description: "Comprehensive CRM directory",
    icon: "Users",
    category: "core",
    required: true,
  },
  {
    id: "messaging",
    label: "Messaging",
    description: "SMS, WhatsApp and announcements",
    icon: "MessageSquare",
    category: "core",
    required: true,
  },
  {
    id: "tasks",
    label: "Tasks",
    description: "Task delegation and tracking",
    icon: "CheckSquare",
    category: "core",
  },
  {
    id: "students",
    label: "Students",
    description: "Student directory and records",
    icon: "GraduationCap",
    category: "academic",
    required: true,
  },
  {
    id: "faculty",
    label: "Faculty",
    description: "Faculty directory and assignments",
    icon: "School",
    category: "academic",
  },
  {
    id: "sessions",
    label: "Sessions",
    description: "Classes, schedules and timetables",
    icon: "Calendar",
    category: "academic",
  },
  {
    id: "attendance",
    label: "Attendance",
    description: "Tracking and reporting",
    icon: "UserCheck",
    category: "academic",
  },
  {
    id: "enrollment",
    label: "Enrollments",
    description: "Student enrollment into sessions",
    icon: "ClipboardList",
    category: "academic",
  },
  {
    id: "hasanat",
    label: "Hasanat Cards",
    description: "Incentive and reward points",
    icon: "Star",
    category: "academic",
  },
  {
    id: "examination",
    label: "Examinations",
    description: "Testing and grading systems",
    icon: "FileText",
    category: "academic",
  },
  {
    id: "questionBank",
    label: "Question Bank",
    description: "Question repository and test papers",
    icon: "Library",
    category: "academic",
  },
  {
    id: "finance",
    label: "Finance",
    description: "Invoicing and fee management",
    icon: "DollarSign",
    category: "finance",
  },
  {
    id: "accounting",
    label: "Accounting",
    description: "General ledger and reports",
    icon: "TrendingUp",
    category: "finance",
  },
  {
    id: "obligations",
    label: "Obligations",
    description: "Religious obligations and funds",
    icon: "Scale",
    category: "finance",
  },
  {
    id: "users",
    label: "Users",
    description: "Role-based permissions and access",
    icon: "UserCog",
    category: "admin",
    required: true,
  },
];

/** Lookup map for module definitions by id. */
export const SYSTEM_MODULES_BY_ID: Record<string, ModuleDefinition> = Object.fromEntries(
  SYSTEM_MODULES.map((m) => [m.id, m]),
);

/** Standalone module entry in the system-modules settings nav. */
export interface SystemModuleNavItem {
  type: "module";
  moduleId: string;
}

/** Grouped modules — mirrors grouped sections in app navigation. */
export interface SystemModuleNavGroup {
  type: "group";
  labelKey: AppTranslationKey;
  icon: string;
  moduleIds: string[];
}

export type SystemModuleNavEntry = SystemModuleNavItem | SystemModuleNavGroup;

/**
 * Settings-page layout for system modules — mirrors `NAV_ITEMS` grouping:
 * standalone items plus an Academics group for academic sub-modules.
 */
export const SYSTEM_MODULE_NAV: SystemModuleNavEntry[] = [
  { type: "module", moduleId: "dashboard" },
  { type: "module", moduleId: "contacts" },
  { type: "module", moduleId: "tasks" },
  { type: "module", moduleId: "faculty" },
  { type: "module", moduleId: "messaging" },
  {
    type: "group",
    labelKey: "nav.academics",
    icon: "BookOpen",
    moduleIds: [
      "students",
      "sessions",
      "attendance",
      "enrollment",
      "hasanat",
      "examination",
      "questionBank",
    ],
  },
  { type: "module", moduleId: "finance" },
  { type: "module", moduleId: "accounting" },
  { type: "module", moduleId: "obligations" },
  { type: "module", moduleId: "users" },
];
