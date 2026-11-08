import {
  enrollmentFeeForClass,
  parseEnrollmentStatus,
  type ImportRowError,
  type Session,
} from "@mms/shared";
import type { z } from "zod";
import type { enrollmentImportRowSchema } from "@mms/shared";
import {
  getHydratedSessionForImport,
  lookupImportSessionsBulk,
  lookupImportStudentsBulk,
  lookupLiveEnrollmentPairs,
  type ImportStudentRow,
} from "../repository/enrollmentImportRepository.js";

export type EnrollmentImportRow = z.infer<typeof enrollmentImportRowSchema>;

interface PlannedEnrollment {
  rowNumber: number;
  studentId: string;
  studentName: string;
  session: Session;
  cls: Session["classes"][number];
  sectionId?: string;
  enrolledDate: string;
  status: "pending" | "confirmed";
  baseFee: number;
  discountType: string;
  discountLabel: string;
  discountPct: number;
  discountAmt: number;
  finalFee: number;
  notes: string;
  paymentStatus: string;
}

export interface EnrollmentImportPlan {
  planned: PlannedEnrollment[];
  errors: ImportRowError[];
  duplicates: number;
}

function rowError(row: number, reason: string): ImportRowError {
  return { row, reason };
}

function norm(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function isoDate(value: string | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

/** In-memory lookup maps built from 3 bulk queries instead of per-row lookups. */
async function buildLookups(tenant: string, rows: readonly EnrollmentImportRow[]) {
  const identifiers = rows.flatMap((row) =>
    [row.studentId?.trim()].filter((value): value is string => Boolean(value)),
  );
  const studentNames = rows.flatMap((row) => [norm(row.studentName)].filter(Boolean));
  const sessionIds = rows.flatMap((row) =>
    [row.sessionId?.trim()].filter((value): value is string => Boolean(value)),
  );
  const sessionNames = rows.flatMap((row) => [norm(row.sessionName)].filter(Boolean));

  const [students, sessions] = await Promise.all([
    lookupImportStudentsBulk(tenant, { identifiers, names: studentNames }),
    lookupImportSessionsBulk(tenant, { ids: sessionIds, names: sessionNames }),
  ]);

  const studentByIdentifier = new Map<string, ImportStudentRow>();
  const studentsByName = new Map<string, ImportStudentRow[]>();
  for (const student of students) {
    for (const key of [student.id, student.studentId, student.grNumber]) {
      if (key) studentByIdentifier.set(String(key), student);
    }
    const name = norm(student.name);
    if (name) {
      const list = studentsByName.get(name) ?? [];
      list.push(student);
      studentsByName.set(name, list);
    }
  }
  const sessionById = new Map(sessions.map((session) => [session.id, session]));
  const sessionsByName = new Map<string, typeof sessions>();
  for (const session of sessions) {
    const name = norm(session.name);
    const list = sessionsByName.get(name) ?? [];
    list.push(session);
    sessionsByName.set(name, list);
  }
  return { studentByIdentifier, studentsByName, sessionById, sessionsByName };
}

/** Resolve rows against the DB with bounded queries and no writes (pre-flight + import). */
export async function planEnrollmentImport(
  tenant: string,
  rows: readonly EnrollmentImportRow[],
  offset = 0,
): Promise<EnrollmentImportPlan> {
  const errors: ImportRowError[] = [];
  const { studentByIdentifier, studentsByName, sessionById, sessionsByName } = await buildLookups(
    tenant,
    rows,
  );

  const sessionCache = new Map<string, Session | null>();
  const sessionOf = async (sessionId: string): Promise<Session | null> => {
    if (!sessionCache.has(sessionId)) {
      sessionCache.set(sessionId, await getHydratedSessionForImport(tenant, sessionId));
    }
    return sessionCache.get(sessionId) ?? null;
  };

  const resolved: Array<{
    rowNumber: number;
    row: EnrollmentImportRow;
    student: ImportStudentRow;
    session: Session;
    cls: Session["classes"][number];
  }> = [];

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]!;
    const rowNumber = offset + index + 1;
    const studentIdRaw = (row.studentId ?? "").trim();
    const nameRaw = norm(row.studentName);
    let student: ImportStudentRow | undefined;
    if (studentIdRaw) student = studentByIdentifier.get(studentIdRaw);
    if (!student && nameRaw) {
      const matches = studentsByName.get(nameRaw) ?? [];
      if (matches.length > 1) {
        errors.push(
          rowError(rowNumber, "Student name matches more than one student — import by studentId"),
        );
        continue;
      }
      student = matches[0];
    }
    if (!student) {
      errors.push(rowError(rowNumber, "Student not found"));
      continue;
    }

    const sessionIdRaw = (row.sessionId ?? "").trim();
    const sessionNameRaw = norm(row.sessionName);
    const sessionRow = sessionIdRaw
      ? sessionById.get(sessionIdRaw)
      : (sessionsByName.get(sessionNameRaw) ?? [])[0];
    if (!sessionRow) {
      errors.push(rowError(rowNumber, "Session not found"));
      continue;
    }
    const session = await sessionOf(sessionRow.id);
    if (!session) {
      errors.push(rowError(rowNumber, "Session not found"));
      continue;
    }

    const classIdRaw = (row.classId ?? "").trim();
    const classNameRaw = norm(row.className);
    const classMatches = (session.classes ?? []).filter((cls) =>
      classIdRaw ? cls.id === classIdRaw : norm(cls.name) === classNameRaw,
    );
    if (classMatches.length === 0) {
      errors.push(rowError(rowNumber, "Class not found in the session"));
      continue;
    }
    if (classMatches.length > 1) {
      errors.push(rowError(rowNumber, "Class name is ambiguous — import by classId"));
      continue;
    }
    const cls = classMatches[0]!;

    let status: "pending" | "confirmed";
    try {
      const parsed = parseEnrollmentStatus((row.status ?? "pending").trim().toLowerCase());
      if (parsed !== "pending" && parsed !== "confirmed") {
        errors.push(
          rowError(
            rowNumber,
            `Status "${parsed}" cannot be imported; use the enrolment operations`,
          ),
        );
        continue;
      }
      status = parsed;
    } catch {
      errors.push(rowError(rowNumber, `Unknown enrollment status "${row.status}"`));
      continue;
    }
    if (row.enrolledDate && !isoDate(row.enrolledDate)) {
      errors.push(rowError(rowNumber, `Invalid enrolledDate "${row.enrolledDate}"`));
      continue;
    }

    const fee = enrollmentFeeForClass(session.baseFee, cls, {
      discountType: student.discountType ?? null,
      discountPct: student.discountPct != null ? Number(student.discountPct) : null,
    });
    const baseFee = row.baseFee !== undefined ? Number(row.baseFee) : fee.baseFee;
    const discountPct = row.discountPct !== undefined ? Number(row.discountPct) : fee.discountPct;
    const finalFee =
      row.finalFee !== undefined
        ? Number(row.finalFee)
        : Math.max(0, Math.round((baseFee * (100 - discountPct) * 100) / 10000));
    if (![baseFee, discountPct, finalFee].every(Number.isFinite)) {
      errors.push(rowError(rowNumber, "Fee values must be numbers"));
      continue;
    }
    if (baseFee < 0 || finalFee < 0 || discountPct < 0 || discountPct > 100) {
      errors.push(rowError(rowNumber, "Fee values are out of range"));
      continue;
    }

    resolved.push({ rowNumber, row, student, session, cls });
    void status; // status/date/fee captured below in the second pass
  }

  // One query for every pre-existing live pair in this batch.
  const existing = await lookupLiveEnrollmentPairs(
    tenant,
    resolved.map((item) => item.student.id),
    resolved.map((item) => item.session.id),
  );
  const existingPairs = new Set(existing.map((pair) => `${pair.studentId}|${pair.sessionId}`));

  const planned: PlannedEnrollment[] = [];
  const seen = new Set<string>();
  let duplicates = 0;
  for (const item of resolved) {
    const pair = `${item.student.id}|${item.session.id}`;
    if (seen.has(pair)) {
      duplicates += 1;
      errors.push(rowError(item.rowNumber, "Duplicate row for the same student and session"));
      continue;
    }
    seen.add(pair);
    if (existingPairs.has(pair)) continue; // already enrolled before this import — skip
    const status = parseEnrollmentStatus((item.row.status ?? "pending").trim().toLowerCase()) as
      "pending" | "confirmed";
    const fee = enrollmentFeeForClass(item.session.baseFee, item.cls, {
      discountType: item.student.discountType ?? null,
      discountPct: item.student.discountPct != null ? Number(item.student.discountPct) : null,
    });
    const baseFee = item.row.baseFee !== undefined ? Number(item.row.baseFee) : fee.baseFee;
    const discountPct =
      item.row.discountPct !== undefined ? Number(item.row.discountPct) : fee.discountPct;
    const finalFee =
      item.row.finalFee !== undefined
        ? Number(item.row.finalFee)
        : Math.max(0, Math.round((baseFee * (100 - discountPct) * 100) / 10000));
    planned.push({
      rowNumber: item.rowNumber,
      studentId: item.student.id,
      studentName: item.student.name,
      session: item.session,
      cls: item.cls,
      ...((item.row.sectionId ?? item.cls.sections?.[0]?.id)
        ? { sectionId: item.row.sectionId ?? item.cls.sections![0]!.id }
        : {}),
      enrolledDate: isoDate(item.row.enrolledDate) ?? "",
      status,
      baseFee,
      discountType: item.row.discountType?.trim() || fee.discountType,
      discountLabel: fee.discountLabel,
      discountPct,
      discountAmt: Math.max(0, baseFee - finalFee),
      finalFee,
      notes: item.row.notes?.trim() || "",
      paymentStatus: item.row.paymentStatus?.trim() || "none",
    });
  }
  return { planned, errors, duplicates };
}
