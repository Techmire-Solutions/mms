import {
  createNamedEntityLookupMap,
  normalizeIdLinkedName,
  resolveEntityName,
  type NamedEntity,
} from "../contacts/contactLinkPolicy.js";

export function normalizeStudentLinkedRows<T extends Record<string, unknown>>(
  rows: T[],
  idField = "studentId",
  nameField = "studentName",
): T[] {
  if (!rows || !Array.isArray(rows)) return [];
  return rows.map((row) => {
    if (!row || typeof row !== "object") return row;
    return normalizeIdLinkedName(row, idField, nameField);
  });
}

export function hydrateStudentLinkedRows<T extends Record<string, unknown>>(
  rows: T[],
  students: NamedEntity[] | Map<string, NamedEntity>,
  idField = "studentId",
  nameField = "studentName",
): T[] {
  if (!rows || !Array.isArray(rows)) return [];
  const lookup =
    students instanceof Map
      ? students
      : students.length > 8
        ? createNamedEntityLookupMap(students)
        : students;
  return rows.map((row) => {
    if (!row || typeof row !== "object") return row;
    const current = row[nameField];
    const resolved = resolveEntityName(row[idField] as string | number, lookup) || current;
    if (resolved === current) return row;
    return {
      ...row,
      [nameField]: resolved,
    };
  });
}
