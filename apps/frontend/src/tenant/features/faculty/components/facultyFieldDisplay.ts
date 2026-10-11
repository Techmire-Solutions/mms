import {
  customFieldKeyFromColumnKey,
  formatFacultyFieldCellValue,
  type FacultyMember,
  type FacultyCustomField,
} from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { formatDate, formatFacultyPerformanceRating } from "@mms/shared";

type LinkedContactName = { name?: string | null } | null | undefined;

/** Display name for Work list/detail — hydrated faculty name, then linked contact, then missing label. */
export function resolveFacultyDisplayName(
  faculty: Pick<FacultyMember, "name">,
  t: TranslationFunction,
  linkedContact?: LinkedContactName,
): string {
  return faculty.name || linkedContact?.name || t("faculty.contactMissing");
}

/** Per-row identity + selection projection shared by the cards and table Work renderers. */
export function facultyRowIdentity(
  faculty: FacultyMember,
  selectedIds: string[] | ReadonlySet<string>,
  t: TranslationFunction,
): { facultyIdStr: string; displayName: string; isSelected: boolean } {
  const facultyIdStr = String(faculty.id);
  const isSelected = Array.isArray(selectedIds)
    ? selectedIds.includes(facultyIdStr)
    : selectedIds.has(facultyIdStr);
  return {
    facultyIdStr,
    displayName: resolveFacultyDisplayName(faculty, t),
    isSelected,
  };
}

export type FacultyCustomFieldDisplay = Pick<FacultyCustomField, "id"> & { type?: string };

/**
 * Format a faculty custom field value for Work table/cards/detail read rows.
 * Returns `undefined` when empty so callers can hide the row or apply notSpecified once.
 */
export function formatFacultyCustomFieldValue(
  faculty: FacultyMember,
  field: FacultyCustomFieldDisplay,
  t: TranslationFunction,
): string | undefined {
  const fieldValue = (faculty as Record<string, unknown>)[field.id];
  return formatFacultyFieldCellValue(fieldValue, {
    fieldType: field.type,
    booleanLabels: { yes: t("common.yes"), no: t("common.no") },
    arraySeparator: ", ",
  });
}

export function getFacultyCustomFieldValue(
  faculty: FacultyMember,
  field: FacultyCustomFieldDisplay,
  t: TranslationFunction,
): string {
  return formatFacultyCustomFieldValue(faculty, field, t) ?? t("common.notSpecified");
}

/**
 * Text display value for a Faculty system or custom field key.
 * Returns `undefined` when empty (detail may hide the row; Work falls back to notSpecified).
 * `status` is not formatted here — callers render StatusBadge.
 */
export function resolveFacultyFieldDisplayText(
  faculty: FacultyMember,
  fieldKey: string,
  options: {
    t: TranslationFunction;
    displayName?: string;
    customFieldLabel?: string;
    customFieldType?: string;
    /** Treat `fieldKey` as a custom data key (bare id or `custom:id`). */
    isCustom?: boolean;
    /** When true, empty values become `common.notSpecified`. */
    notSpecifiedFallback?: boolean;
  },
): string | undefined {
  const { t, displayName, customFieldLabel, customFieldType, isCustom, notSpecifiedFallback } =
    options;
  const missing = () => (notSpecifiedFallback ? t("common.notSpecified") : undefined);

  if (isCustom || fieldKey.startsWith("custom:")) {
    const fieldId = customFieldKeyFromColumnKey(fieldKey) ?? fieldKey;
    const field = {
      id: fieldId,
      label: customFieldLabel ?? fieldId,
      type: customFieldType,
    };
    return notSpecifiedFallback
      ? getFacultyCustomFieldValue(faculty, field, t)
      : formatFacultyCustomFieldValue(faculty, field, t);
  }

  if (fieldKey === "status") {
    return faculty.status || undefined;
  }
  if (fieldKey === "profileStatus") {
    return faculty.profileStatus || undefined;
  }
  if (fieldKey === "employDesignationStatus") {
    return faculty.employDesignationStatus || faculty.profileStatus || undefined;
  }
  if (fieldKey === "contactId") {
    return displayName ?? resolveFacultyDisplayName(faculty, t);
  }
  if (fieldKey === "employeeId") {
    return faculty.employeeId || missing();
  }
  if (fieldKey === "specialization") {
    return faculty.specialization || missing();
  }
  if (fieldKey === "qualification") {
    return faculty.qualification || missing();
  }
  if (fieldKey === "joinDate" || fieldKey === "employmentStartDate") {
    const start = faculty.employmentStartDate ?? faculty.joinDate;
    return start ? formatDate(start) : missing();
  }
  if (fieldKey === "employmentEndDate") {
    return faculty.employmentEndDate ? formatDate(faculty.employmentEndDate) : missing();
  }
  if (fieldKey === "designationStartDate") {
    return faculty.designationStartDate ? formatDate(faculty.designationStartDate) : missing();
  }
  if (fieldKey === "designationEndDate") {
    return faculty.designationEndDate ? formatDate(faculty.designationEndDate) : missing();
  }
  if (fieldKey === "performanceRating") {
    return faculty.performanceRating != null
      ? formatFacultyPerformanceRating(faculty.performanceRating)
      : missing();
  }
  if (fieldKey === "parentDesignationId") {
    const parent = (faculty as Record<string, unknown>).parentDesignationName;
    return typeof parent === "string" && parent ? parent : missing();
  }
  if (fieldKey === "department" || fieldKey === "departmentId") {
    const dynamic = (faculty as Record<string, unknown>).departmentName;
    return typeof dynamic === "string" && dynamic ? dynamic : faculty.department || missing();
  }
  if (fieldKey === "designation" || fieldKey === "designationId") {
    // Prefer the server-projected current designation name (from assignment join),
    // falling back to the legacy static designation string.
    const dynamic = (faculty as Record<string, unknown>).designationName;
    return typeof dynamic === "string" && dynamic ? dynamic : faculty.designation || missing();
  }
  if (fieldKey === "reportingFacultyId" || fieldKey === "reportingFacultyName") {
    return faculty.reportingFacultyName || missing();
  }
  if (fieldKey === "hierarchyRank") {
    return faculty.hierarchyRank != null ? String(faculty.hierarchyRank) : missing();
  }
  if (fieldKey === "subordinateCount") {
    return faculty.subordinateCount != null ? String(faculty.subordinateCount) : missing();
  }
  if (fieldKey === "notes") {
    return faculty.notes || missing();
  }
  return missing();
}
