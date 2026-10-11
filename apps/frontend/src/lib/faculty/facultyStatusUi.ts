import { resolveFacultyStatusRoles, resolveFacultyStatuses } from "@mms/shared";
import type { AccentColor } from "@/components/ui/statCardAccent";
import { SEMANTIC_BADGE } from "@/lib/semanticTone";
import { createModuleStatusUi } from "@/lib/moduleStatusUi";

const resolveRoles = resolveFacultyStatusRoles;
const resolveStatuses = resolveFacultyStatuses;

const {
  active: FACULTY_STATUS_ACTIVE,
  onLeave: FACULTY_STATUS_ON_LEAVE,
  retired: FACULTY_STATUS_RETIRED,
  terminated: FACULTY_STATUS_TERMINATED,
} = resolveRoles();

/** Status → semantic accent (badge classes + metrics StatCard share this map). */
function facultyStatusSemanticAccent(status: string): AccentColor {
  if (status === FACULTY_STATUS_ACTIVE) return "success";
  if (status === FACULTY_STATUS_ON_LEAVE) return "warning";
  if (status === FACULTY_STATUS_TERMINATED) return "destructive";
  if (status === FACULTY_STATUS_RETIRED) return "info";
  return "muted";
}

/** Status slug → SEMANTIC_BADGE tone class (aligned with the accent map). */
function facultyStatusTone(status: string): string {
  const accent = facultyStatusSemanticAccent(status);
  if (accent === "success") return SEMANTIC_BADGE.success;
  if (accent === "warning") return SEMANTIC_BADGE.warning;
  if (accent === "destructive") return SEMANTIC_BADGE.destructive;
  if (accent === "info") return SEMANTIC_BADGE.info;
  return "muted";
}

const facultyStatusUi = createModuleStatusUi({
  translationPrefix: "faculty.status",
  resolveStatuses,
  toneForStatus: facultyStatusTone,
  metricAccentForStatus: facultyStatusSemanticAccent,
});

export const facultyStatusLabel = facultyStatusUi.statusLabel;
export const facultyStatusOptions = facultyStatusUi.statusOptions;
export const facultyStatusBadgeConfig = facultyStatusUi.statusBadgeConfig;
export const facultyStatusMetricAccent = facultyStatusUi.statusMetricAccent;
