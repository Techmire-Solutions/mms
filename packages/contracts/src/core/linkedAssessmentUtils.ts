import {
  createNamedEntityLookupMap,
  normalizeIdLinkedName,
  resolveEntityName,
  type NamedEntity,
} from "../contacts/contactLinkPolicy.js";

export function normalizeAssessmentResult<T extends Record<string, unknown>>(row: T): T {
  if (!row || typeof row !== "object") return row;
  return normalizeIdLinkedName(row, "studentId", "studentName");
}

export function hydrateAssessmentResult<T extends Record<string, unknown>>(
  row: T,
  students: NamedEntity[] | Map<string, NamedEntity>,
): T {
  if (!row || typeof row !== "object") return row;
  const current = row.studentName;
  const resolved = resolveEntityName(row.studentId as string | number, students) || current;
  if (resolved === current) return row;
  return {
    ...row,
    studentName: resolved,
  };
}

export function hydrateAssessmentResultList<T extends Record<string, unknown>>(
  rows: T[],
  students: NamedEntity[] | Map<string, NamedEntity>,
): T[] {
  if (!rows || !Array.isArray(rows)) return [];
  const studentLookup =
    students instanceof Map
      ? students
      : students.length > 8
        ? createNamedEntityLookupMap(students)
        : students;
  return rows.map((r) => hydrateAssessmentResult(r, studentLookup));
}
