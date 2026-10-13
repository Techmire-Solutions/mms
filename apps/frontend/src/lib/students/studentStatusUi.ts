import { resolveStudentStatuses } from "@mms/shared";
import { SEMANTIC_BADGE } from "@/lib/ui/semanticTone";
import { createModuleStatusUi } from "@/lib/ui/moduleStatusUi";

/** Badge / chip tone classes for a student status (tenant-added statuses fall back to muted). */
function studentStatusTone(status: string): string {
  switch (status) {
    case "active":
      return SEMANTIC_BADGE.success;
    case "suspended":
      return SEMANTIC_BADGE.warning;
    case "graduated":
      return SEMANTIC_BADGE.info;
    case "transferred":
      return SEMANTIC_BADGE.infoStrong;
    default:
      return SEMANTIC_BADGE.muted;
  }
}

const studentStatusUi = createModuleStatusUi({
  translationPrefix: "students.form.status",
  resolveStatuses: resolveStudentStatuses,
  toneForStatus: studentStatusTone,
});

export const studentStatusLabel = studentStatusUi.statusLabel;
export const studentStatusBadgeConfig = studentStatusUi.statusBadgeConfig;
