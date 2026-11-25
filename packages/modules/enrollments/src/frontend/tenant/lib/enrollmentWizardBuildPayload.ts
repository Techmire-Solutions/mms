import { todayISO, toMoneyNumber } from "@mms/contracts";
import type { EnrollmentInsert } from "@mms/contracts";
import { type CalculatedFee } from "./enrollmentData";
import type { Student } from "@mms/contracts";
import type { Session, Class } from "@mms/contracts";

export function buildEnrollmentPayload(params: {
  student: Student;
  session: Session;
  classInfo: Class | null;
  feeResult: CalculatedFee;
  notes: string;
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
    baseFee: toMoneyNumber(session.baseFee) ?? 0,
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
