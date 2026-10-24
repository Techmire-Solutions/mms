import type { Student } from "@mms/shared";

/** True when the form is registering a new student (no persisted id). */
export function isStudentCreate(student?: Partial<Student> | null): boolean {
  return !student?.id;
}

export function buildContactSelectPatch(
  id: string | number | null,
  student: Partial<Student> | null | undefined,
  studentDraft: Partial<Student>,
  nextGrNumber?: string,
  autoGenerateId = true,
): Partial<Student> | null {
  if (!id) {
    return { contactId: "" };
  }
  const patch: Partial<Student> = { contactId: String(id) };
  if (autoGenerateId && isStudentCreate(student) && !studentDraft.grNumber && nextGrNumber) {
    patch.grNumber = nextGrNumber;
  }
  return patch;
}

/** Resolve GR for create save when auto-generate is on (Teachers next-id parity). */
export function resolveStudentGrForSave(
  student: Partial<Student> | null | undefined,
  studentDraft: Partial<Student>,
  nextGrNumber: string | undefined,
  autoGenerateId: boolean,
): Partial<Student> {
  if (!autoGenerateId || !isStudentCreate(student)) {
    return studentDraft;
  }
  const resolved = studentDraft.grNumber?.trim() || nextGrNumber?.trim();
  if (!resolved || resolved === studentDraft.grNumber) {
    return studentDraft;
  }
  return { ...studentDraft, grNumber: resolved };
}
