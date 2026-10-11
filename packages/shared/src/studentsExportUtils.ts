/**
 * @file studentsExportUtils.ts
 * @description Students module export utilities.
 */
import type { FieldDefinition } from "./contactTypes.js";
import type { Student } from "./studentTypes.js";
import type { StudentsSettings } from "./studentsModuleSettings.js";
import { primaryResponsibleAdultDisplayName } from "./studentGuardianFromContacts.js";
import {
  filterExportColumnsByVisibility,
  buildSimpleVisibilityContext,
} from "./dataTransfer/export/filterExportColumns.js";
import { buildExportGrid } from "./dataTransfer/export/buildExportGrid.js";
import type { ExportColumn } from "./dataTransfer/core/exportTypes.js";
import {
  type StudentExportColumn,
  ALL_STUDENT_EXPORT_COLUMNS,
  resolveAllStudentExportColumns,
  mergeCustomStudentExportColumns,
} from "./studentExportColumns.js";

import {
  DEFAULT_STUDENT_EXPORT_COLUMNS,
  studentColumnLabelKey,
} from "./studentDirectoryColumns.js";

export type { StudentExportColumn };
export {
  ALL_STUDENT_EXPORT_COLUMNS,
  resolveAllStudentExportColumns,
  mergeCustomStudentExportColumns,
  DEFAULT_STUDENT_EXPORT_COLUMNS,
  studentColumnLabelKey,
};

/** Column ids that alias a different Setup field key. */
const STUDENT_EXPORT_COLUMN_FIELD_ALIASES: Record<string, string> = {
  parents: "contactRelationships",
  fatherName: "contactRelationships",
  motherName: "contactRelationships",
  guardianName: "contactRelationships",
  sessions: "enrolledSessions",
};

/** Identity columns always exported regardless of Setup field registry. */
const STUDENT_EXPORT_ALWAYS_VISIBLE = new Set(["name", "grNumber", "status", "studentId"]);

function isTabKeyedFieldRegistry(
  fields: StudentsSettings["fields"],
): fields is Record<string, FieldDefinition[]> {
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) return false;
  const first = Object.values(fields)[0];
  return Array.isArray(first);
}

/**
 * Filters export columns by tab/field visibility rules from module settings.
 * Uses `filterExportColumnsByVisibility` from the shared data-transfer pipeline.
 */
export function filterStudentExportColumnsForViewer(
  columns: StudentExportColumn[],
  settings: StudentsSettings | null | undefined,
  viewerRole: string,
): StudentExportColumn[] {
  const source =
    columns.length > 0
      ? columns.length >= DEFAULT_STUDENT_EXPORT_COLUMNS.length
        ? mergeCustomStudentExportColumns(columns, settings)
        : columns
      : resolveAllStudentExportColumns(settings);

  if (!isTabKeyedFieldRegistry(settings?.fields)) return source;
  const ctx = buildSimpleVisibilityContext(
    settings.fields as Record<string, FieldDefinition[]>,
    settings.formTabs ?? [],
    viewerRole,
    STUDENT_EXPORT_ALWAYS_VISIBLE,
    STUDENT_EXPORT_COLUMN_FIELD_ALIASES,
  );
  return filterExportColumnsByVisibility(source as ExportColumn[], ctx) as StudentExportColumn[];
}

/** Pure cell extractor for Student entities. */
export function extractStudentCell(student: Student, columnId: string): string | number | null {
  if (columnId === "name") return student.name || "";
  if (columnId === "grNumber") return student.grNumber || "";
  if (columnId === "studentId") return student.studentId || "";
  if (columnId === "gender") return student.gender || "";
  if (columnId === "status") return String(student.status || "active");
  if (columnId === "phone") return student.phone || "";
  if (columnId === "email") return student.email || "";
  if (columnId === "dob") return student.dob || "";
  if (columnId === "solarDob")
    return student.solarDob ? String(student.solarDob) : student.dob || "";
  if (columnId === "lunarDob") return student.lunarDob ? String(student.lunarDob) : "";
  if (columnId === "city") return student.city || "";
  if (columnId === "cnic") return student.cnic || "";
  if (columnId === "registeredDate") return student.registeredDate || "";
  if (columnId === "enrollmentDate") return student.enrollmentDate || "";
  if (columnId === "discountType") return student.discountType || "";
  if (columnId === "discountPct")
    return student.discountPct != null ? Number(student.discountPct) : "";
  if (columnId === "registrationType") return student.registrationType || "";
  if (columnId === "notes") return student.notes || "";
  if (columnId === "parents") return primaryResponsibleAdultDisplayName(student);
  if (columnId === "fatherName") return student.fatherName || "";
  if (columnId === "motherName") return student.motherName || "";
  if (columnId === "guardianName") return student.guardianName || "";
  if (columnId === "sessions" || columnId === "enrolledSessions") {
    const sessions = student.enrolledSessions;
    return Array.isArray(sessions) ? sessions.filter(Boolean).join("; ") : "";
  }
  if (columnId === "createdAt") return student.createdAt ? String(student.createdAt) : "";
  if (columnId === "updatedAt") return student.updatedAt ? String(student.updatedAt) : "";

  const customObj = student.customFields as Record<string, unknown> | undefined;
  const cellVal = student[columnId as keyof Student] ?? customObj?.[columnId];
  if (cellVal === undefined || cellVal === null) return "";
  if (typeof cellVal === "boolean") return cellVal ? "true" : "false";
  if (typeof cellVal === "number") return cellVal;
  if (typeof cellVal === "string") return cellVal;
  if (Array.isArray(cellVal)) return cellVal.map(String).filter(Boolean).join("; ");
  if (typeof cellVal === "object") return JSON.stringify(cellVal);
  return String(cellVal);
}

/** Builds a 2D grid [header, ...rows] for the given students and columns. */
export function buildStudentsExportRows(
  students: Student[],
  columns: StudentExportColumn[],
): unknown[][] {
  return buildExportGrid(students, columns as ExportColumn[], extractStudentCell);
}
