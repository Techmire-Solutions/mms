import type { AppTranslationKey, Permission } from "@mms/shared";
import {
  ACCOUNTING_MODULE_MANIFEST,
  ATTENDANCE_MODULE_MANIFEST,
  ENROLLMENTS_MODULE_MANIFEST,
  FINANCE_MODULE_MANIFEST,
  HASANAT_MODULE_MANIFEST,
  SESSIONS_MODULE_MANIFEST,
} from "@mms/shared";
import {
  UserPlus,
  CalendarPlus,
  DollarSign,
  Star,
  FileText,
  Printer,
  BarChart3,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import { ROUTES } from "@/lib/config/routes";
import type { DashboardRole } from "@/lib/dashboardRole";

export type QuickActionColor = "emerald" | "blue" | "amber" | "violet" | "slate";

export interface DashboardQuickAction {
  id: string;
  labelKey: AppTranslationKey;
  descKey: AppTranslationKey;
  icon: LucideIcon;
  color: QuickActionColor;
  /** Settings → System Modules key (must match enabledModules). */
  moduleId: string;
  permission: Permission;
  route: string;
  roles: readonly DashboardRole[];
}

/**
 * Single SSOT for dashboard quick actions (labels, routes, modules, permissions).
 * Role panels filter by `roles`; enabledModules + `can()` filter the rest.
 */
export const DASHBOARD_QUICK_ACTIONS: readonly DashboardQuickAction[] = [
  {
    id: "add-student",
    labelKey: "action.addStudent",
    descKey: "action.addStudentDesc",
    icon: UserPlus,
    color: "emerald",
    moduleId: "enrollment",
    permission: ENROLLMENTS_MODULE_MANIFEST.permissions.write,
    route: ROUTES.enrollments,
    roles: ["admin", "faculty"],
  },
  {
    id: "create-session",
    labelKey: "action.createSession",
    descKey: "action.createSessionDesc",
    icon: CalendarPlus,
    color: "blue",
    moduleId: "sessions",
    permission: SESSIONS_MODULE_MANIFEST.permissions.write,
    route: ROUTES.sessions,
    roles: ["admin", "faculty"],
  },
  {
    id: "record-payment",
    labelKey: "action.recordPayment",
    descKey: "action.recordPaymentDesc",
    icon: DollarSign,
    color: "amber",
    moduleId: "finance",
    permission: FINANCE_MODULE_MANIFEST.permissions.write,
    route: ROUTES.finance,
    roles: ["admin", "accountant"],
  },
  {
    id: "take-attendance",
    labelKey: "action.takeAttendance",
    descKey: "action.takeAttendanceDesc",
    icon: UserCheck,
    color: "violet",
    moduleId: "attendance",
    permission: ATTENDANCE_MODULE_MANIFEST.permissions.write,
    route: ROUTES.attendance,
    roles: ["admin", "faculty"],
  },
  {
    id: "award-hasanat",
    labelKey: "action.awardHasanat",
    descKey: "action.awardHasanatDesc",
    icon: Star,
    color: "amber",
    moduleId: "hasanat",
    permission: HASANAT_MODULE_MANIFEST.permissions.write,
    route: ROUTES.hasanatCards,
    roles: ["admin", "faculty"],
  },
  {
    id: "view-accounting",
    labelKey: "action.generateReport",
    descKey: "action.generateReportDesc",
    icon: BarChart3,
    color: "slate",
    moduleId: "accounting",
    permission: ACCOUNTING_MODULE_MANIFEST.permissions.reports,
    route: ROUTES.accounting,
    roles: ["admin", "accountant"],
  },
  {
    id: "print-receipt",
    labelKey: "action.printReceipt",
    descKey: "action.printReceiptDesc",
    icon: Printer,
    color: "amber",
    moduleId: "finance",
    permission: FINANCE_MODULE_MANIFEST.permissions.write,
    route: ROUTES.finance,
    roles: ["accountant"],
  },
  {
    id: "view-ledger",
    labelKey: "action.viewLedger",
    descKey: "action.viewLedgerDesc",
    icon: FileText,
    color: "violet",
    moduleId: "accounting",
    permission: ACCOUNTING_MODULE_MANIFEST.permissions.write,
    route: ROUTES.accounting,
    roles: ["accountant"],
  },
] as const;

export function getQuickActionsForRole(
  dashboardRole: DashboardRole | string,
): DashboardQuickAction[] {
  return DASHBOARD_QUICK_ACTIONS.filter((action) =>
    action.roles.includes(dashboardRole as DashboardRole),
  );
}
