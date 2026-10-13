import type { StudentsSettings } from "../settings/settingsTypes.js";
import { formatTemplateSequence } from "../core/sequenceNumberingUtils.js";

export type StudentGrNumberSettings = Pick<
  StudentsSettings,
  "grNumberTemplate" | "grNumberDigits" | "grNumberRestartAnnually"
>;

export type StudentDuplicateCheckInput = {
  excludeId?: string;
  contactId?: string | number;
  email?: string;
  name?: string;
  dob?: string;
  grNumber?: string;
};

export type StudentDuplicateReason = "contact" | "email" | "nameDob" | "grNumber";

type StudentRow = {
  id?: string | number;
  contactId?: string | number;
  email?: string;
  name?: string;
  dob?: string;
  registeredDate?: string;
  grNumber?: string;
};

/** Next GR number from roster + tenant settings (shared FE/BE). */
export function computeNextGrNumber(
  students: StudentRow[],
  settings: StudentGrNumberSettings,
  regDate: string,
): string {
  const template = settings.grNumberTemplate || "{seq}-{year}";
  const digits = settings.grNumberDigits || 4;
  const restartAnnually = settings.grNumberRestartAnnually !== false;
  const year = regDate ? new Date(regDate).getFullYear() : new Date().getFullYear();

  let nextSeq: number;
  if (restartAnnually) {
    const yearStr = String(year);
    let count = 0;
    for (const s of students) {
      const sDate = s.registeredDate || "";
      if (sDate.startsWith(yearStr) || (s.grNumber && String(s.grNumber).includes(yearStr))) {
        count++;
      }
    }
    nextSeq = count + 1;
  } else {
    nextSeq = students.length + 1;
  }

  return formatTemplateSequence(template, nextSeq, digits, regDate);
}

/** Client-side duplicate guard before save (server authoritative on POST). */
export function findStudentRegistrationConflict(
  students: StudentRow[],
  input: StudentDuplicateCheckInput,
): StudentDuplicateReason | null {
  const excludeId = input.excludeId ? String(input.excludeId) : undefined;
  const email = input.email?.trim().toLowerCase();
  const name = input.name?.trim().toLowerCase();
  const dob = input.dob?.trim();

  for (const row of students) {
    if (excludeId && String(row.id) === excludeId) continue;

    if (
      input.contactId != null &&
      row.contactId != null &&
      String(input.contactId) === String(row.contactId)
    ) {
      return "contact";
    }

    if (email && row.email && email === row.email.trim().toLowerCase()) {
      return "email";
    }

    const grNumber = input.grNumber?.trim().toLowerCase();
    if (grNumber && row.grNumber && grNumber === String(row.grNumber).trim().toLowerCase()) {
      return "grNumber";
    }

    if (name && dob && row.name && row.dob) {
      if (name === row.name.trim().toLowerCase() && dob === row.dob) {
        return "nameDob";
      }
    }
  }

  return null;
}

export function collectStudentLinkedContactIds(
  students: StudentRow[],
  excludeStudentId?: string,
): Array<string | number> {
  const exclude = excludeStudentId ? String(excludeStudentId) : undefined;
  return students
    .filter((row) => !exclude || String(row.id) !== exclude)
    .map((row) => row.contactId)
    .filter((id): id is string | number => id != null && id !== "");
}

type StudentGrBackfillRow = StudentRow & { grNumber?: string; registeredDate?: string };

/**
 * Assigns GR numbers to students missing `grNumber` using the same rules as legacy FE migration.
 * Mutates a working copy; returns only rows that received a new GR.
 */
export function backfillMissingStudentGrNumbers<T extends StudentGrBackfillRow>(
  students: T[],
  settings: StudentGrNumberSettings,
  fallbackRegisteredDate: string,
): T[] {
  const working = students.map((row) => ({ ...row }));
  const updated: T[] = [];
  const template = settings.grNumberTemplate || "{seq}-{year}";
  const digits = settings.grNumberDigits || 4;
  const restartAnnually = settings.grNumberRestartAnnually !== false;
  const targetYears = new Set<string>();
  if (restartAnnually) {
    for (const s of working) {
      const regDate = s.registeredDate || fallbackRegisteredDate;
      const yr = regDate ? new Date(regDate).getFullYear() : new Date().getFullYear();
      targetYears.add(String(yr));
    }
  }

  const yearCounts = new Map<string, number>();

  working.forEach((studentRecord, studentIndex) => {
    const registeredDate = studentRecord.registeredDate || fallbackRegisteredDate;
    const year = registeredDate ? new Date(registeredDate).getFullYear() : new Date().getFullYear();
    const yearStr = String(year);

    if (!studentRecord.grNumber) {
      let nextSeq: number;
      if (restartAnnually) {
        const count = yearCounts.get(yearStr) ?? 0;
        nextSeq = count + 1;
      } else {
        nextSeq = studentIndex + 1;
      }

      studentRecord.grNumber = formatTemplateSequence(template, nextSeq, digits, registeredDate);
      updated.push(studentRecord);
    }

    if (restartAnnually) {
      const rowDate = studentRecord.registeredDate || "";
      const rowGr = studentRecord.grNumber ? String(studentRecord.grNumber) : "";
      for (const y of targetYears) {
        if (rowDate.startsWith(y) || (rowGr && rowGr.includes(y))) {
          yearCounts.set(y, (yearCounts.get(y) ?? 0) + 1);
        }
      }
    }
  });

  return updated;
}
