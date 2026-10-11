import type { ReactNode } from "react";
import { formatDate, primaryResponsibleAdultDisplayName, type Student } from "@mms/shared";
import type { StatusBadgeConfigItem } from "@/components/ui/StatusBadge";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import {
  renderStudentDobCell,
  renderStudentStatusCell,
} from "@/tenant/features/students/components/StudentsListDesktopTableSimpleCells";
import {
  formatStudentsListContentCustomValue,
  studentCustomFieldKeyFromColumn,
} from "@/tenant/features/students/components/studentsListCustomColumns";

/** Render a Students Work column value (non-face system or custom:`id`). */
export function renderStudentWorkColumnValue(
  student: Student,
  columnKey: string,
  options: {
    t: TranslationFunction;
    statusBadgeConfig: Record<string, StatusBadgeConfigItem>;
    /** Replacement shown for empty values (Contacts/Teachers `emptyDash` parity). */
    emptyFallback?: ReactNode;
  },
): ReactNode {
  const { t, statusBadgeConfig, emptyFallback } = options;

  if (columnKey.startsWith("custom:")) {
    const fieldKey = studentCustomFieldKeyFromColumn(columnKey);
    const raw = fieldKey ? (student as Record<string, unknown>)[fieldKey] : undefined;
    return formatStudentsListContentCustomValue(raw, t) ?? emptyFallback;
  }

  switch (columnKey) {
    case "dob": {
      if (!student.dob) return emptyFallback;
      return renderStudentDobCell({
        studentRow: student,
        emptyDash: t("students.table.emptyDash"),
        t,
      });
    }
    case "parents": {
      const parentName = primaryResponsibleAdultDisplayName(student);
      return parentName || emptyFallback;
    }

    case "status":
      return renderStudentStatusCell({ studentRow: student, statusBadgeConfig });
    case "registeredDate":
      return student.registeredDate ? formatDate(student.registeredDate, true) : emptyFallback;
    case "notes":
      return student.notes?.trim() || emptyFallback;
    default:
      return emptyFallback;
  }
}
