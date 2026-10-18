import { usePermissions } from "@/tenant/hooks/usePermissions";
import { resolveDashboardRole } from "@/lib/dashboardRole";

export type ViewerRole = "admin" | "faculty" | "accountant";
export type EnrollmentViewerRole = "admin" | "staff" | "accountant";

/** Maps authenticated user.role to the standard viewer role used across module pages. */
export function normalizeViewerRole(role: string | undefined): ViewerRole {
  const normalized = (role ?? "admin").toLowerCase();
  if (normalized === "faculty" || normalized === "staff") return "faculty";
  if (normalized === "accountant") return "accountant";
  return "admin";
}

/** Enrollments module labels non-admin staff as `staff` instead of `faculty`. */
export function normalizeEnrollmentViewerRole(role: string | undefined): EnrollmentViewerRole {
  const normalized = normalizeViewerRole(role);
  if (normalized === "faculty") return "staff";
  return normalized;
}

/** Active viewer dashboardRole from RBAC — prefer over raw JWT role string. */
export function useViewerRole(): ViewerRole {
  const { can } = usePermissions();
  return (() => resolveDashboardRole(can))();
}

/** Whether the signed-in viewer has admin privileges (gates Users config/analytics). */
export function useIsAdminViewer(): boolean {
  const { can } = usePermissions();
  return can("users.manage");
}

export function useEnrollmentViewerRole(): EnrollmentViewerRole {
  const role = useViewerRole();
  return (() => normalizeEnrollmentViewerRole(role))();
}
