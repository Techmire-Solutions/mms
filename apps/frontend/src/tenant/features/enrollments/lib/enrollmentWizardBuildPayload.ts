import { todayISO } from "@mms/shared";
import type { EnrollmentInsert } from "@mms/shared";
import { type CalculatedFee } from "@/lib/data/enrollmentData";
import { type Student } from "@/lib/data/studentsData";
import { type Session, type Class } from "@/lib/data/sessionsData";

export function buildEnrollmentPayload(params: {
  student: Student;
  session: Session;
  classInfo: Class | null;
  feeResult: CalculatedFee;
  notes: string;
  customFieldValues: Record<string, unknown>;
  /** Section + roll number; the server defaults the section when omitted. */
  placement?: { sectionId: string; rollNo: string };
}): EnrollmentInsert {
  const { student, session, classInfo, feeResult, notes, placement } = params;

  return {
    studentId: student.id,
    studentName: student.name || "",
    sessionId: session.id,
    sessionName: session.name,
    classId: classInfo?.id || "",
    className: classInfo?.name || "",
    ...(placement?.sectionId ? { sectionId: placement.sectionId } : {}),
    ...(placement?.rollNo.trim() ? { rollNo: placement.rollNo.trim() } : {}),
    enrolledDate: todayISO(),
    baseFee: session.baseFee,
    discountType: feeResult.id,
    discountLabel: feeResult.label,
    discountPct: feeResult.pct,
    discountAmt: feeResult.discountAmt,
    finalFee: feeResult.finalFee,
    status: "pending" as const,
    invoiceId: null,
    paymentStatus: "pending" as const,
    notes,
    timeline: [],
  } satisfies EnrollmentInsert;
}
