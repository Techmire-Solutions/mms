import type { AppTranslationKey } from "@mms/shared";
import type { StatusBadgeConfigItem } from "@/components/ui/StatusBadge";
import { SEMANTIC_BADGE } from "@/lib/semanticTone";

export interface AuditEntry {
  ts?: string | number;
  action: string;
  studentId?: string;
  field?: string;
  from?: string;
  to?: string;
  studentName?: string;
  count?: number;
  status?: string;
  geo?: boolean | { lat: number; lng: number } | null;
  by?: string;
}

export function describeAuditEntry(
  entry: AuditEntry,
  studentNameFor: (id?: string) => string,
  t: (key: AppTranslationKey, vars?: Record<string, string | number>) => string,
): string {
  if (entry.action === "edit") {
    const studentLabel = studentNameFor(entry.studentId) || entry.studentName || "student";
    return t("attendance.audit.desc.edit", {
      field: entry.field ?? "",
      from: entry.from ?? "",
      to: entry.to ?? "",
      name: studentLabel,
    });
  }
  if (entry.action === "bulk_mark") {
    return t("attendance.audit.desc.bulkMark", {
      count: entry.count ?? 0,
      status: entry.status ?? "",
    });
  }
  if (entry.action === "submitted") {
    return entry.geo
      ? t("attendance.audit.desc.submittedGeo", { count: entry.count ?? 0 })
      : t("attendance.audit.desc.submitted", { count: entry.count ?? 0 });
  }
  if (entry.action === "draft_saved") {
    return t("attendance.audit.desc.draftSaved");
  }
  return entry.action;
}

export function buildAuditActionConfig(
  t: (key: AppTranslationKey) => string,
): Record<string, StatusBadgeConfigItem> {
  return {
    edit: { label: t("attendance.audit.action.edit"), cls: SEMANTIC_BADGE.info },
    bulk_mark: { label: t("attendance.audit.action.bulkMark"), cls: SEMANTIC_BADGE.warning },
    submitted: { label: t("attendance.audit.action.submitted"), cls: SEMANTIC_BADGE.success },
    draft_saved: { label: t("attendance.audit.action.draftSaved"), cls: SEMANTIC_BADGE.muted },
  };
}
