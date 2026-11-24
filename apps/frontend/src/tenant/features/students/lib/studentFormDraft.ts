import {
  type Student,
  type FieldDefinition,
  todayISO,
  applyStudentScalarCustomFieldDefaults,
  STUDENT_WRITE_SYSTEM_KEYS,
} from "@mms/contracts";

const STUDENT_FORM_VOLATILE_KEYS = new Set([
  "id",
  "name",
  "gender",
  "dob",
  "phone",
  "email",
  "city",
  "cnic",
  "avatar",
  "enrolledSessions",
  "enrollmentDate",
  "deletedAt",
  "deletedBy",
  "deletionReason",
  "_blueprintId",
  "createdAt",
  "updatedAt",
  // Obsolete triad / unused prefs — not edited on the form.
  "fatherContactId",
  "motherContactId",
  "guardianContactId",
  "fatherName",
  "motherName",
  "guardianName",
  "discountType",
  "discountPct",
  "registrationType",
  "studentId",
]);

interface GetInitialStudentDraftOptions {
  student?: Partial<Student> | null;
  fields?: Record<string, FieldDefinition[]>;
}

/** Draft for FormModal — form-owned fields + Setup custom values; strip hydrated/obsolete chrome. */
export function getInitialStudentDraft(
  studentOrOptions?: Partial<Student> | null | GetInitialStudentDraftOptions,
): Partial<Student> {
  const options: GetInitialStudentDraftOptions =
    studentOrOptions && typeof studentOrOptions === "object" && "fields" in studentOrOptions
      ? (studentOrOptions as GetInitialStudentDraftOptions)
      : { student: studentOrOptions as Partial<Student> | null | undefined };

  const { student, fields } = options;

  // The API row is a read projection: it may carry the nested `customFields`
  // map plus legacy/read-only columns that are not part of the write DTO.
  // Copy only keys this form can persist (system keys + enabled Setup fields);
  // the rest would fail the strict client/server schema on an unchanged save.
  const editableKeys = new Set<string>(STUDENT_WRITE_SYSTEM_KEYS);
  for (const tabFields of Object.values(fields ?? {})) {
    for (const field of tabFields) {
      if (field.enabled !== false) editableKeys.add(field.key);
    }
  }

  let draft: Partial<Student> = {
    contactId: student?.contactId ?? "",
    status: student?.status ?? "active",
    grNumber: student?.grNumber ?? "",
    registeredDate: student?.registeredDate ?? todayISO(),
    // `notes` is omitted from the Work list projection on purpose; only materialise it
    // when the row was hydrated. Forcing `""` here made every save from the directory
    // overwrite the stored notes (2026-11-04 review, M2).
    ...(student?.notes !== undefined ? { notes: student.notes } : {}),
  };

  if (student) {
    for (const [key, value] of Object.entries(student)) {
      if (value === undefined) continue;
      if (STUDENT_FORM_VOLATILE_KEYS.has(key)) continue;
      if (!editableKeys.has(key)) continue;
      if (key in draft) continue;
      (draft as Record<string, unknown>)[key] = value;
    }
  }

  if (fields) {
    draft = applyStudentScalarCustomFieldDefaults(draft, fields);
  }

  return draft;
}

export function studentDraftSnapshot(draft: Partial<Student>): string {
  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(draft)) {
    if (STUDENT_FORM_VOLATILE_KEYS.has(key)) continue;
    payload[key] = value ?? "";
  }
  return JSON.stringify(payload);
}
